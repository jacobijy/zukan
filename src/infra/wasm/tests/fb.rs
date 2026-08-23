//! FlatBuffers 解码单元测试
//!
//! 通过 `include_bytes!` 从相对路径 `../../../../../zukan-server/assets/fb/` 加载
//! 4 个 root 各一份真实数据，验证 identifier 校验 + 抽样字段。
//!
//! 若邻居仓 zukan-server 不可用（例如 CI 只 checkout zukan），可以把这份测试
//! 迁到本 crate 的 `tests/fixtures/` 目录并把 `include_bytes!` 路径改成本地。

use zukan_wasm::fb::decode::{
    decode_evolution_bundle, decode_i18n_flavor_bundle, decode_i18n_names_bundle,
    decode_moves_data_bundle, decode_pokemon_gen_bundle, decode_pokemon_moves_bundle,
    decode_pokemon_vg_moves_bundle,
};
use zukan_wasm::fb::FbDecodeError;

// —— fixtures：相对路径指向邻居仓 —— //
const GEN_3: &[u8] = include_bytes!("../../../../../zukan-server/assets/fb/gen-3.bin");
const PMOV_20: &[u8] = include_bytes!("../../../../../zukan-server/assets/fb/moves/vg-20.bin");
const PMSB_COMMON: &[u8] =
    include_bytes!("../../../../../zukan-server/assets/fb/pokemon_moves/common.bin");
const MDAT_COMMON: &[u8] =
    include_bytes!("../../../../../zukan-server/assets/fb/moves_data/common.bin");
const I18N_ZH_NAMES: &[u8] =
    include_bytes!("../../../../../zukan-server/assets/fb/i18n/zh-hans/names.bin");
const I18N_ZH_FLAVOR: &[u8] =
    include_bytes!("../../../../../zukan-server/assets/fb/i18n/zh-hans/flavor.bin");
const I18N_EN_FLAVOR: &[u8] =
    include_bytes!("../../../../../zukan-server/assets/fb/i18n/en/flavor.bin");
const EVOLUTION: &[u8] = include_bytes!("../../../../../zukan-server/assets/fb/evolution.bin");

#[test]
fn decodes_pokemon_gen_bundle_gen3() {
    let b = decode_pokemon_gen_bundle(GEN_3).expect("gen-3.bin decode");

    assert_eq!(b.generation_id, 3, "generation_id");
    assert_eq!(b.base_entries.len(), 1351, "base_entries.len");
    assert_eq!(b.stat_entries.len(), 1351, "stat_entries.len");
    assert_eq!(b.type_entries.len(), 1351, "type_entries.len");

    // 妙蛙种子（id=1）
    assert_eq!(b.base_entries[0].id, 1);
    assert_eq!(b.stat_entries[0].id, 1);

    // 皮宝宝 Clefairy (species_id=35) —— 第 3 代应该还是 Normal 属性（Fairy 属性到第 6 代才有）
    let clefairy_type = b
        .type_entries
        .iter()
        .find(|t| t.id == 35)
        .expect("Clefairy in type_entries");
    assert_eq!(clefairy_type.type_1_id, 1, "Clefairy in gen-3 应为 Normal(1)");

    // has_sprite：普通形态（妙蛙种子）应为 true；文档列的 8 个无立绘形态（10264–10271）应为 false
    let bulba = &b.base_entries[0];
    assert!(bulba.has_sprite, "Bulbasaur(id=1) 有正面立绘");
    let sprite_missing = b
        .base_entries
        .iter()
        .filter(|e| e.has_sprite == false)
        .map(|e| e.id)
        .collect::<Vec<_>>();
    assert!(
        sprite_missing.iter().all(|id| (10264..=10271).contains(id)),
        "无立绘形态应落在 10264..=10271，实际: {:?}",
        sprite_missing
    );
}

#[test]
fn decodes_evolution_bundle() {
    let b = decode_evolution_bundle(EVOLUTION).expect("evolution.bin decode");

    // species 按 species_id-1 下标：1..1025 连续
    assert_eq!(b.species.len(), 1025, "全物种行数");

    // 妙蛙种子（species 1）：链根（parent=0），有一条指向 2 的 edge
    let bulba = &b.species[0];
    assert_eq!(bulba.parent_species, 0, "妙蛙种子是链根");
    assert_eq!(bulba.edge_count, 1);
    let edge = &b.edges[bulba.edge_start as usize];
    assert_eq!(edge.target_species, 2, "妙蛙种子 → 妙蛙草");

    // 妙蛙草（2）→ 妙蛙花（3），默认 detail minimumLevel=32
    let ivysaur = &b.species[1];
    assert_eq!(ivysaur.parent_species, 1);
    let to_venusaur = &b.edges[ivysaur.edge_start as usize];
    assert_eq!(to_venusaur.target_species, 3);
    let detail = &b.details[to_venusaur.detail_start as usize];
    assert_eq!(detail.minimum_level, 32, "妙蛙草 → 妙蛙花 Lv.32");

    // 伊布（133）有 8 条进化分支
    let eevee = &b.species[132];
    assert_eq!(eevee.edge_count, 8, "伊布 8 分支");
    // 水伊布（134）默认 detail：triggerId=3(道具)、triggerItem=84(水之石)
    let to_vaporeon = b.edges[eevee.edge_start as usize..]
        .iter()
        .find(|e| e.target_species == 134)
        .expect("水伊布分支");
    let vaporeon_detail = &b.details[to_vaporeon.detail_start as usize];
    assert_eq!(vaporeon_detail.trigger_id, 3);
    assert_eq!(vaporeon_detail.trigger_item, 84);
}

