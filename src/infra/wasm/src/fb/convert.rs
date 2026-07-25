//! Owned 结构体：FB view → Serialize-able owned data。
//!
//! 通过 [`tsify_next::Tsify`] 派生，让 wasm-bindgen 输出的 `zukan_wasm.d.ts`
//! 里的 4 个 `decode*` 函数返回类型自动是 `PokemonGenBundle` 等具体接口，
//! 而不是 `any`。
//!
//! 字段类型、命名严格对齐 `assets/fb/README.md` §Field Reference：
//! - 有符号字段（`gender_rate / priority / meta_ailment_id / drain / healing / change`）保留 `i8`；
//! - 其余数值一律 `u8/u16/u32`；
//! - 字段一律 `#[serde(rename_all = "camelCase")]` → dts 里也是 camelCase。

use serde::Serialize;
use tsify_next::Tsify;

// ────────── PokemonGenBundle (fid = PKMB) ──────────

#[derive(Serialize, Tsify)]
#[tsify(into_wasm_abi)]
#[serde(rename_all = "camelCase")]
pub struct PokemonGenBundle {
    pub generation_id: u8,
    pub base_entries: Vec<PokemonBase>,
    pub stat_entries: Vec<PokemonStat>,
    pub type_entries: Vec<PokemonType>,
    pub ability_entries: Vec<PokemonAbility>,
    pub egg_group_entries: Vec<PokemonEggGroup>,
}

#[derive(Serialize, Tsify)]
#[tsify(into_wasm_abi)]
#[serde(rename_all = "camelCase")]
pub struct PokemonBase {
    pub id: u32,
    pub species_id: u16,
    pub is_default: bool,
    pub height: u16,
    pub weight: u16,
    pub base_experience: u16,
    pub generation_id: u8,
    pub growth_rate_id: u8,
    /// `-1` = genderless；`0..=8` = 母率 8ths
    pub gender_rate: i8,
    pub capture_rate: u8,
    pub base_happiness: u8,
    pub hatch_counter: u8,
    pub is_legendary: bool,
    pub is_mythical: bool,
    pub color_id: u8,
    pub shape_id: u8,
    pub habitat_id: u8,
}

#[derive(Serialize, Tsify)]
#[tsify(into_wasm_abi)]
#[serde(rename_all = "camelCase")]
pub struct PokemonStat {
    pub id: u32,
    pub hp: u8,
    pub attack: u8,
    pub defense: u8,
    pub special_attack: u8,
    pub special_defense: u8,
    pub speed: u8,
}

#[derive(Serialize, Tsify)]
#[tsify(into_wasm_abi)]
#[serde(rename_all = "camelCase")]
pub struct PokemonType {
    pub id: u32,
    pub type_1_id: u8,
    /// `0` = 无副属性
    pub type_2_id: u8,
}

#[derive(Serialize, Tsify)]
#[tsify(into_wasm_abi)]
#[serde(rename_all = "camelCase")]
pub struct PokemonAbility {
    pub id: u32,
    pub ability_1_id: u16,
    /// `0` = 无
    pub ability_2_id: u16,
    /// `0` = 无（第 5 代前恒为 0）
    pub ability_hidden_id: u16,
}

#[derive(Serialize, Tsify)]
#[tsify(into_wasm_abi)]
#[serde(rename_all = "camelCase")]
pub struct PokemonEggGroup {
    pub id: u32,
    pub species_id: u16,
    pub egg_group_1_id: u8,
    /// `0` = 无
    pub egg_group_2_id: u8,
}

// ────────── PokemonVgMovesBundle (fid = PMOV) ──────────

#[derive(Serialize, Tsify)]
#[tsify(into_wasm_abi)]
#[serde(rename_all = "camelCase")]
pub struct PokemonVgMovesBundle {
    pub version_group_id: u8,
    pub entries: Vec<PokemonMove>,
}

#[derive(Serialize, Tsify)]
#[tsify(into_wasm_abi)]
#[serde(rename_all = "camelCase")]
pub struct PokemonMove {
    pub pokemon_id: u32,
    pub move_id: u16,
    pub method_id: u8,
    pub level: u8,
    pub order: u8,
    pub mastery: u8,
}

