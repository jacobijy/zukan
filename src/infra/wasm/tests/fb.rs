//! FlatBuffers 解码单元测试
//!
//! 通过 `include_bytes!` 从相对路径 `../../../../../zukan-server/assets/fb/` 加载
//! 4 个 root 各一份真实数据，验证 identifier 校验 + 抽样字段。
//!
//! 若邻居仓 zukan-server 不可用（例如 CI 只 checkout zukan），可以把这份测试
//! 迁到本 crate 的 `tests/fixtures/` 目录并把 `include_bytes!` 路径改成本地。

use zukan_wasm::fb::decode::{
    decode_moves_data_bundle,
    decode_pokemon_gen_bundle,
    decode_pokemon_moves_bundle,
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