#[test]
fn decodes_pokemon_vg_moves_bundle_vg20() {
    let b = decode_pokemon_vg_moves_bundle(PMOV_20).expect("vg-20.bin decode");
    assert_eq!(b.version_group_id, 20, "version_group_id");
    assert!(!b.entries.is_empty(), "entries 非空");

    // 抽样：第一条 entry 有合法字段
    let first = &b.entries[0];
    assert!(first.pokemon_id > 0);
    assert!(first.move_id > 0);
    assert!(first.method_id > 0);
}

#[test]
fn decodes_pokemon_moves_bundle_common() {
    let b = decode_pokemon_moves_bundle(PMSB_COMMON).expect("pokemon_moves/common.bin decode");
    assert_eq!(b.kind, 0, "COMMON = 0");
    assert_eq!(b.version_group_id, 25, "common baseline 对应 vg-25 (SV)");
    assert_eq!(b.entries.len(), 867, "SV 收录 867 只宝可梦");

    // 妙蛙种子应该在里面，且有 level_up 学习记录
    let bulba = b
        .entries
        .iter()
        .find(|e| e.pokemon_id == 1)
        .expect("Bulbasaur");
    assert!(!bulba.level_up.is_empty(), "Bulbasaur 有升级学会招式");
}

#[test]
fn decodes_moves_data_bundle_common() {
    let b = decode_moves_data_bundle(MDAT_COMMON).expect("moves_data/common.bin decode");
    assert_eq!(b.version_group_id, 0, "common baseline");
    assert!(!b.moves.is_empty(), "moves 非空");
    assert!(!b.move_meta.is_empty(), "meta 非空");

    // Tackle (id=33) power=40 (README §4 举例)
    let tackle = b.moves.iter().find(|m| m.id == 33).expect("Tackle");
    assert_eq!(tackle.power, 40, "Tackle 当前版本 power=40");
    assert_eq!(tackle.accuracy, 100, "Tackle 当前版本 accuracy=100");
}

#[test]
fn rejects_invalid_identifier() {
    // 随机 32 字节，前 4 是任意 offset，[4..8] 肯定不是 PKMB
    let junk = vec![0xAA; 32];
    match decode_pokemon_gen_bundle(&junk) {
        Err(FbDecodeError::InvalidIdentifier { expected, .. }) => {
            assert_eq!(expected, "PKMB");
        }
        Err(other) => panic!("expected InvalidIdentifier, got {other:?}"),
        Ok(_) => panic!("expected InvalidIdentifier"),
    }
}

#[test]
fn rejects_truncated_buffer() {
    let tiny = [0u8; 4];
    match decode_pokemon_gen_bundle(&tiny) {
        Err(FbDecodeError::TruncatedBuffer(4)) => {}
        Err(other) => panic!("expected TruncatedBuffer(4), got {other:?}"),
        Ok(_) => panic!("expected TruncatedBuffer(4), got Ok"),
    }
}

#[test]
fn decodes_i18n_names_bundle_zh_hans() {
    let b = decode_i18n_names_bundle(I18N_ZH_NAMES).expect("zh-hans/names.bin decode");
    assert_eq!(b.language, "zh-hans");
    assert_eq!(b.species.len(), 1025, "全部物种");

    // 妙蛙种子（id=1）
    let bulba = b.species.iter().find(|s| s.id == 1).expect("Bulbasaur");
    assert_eq!(bulba.name, "妙蛙种子");
    assert_eq!(bulba.genus, "种子宝可梦");

    // 属性名：火(10)/水(11)/草(12)
    let fire = b.types.iter().find(|t| t.id == 10).expect("Fire");
    assert_eq!(fire.name, "火");
}

#[test]
fn decodes_i18n_flavor_bundle_resolves_text_pool() {
    let b = decode_i18n_flavor_bundle(I18N_ZH_FLAVOR).expect("zh-hans/flavor.bin decode");
    assert_eq!(b.language, "zh-hans");
    assert!(!b.species.is_empty(), "图鉴描述非空");

    // 字符串池已在解码时解析为内联文本：所有非空文本都应可读
    let with_text = b.species.iter().find(|s| !s.text.is_empty());
    assert!(with_text.is_some(), "至少有一条非空图鉴描述");
    let sample = with_text.unwrap();
    assert!(sample.text.contains('\n') || !sample.text.is_empty());
    // 下标 0 代表的空串应被解析为 ""，不是 "0" 或越界 panic
    assert!(b.species.iter().all(|s| !s.text.contains('\u{0}')));

    // 中文无 effect 数据（上游仅英文）
    assert!(b.ability_effects.is_empty());
    assert!(b.move_effects.is_empty());
}

#[test]
fn decodes_i18n_flavor_bundle_en_effects() {
    let b = decode_i18n_flavor_bundle(I18N_EN_FLAVOR).expect("en/flavor.bin decode");
    assert_eq!(b.language, "en");
    // 英文独有：特性/技能效果
    assert!(!b.ability_effects.is_empty(), "英文有特性效果");
    assert!(!b.move_effects.is_empty(), "英文有技能效果");
    let first = &b.ability_effects[0];
    assert!(!first.short_effect.is_empty());
    assert!(!first.effect.is_empty());
}

#[test]
fn rejects_wrong_identifier_for_i18n() {
    // 用 names.bin 的 PKNM 去解 flavor，应报 identifier 不匹配
    match decode_i18n_flavor_bundle(I18N_ZH_NAMES) {
        Err(FbDecodeError::InvalidIdentifier { expected, .. }) => assert_eq!(expected, "PKFL"),
        Err(other) => panic!("expected InvalidIdentifier(PKFL), got {other:?}"),
        Ok(_) => panic!("expected InvalidIdentifier(PKFL), got Ok"),
    }
}