// ────────── PokemonMovesBundle (fid = PMSB) ──────────

#[derive(Serialize, Tsify)]
#[tsify(into_wasm_abi)]
#[serde(rename_all = "camelCase")]
pub struct PokemonMovesBundle {
    /// `0 = COMMON`，`1 = MAINLINE_DIFF`，`2 = SPECIAL_FULL`
    pub kind: u8,
    pub version_group_id: u8,
    pub entries: Vec<PokemonMoveSet>,
}

#[derive(Serialize, Tsify)]
#[tsify(into_wasm_abi)]
#[serde(rename_all = "camelCase")]
pub struct PokemonMoveSet {
    pub pokemon_id: u32,
    pub level_up: Vec<LevelMove>,
    pub egg: Vec<u16>,
    pub tutor: Vec<u16>,
    pub machine: Vec<u16>,
    pub stadium_surfing_pikachu: Vec<u16>,
    pub light_ball_egg: Vec<u16>,
    pub colosseum_purification: Vec<u16>,
    pub xd_shadow: Vec<u16>,
    pub xd_purification: Vec<u16>,
    pub form_change: Vec<u16>,
    pub zygarde_cube: Vec<u16>,
    pub train: Vec<u16>,
}

#[derive(Serialize, Tsify)]
#[tsify(into_wasm_abi)]
#[serde(rename_all = "camelCase")]
pub struct LevelMove {
    pub level: u8,
    pub move_id: u16,
}

// ────────── MovesDataBundle (fid = MDAT) ──────────

#[derive(Serialize, Tsify)]
#[tsify(into_wasm_abi)]
#[serde(rename_all = "camelCase")]
pub struct MovesDataBundle {
    /// `0` = common baseline，`1..=32` = 各版本组
    pub version_group_id: u8,
    pub moves: Vec<Move>,
    pub move_meta: Vec<MoveMeta>,
    pub move_meta_stat_changes: Vec<MoveMetaStatChange>,
    pub move_flag_map: Vec<MoveFlagPair>,
    pub move_effects: Vec<u16>,
}

#[derive(Serialize, Tsify)]
#[tsify(into_wasm_abi)]
#[serde(rename_all = "camelCase")]
pub struct Move {
    pub id: u32,
    pub generation_id: u8,
    pub type_id: u16,
    /// `0` = 无固定伤害
    pub power: u8,
    pub pp: u8,
    /// `0` = 必中
    pub accuracy: u8,
    /// `-7..=+5`
    pub priority: i8,
    pub target_id: u8,
    /// `1=status, 2=physical, 3=special`
    pub damage_class_id: u8,
    /// `0` = 无 effect 数据
    pub effect_id: u16,
    pub effect_chance: u8,
    pub contest_type_id: u8,
    pub contest_effect_id: u8,
    pub super_contest_effect_id: u8,
}

#[derive(Serialize, Tsify)]
#[tsify(into_wasm_abi)]
#[serde(rename_all = "camelCase")]
pub struct MoveMeta {
    pub move_id: u16,
    pub meta_category_id: u8,
    /// `-1` = 随机异常
    pub meta_ailment_id: i8,
    pub min_hits: u8,
    pub max_hits: u8,
    pub min_turns: u8,
    pub max_turns: u8,
    /// 负数 = 反噬
    pub drain: i8,
    /// 负数 = 血量代价
    pub healing: i8,
    pub crit_rate: u8,
    pub ailment_chance: u8,
    pub flinch_chance: u8,
    pub stat_chance: u8,
}

#[derive(Serialize, Tsify)]
#[tsify(into_wasm_abi)]
#[serde(rename_all = "camelCase")]
pub struct MoveMetaStatChange {
    pub move_id: u16,
    pub stat_id: u8,
    /// `-2..=+3`
    pub change: i8,
}

#[derive(Serialize, Tsify)]
#[tsify(into_wasm_abi)]
#[serde(rename_all = "camelCase")]
pub struct MoveFlagPair {
    pub move_id: u32,
    pub move_flag_id: u8,
}
