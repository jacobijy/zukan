//! 伤害计算器模块
//! 高性能伤害计算，集成类型克制、天气、场地、特性等所有修正因子。

use wasm_bindgen::prelude::*;
use serde::{Serialize, Deserialize};

// ============================================================
// 枚举常量（TYPE_* / WEATHER_* / TERRAIN_* / ABILITY_*）
// 由 `build.rs` 从 `src/static/enums/*.json` 生成，与前端共用一份 slug→id 表。
// 更新数据只改 JSON，不动 Rust 代码。
// ============================================================
include!(concat!(env!("OUT_DIR"), "/gen_enums.rs"));

// ============================================================
// 招式标志位 (MoveFlags 位掩码)
// ============================================================
// 位序是 Rust ↔ JS 的 ABI 契约（`src/pages/calc/calc-engine.ts` 的 MOVE_FLAG 与本表对齐）。
// 与 `src/static/enums/move_flags.json` 里的 pokeapi flag id 不同 —— 那是数据表的行号，
// 前端负责在运行时把 flag id 翻成这里的 bit（见 calc-engine.ts::WASM_FLAG_BITS）。
pub const MOVE_FLAG_CONTACT: u16 = 1 << 0;   // 接触类
pub const MOVE_FLAG_PUNCH: u16 = 1 << 1;    // 拳类 (铁拳 Iron Fist 检查)
pub const MOVE_FLAG_BITE: u16 = 1 << 2;     // 啃咬类 (强壮之颚 Strong Jaw 检查)
pub const MOVE_FLAG_SOUND: u16 = 1 << 3;    // 声音类
pub const MOVE_FLAG_PULSE: u16 = 1 << 4;    // 波动类 (Mega Launcher 检查)
pub const MOVE_FLAG_POWDER: u16 = 1 << 5;   // 粉末类
pub const MOVE_FLAG_BULLET: u16 = 1 << 6;   // 子弹类
pub const MOVE_FLAG_HEAL: u16 = 1 << 7;     // 回复类

// ============================================================
// 防御方道具 (Defender item)
// 与攻击方道具不同：攻击道具走 item_mod 平乘伤害（前端 calc-options 硬编码倍率），
// 防御道具是带触发条件的行为（加防能力值 / 克制时减伤），在公式内按 id 分支处理。
// 无 pokeapi 道具表入库，这里是 Rust↔JS 的 ABI 契约（同 MOVE_FLAG），
// 数字 id 必须与 `src/pages/calc/calc-options.ts::DEF_ITEM_OPTIONS.wasmId` 对齐。
// ============================================================
pub const DEF_ITEM_NONE: u8 = 0;
pub const DEF_ITEM_EVIOLITE: u8 = 1;      // 进化奇石：物防 ×1.5 且 特防 ×1.5
pub const DEF_ITEM_ASSAULT_VEST: u8 = 2;  // 突击背心：仅特防 ×1.5
pub const DEF_ITEM_RESIST_BERRY: u8 = 3;  // 抗性树果：被克制时受到伤害 ×0.5

// ============================================================
// 属性克制表
// 索引: [defender_pm_id][attacker_pm_id]
// 值: 0=1x, 1=2x(弱), 2=0.5x(抵抗), 3=0x(免疫)
// 来自 src/core/data/typechart.ts
// ============================================================
#[rustfmt::skip]
pub const TYPE_CHART: [[u8; 20]; 20] = [
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], // 0: Invalid
    [0, 0, 1, 0, 0, 0, 0, 0, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], // 1: Normal
    [0, 0, 0, 1, 0, 0, 2, 2, 0, 0, 0, 0, 0, 0, 1, 0, 0, 2, 1, 0], // 2: Fighting
    [0, 0, 2, 0, 0, 3, 1, 2, 0, 0, 0, 0, 2, 1, 0, 1, 0, 0, 0, 0], // 3: Flying
    [0, 0, 2, 0, 2, 1, 0, 2, 0, 0, 0, 0, 2, 0, 1, 0, 0, 0, 2, 0], // 4: Poison
    [0, 0, 0, 0, 2, 0, 2, 0, 0, 0, 0, 1, 1, 3, 0, 1, 0, 0, 0, 0], // 5: Ground
    [0, 2, 1, 2, 2, 1, 0, 0, 0, 1, 2, 1, 1, 0, 0, 0, 0, 0, 0, 0], // 6: Rock
    [0, 0, 2, 1, 0, 2, 1, 0, 0, 0, 1, 0, 2, 0, 0, 0, 0, 0, 0, 0], // 7: Bug
    [0, 3, 3, 0, 2, 0, 0, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0], // 8: Ghost
    [0, 2, 1, 2, 3, 1, 2, 2, 0, 2, 1, 0, 2, 0, 2, 2, 2, 0, 2, 0], // 9: Steel
    [0, 0, 0, 0, 0, 1, 1, 2, 0, 2, 2, 1, 2, 0, 0, 2, 0, 0, 2, 0], // 10: Fire
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 2, 1, 1, 0, 2, 0, 0, 0, 0], // 11: Water
    [0, 0, 0, 1, 1, 2, 0, 1, 0, 0, 1, 2, 2, 2, 0, 1, 0, 0, 0, 0], // 12: Grass
    [0, 0, 0, 2, 0, 1, 0, 0, 0, 2, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0], // 13: Electric
    [0, 0, 2, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 2, 0, 0, 1, 0, 0], // 14: Psychic
    [0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 0, 0, 2, 0, 0, 0, 0], // 15: Ice
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 2, 2, 0, 1, 1, 0, 1, 0], // 16: Dragon
    [0, 0, 1, 0, 0, 0, 0, 1, 2, 0, 0, 0, 0, 0, 3, 0, 0, 2, 1, 0], // 17: Dark
    [0, 0, 2, 0, 1, 0, 0, 2, 0, 1, 0, 0, 0, 0, 0, 0, 3, 2, 0, 0], // 18: Fairy
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], // 19: Stellar
];

// ============================================================
// 类型定义
// ============================================================

/// 伤害计算输入
#[wasm_bindgen]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DamageInput {
    /// 攻击方等级 (1-100)
    level: u8,
    /// 攻击方对应的攻击/特攻能力值
    attack: u16,
    /// 防御方对应的防御/特防能力值
    defense: u16,
    /// 技能基础威力
    base_power: u8,

    /// 招式属性 (PokemonType 1-19)
    move_type: u8,
    /// 招式类别: 0=Physical, 1=Special
    move_category: u8,

    /// 攻击方属性1 (PokemonType, 0=无)
    attacker_type1: u8,
    /// 攻击方属性2 (PokemonType, 0=无)
    attacker_type2: u8,
    /// 防御方属性1 (PokemonType, 0=无)
    defender_type1: u8,
    /// 防御方属性2 (PokemonType, 0=无)
    defender_type2: u8,

    /// 天气 (Weather enum 0-8)
    weather: u8,
    /// 场地 (Terrain enum 0-4)
    terrain: u8,

    /// 攻击方特性 (AbilityId, 0=无)
    attacker_ability: u16,
    /// 防御方特性 (AbilityId, 0=无)
    defender_ability: u16,

    /// 是否会心一击 (0=否, 1=是)
    is_critical: u8,
    /// 是否烧伤 (0=否, 1=是)
    is_burned: u8,

    /// 能力等级: 攻击方物攻等级 (-6 ~ 6)
    attacker_atk_stage: i8,
    /// 能力等级: 攻击方特攻等级 (-6 ~ 6)
    attacker_spa_stage: i8,
    /// 能力等级: 防御方物防等级 (-6 ~ 6)
    defender_def_stage: i8,
    /// 能力等级: 防御方特防等级 (-6 ~ 6)
    defender_spd_stage: i8,

    /// 招式标志位位掩码 (MOVE_FLAG_*)
    move_flags: u16,

    /// 道具修正 (100=1x, 50=0.5x, 等)
    item_mod: u8,
    /// 防御方道具 id (DEF_ITEM_*；0=无)
    defender_item: u8,
    /// 随机种子 (0-15, 对应 85-100%)
    seed: u8,
}

#[wasm_bindgen]
impl DamageInput {
    #[wasm_bindgen(constructor)]
    pub fn new(
        level: u8,
        attack: u16,
        defense: u16,
        base_power: u8,
        move_type: u8,
        move_category: u8,
        attacker_type1: u8,
        attacker_type2: u8,
        defender_type1: u8,
        defender_type2: u8,
        weather: u8,
        terrain: u8,
        attacker_ability: u16,
        defender_ability: u16,
        is_critical: u8,
        is_burned: u8,
        move_flags: u16,
    ) -> Self {
        Self {
            level, attack, defense, base_power,
            move_type, move_category,
            attacker_type1, attacker_type2,
            defender_type1, defender_type2,
            weather, terrain,
            attacker_ability, defender_ability,
            is_critical, is_burned,
            attacker_atk_stage: 0,
            attacker_spa_stage: 0,
            defender_def_stage: 0,
            defender_spd_stage: 0,
            move_flags,
            item_mod: 100,
            defender_item: DEF_ITEM_NONE,
            seed: 0,
        }
    }

    /// 设置攻击方物攻等级
    #[wasm_bindgen(js_name = withAttackerAtkStage)]
    pub fn with_attacker_atk_stage(&mut self, stage: i8) {
        self.attacker_atk_stage = stage.clamp(-6, 6);
    }

    /// 设置攻击方特攻等级
    #[wasm_bindgen(js_name = withAttackerSpaStage)]
    pub fn with_attacker_spa_stage(&mut self, stage: i8) {
        self.attacker_spa_stage = stage.clamp(-6, 6);
    }

    /// 设置防御方物防等级
    #[wasm_bindgen(js_name = withDefenderDefStage)]
    pub fn with_defender_def_stage(&mut self, stage: i8) {
        self.defender_def_stage = stage.clamp(-6, 6);
    }

    /// 设置防御方特防等级
    #[wasm_bindgen(js_name = withDefenderSpdStage)]
    pub fn with_defender_spd_stage(&mut self, stage: i8) {
        self.defender_spd_stage = stage.clamp(-6, 6);
    }

    #[wasm_bindgen(js_name = withItemMod)]
    pub fn with_item_mod(&mut self, item_mod: u8) {
        self.item_mod = item_mod;
    }

    /// 设置防御方道具 id（DEF_ITEM_*）
    #[wasm_bindgen(js_name = withDefenderItem)]
    pub fn with_defender_item(&mut self, defender_item: u8) {
        self.defender_item = defender_item;
    }

    #[wasm_bindgen(js_name = withSeed)]
    pub fn with_seed(&mut self, seed: u8) {
        self.seed = seed;
    }
}

/// 批量伤害计算结果
#[wasm_bindgen]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchDamageResult {
    min: u16,
    max: u16,
    average: f64,
    rolls: Vec<u16>,
}

#[wasm_bindgen]
impl BatchDamageResult {
    #[wasm_bindgen(getter)]
    pub fn min(&self) -> u16 { self.min }

    #[wasm_bindgen(getter)]
    pub fn max(&self) -> u16 { self.max }

    #[wasm_bindgen(getter)]
    pub fn average(&self) -> f64 { self.average }

    #[wasm_bindgen(js_name = getRolls)]
    pub fn get_rolls(&self) -> Vec<u16> {
        self.rolls.clone()
    }
}

// ============================================================
// 伤害计算核心函数
// ============================================================

/// 计算属性克制倍率（合并双属性）
fn calc_type_effectiveness(move_type: u8, def_type1: u8, def_type2: u8) -> u16 {
    if def_type1 == 0 && def_type2 == 0 {
        return 100; // 1x
    }

    let mut mult_100 = 100u16; // 以 1/100 为单位

    for &def_type in &[def_type1, def_type2] {
        if def_type == 0 || def_type >= 20 { continue; }
        let chart_val = TYPE_CHART[def_type as usize][move_type as usize];

        match chart_val {
            0 => {}      // 1x → 不变
            1 => {}      // 2x → 乘以2
            2 => {}      // 0.5x → 除以2
            3 => { return 0; } // 0x → 免疫
            _ => {}
        }

        // 转换为以 100 为基数的累乘/累除
        match chart_val {
            1 => { mult_100 = mult_100.saturating_mul(2); }
            2 => { mult_100 = mult_100.saturating_div(2); }
            _ => {}
        }
    }

    mult_100.min(400)
}

/// 能力等级 → 倍率 (以 100=1x 为单位)
/// 等级 | 倍率
/// -6   | 25 (2/8)
/// -5   | 29 (2/7 ≈ 28.57)
/// -4   | 33 (2/6 ≈ 33.33)
/// -3   | 40 (2/5)
/// -2   | 50 (2/4)
/// -1   | 67 (2/3 ≈ 66.67)
///  0   | 100 (2/2)
/// +1   | 150 (3/2)
/// +2   | 200 (4/2)
/// +3   | 250 (5/2)
/// +4   | 300 (6/2)
/// +5   | 350 (7/2)
/// +6   | 400 (8/2)
fn stat_stage_multiplier(stage: i8) -> u16 {
    match stage {
        -6 => 25,
        -5 => 29,
        -4 => 33,
        -3 => 40,
        -2 => 50,
        -1 => 67,
        0 => 100,
        1 => 150,
        2 => 200,
        3 => 250,
        4 => 300,
        5 => 350,
        6 => 400,
        _ => 100,
    }
}

/// 计算 STAB（本系加成）
fn calc_stab(move_type: u8, atk_type1: u8, atk_type2: u8, ability: u16) -> u16 {
    let has_type = (atk_type1 > 0 && atk_type1 == move_type) ||
                   (atk_type2 > 0 && atk_type2 == move_type);
    if !has_type { return 100; }

    // 适应力
    if ability == ABILITY_ADAPTABILITY { return 200; }
    150 // 1.5x
}

/// 计算天气修正
fn calc_weather_mod(weather: u8, move_type: u8) -> u16 {
    match weather {
        WEATHER_RAIN_DANCE | WEATHER_PRIMORDIAL_SEA => {
            if move_type == TYPE_WATER { return 150; }  // ×1.5
            if move_type == TYPE_FIRE { return 50; }     // ×0.5
        }
        WEATHER_SUNNY_DAY | WEATHER_DESOLATE_LAND => {
            if move_type == TYPE_FIRE { return 150; }    // ×1.5
            if move_type == TYPE_WATER { return 50; }     // ×0.5
        }
        _ => {}
    }
    100 // 1x
}

/// 计算场地修正
fn calc_terrain_mod(terrain: u8, move_type: u8, _move_category: u8) -> u16 {
    match terrain {
        TERRAIN_ELECTRIC if move_type == TYPE_ELECTRIC => 133, // ×1.33 (近似 4/3)
        TERRAIN_GRASSY if move_type == TYPE_GRASS => 133,      // ×1.33
        TERRAIN_GRASSY if move_type == TYPE_GROUND => 50,      // ×0.5
        TERRAIN_MISTY if move_type == TYPE_DRAGON => 50,       // ×0.5
        TERRAIN_PSYCHIC if move_type == TYPE_PSYCHIC => 133,   // ×1.33
        _ => 100, // 1x
    }
}

/// 计算攻击方特性修正（以 100=1x 为单位）
/// 使用 AbilityId.ts 中的数值 ID
fn lookup_attacker_ability(ability: u16, move_type: u8, base_power: u8, move_flags: u16) -> u16 {
    match ability {
        // ── 直接倍率类 ──
        ABILITY_HUGE_POWER | ABILITY_PURE_POWER => 200,
        ABILITY_HUSTLE => 150,
        ABILITY_GUTS => 150,

        // ── 属性增伤类（HP<1/3时×1.5，简化直接生效） ──
        ABILITY_OVERGROW if move_type == TYPE_GRASS => 150,
        ABILITY_BLAZE if move_type == TYPE_FIRE => 150,
        ABILITY_TORRENT if move_type == TYPE_WATER => 150,
        ABILITY_SWARM if move_type == TYPE_BUG => 150,

        // ── 铁拳：拳类招式×1.2 ──
        ABILITY_IRON_FIST if (move_flags & MOVE_FLAG_PUNCH) != 0 => 120,

        // ── 强壮之颚：啃咬类×1.5 ──
        ABILITY_STRONG_JAW if (move_flags & MOVE_FLAG_BITE) != 0 => 150,

        // ── Mega Launcher：波动类×1.5 ──
        ABILITY_MEGA_LAUNCHER if (move_flags & MOVE_FLAG_PULSE) != 0 => 150,

        // ── 硬爪：接触招式×1.3 ──
        ABILITY_TOUGH_CLAWS if (move_flags & MOVE_FLAG_CONTACT) != 0 => 130,

        // ── 龙颚：龙系×1.5 ──
        ABILITY_DRAGONS_MAW if move_type == TYPE_DRAGON => 150,

        // ── 分析：最后行动时×1.3（简化直接生效） ──
        ABILITY_ANALYTIC => 130,

        // ── 颓废：HP<50%时×0.5（简化直接生效） ──
        ABILITY_DEFEATIST => 50,

        // ── 慢启动：×0.5（简化直接生效） ──
        ABILITY_SLOW_START => 50,

        // ── 技术高手：威力≤60时×1.5 ──
        ABILITY_TECHNICIAN if base_power <= 60 => 150,

        // ── 皮肤类（变属性+×1.2，STAB已在外部处理属性变更） ──
        ABILITY_REFRIGERATE if move_type == TYPE_ICE => 120,
        ABILITY_PIXILATE if move_type == TYPE_FAIRY => 120,
        ABILITY_AERILATE if move_type == TYPE_FLYING => 120,
        ABILITY_GALVANIZE if move_type == TYPE_ELECTRIC => 120,

        _ => 100,
    }
}

/// 计算防御方特性修正（以 100=1x 为单位）
fn calc_defender_ability_mod(
    ability: u16,
    move_type: u8,
    move_category: u8,
    move_flags: u16,
    is_super_effective: bool,
) -> u16 {
    match ability {
        // 厚脂肪: 火/冰 ×0.5
        ABILITY_THICK_FAT if move_type == TYPE_FIRE || move_type == TYPE_ICE => 50,

        // 过滤 / 坚石 / 棱镜装甲: 效果绝佳时 ×0.75
        ABILITY_FILTER | ABILITY_SOLID_ROCK | ABILITY_PRISM_ARMOR if is_super_effective => 75,

        // 多重鳞片 / 暗影护盾: ×0.5
        ABILITY_MULTISCALE | ABILITY_SHADOW_SHIELD => 50,

        // 毛皮大衣: 物攻 ×0.5
        ABILITY_FUR_COAT if move_category == 0 => 50,

        // 冰鳞粉: 特攻 ×0.5
        ABILITY_ICE_SCALES if move_category == 1 => 50,

        // 毛茸茸: 接触物攻 ×0.5, 火 ×2
        ABILITY_FLUFFY if move_type == TYPE_FIRE => 200,
        ABILITY_FLUFFY if move_category == 0 && (move_flags & MOVE_FLAG_CONTACT) != 0 => 50,

        // 耐火: 火 ×0.5
        ABILITY_HEATPROOF if move_type == TYPE_FIRE => 50,

        _ => 100,
    }
}

// ============================================================
// 主伤害计算
// ============================================================

/// 第 5-9 代伤害计算公式
/// 返回伤害值 0-65535
pub fn calculate_damage(input: &DamageInput) -> u16 {
    let l = u32::from(input.level);

    // ─── 特性交互预处理 ───
    // 破格类: 无视防御方特性
    let ignore_def_ability = matches!(input.attacker_ability, ABILITY_MOLD_BREAKER | ABILITY_TURBOBLAZE | ABILITY_TERAVOLT);
    // 化学变化气体: 压制所有特性
    let ngas_active = input.attacker_ability == ABILITY_NEUTRALIZING_GAS || input.defender_ability == ABILITY_NEUTRALIZING_GAS;
    // 无关天气 / 气闸: 压制天气
    let ignore_weather = (input.attacker_ability == ABILITY_CLOUD_NINE || input.attacker_ability == ABILITY_AIR_LOCK) &&
                         !ngas_active;

    // 有效防御方特性（被破格或化学气体压制时为 0）
    let effective_def_ability = if ignore_def_ability || ngas_active { 0 } else { input.defender_ability };
    // 有效攻击方特性（被化学气体压制时为 0）
    let effective_atk_ability = if ngas_active { 0 } else { input.attacker_ability };

    // 纯朴 攻击方: 无视防御方能力等级
    let ignore_def_stages = effective_atk_ability == ABILITY_UNAWARE && !ngas_active;
    // 纯朴 防御方: 无视攻击方能力等级
    let ignore_atk_stages = effective_def_ability == ABILITY_UNAWARE && !ngas_active;

    // 选择对应能力等级
    let (raw_atk_stage, raw_def_stage) = if input.move_category == 0 {
        (input.attacker_atk_stage, input.defender_def_stage)
    } else {
        (input.attacker_spa_stage, input.defender_spd_stage)
    };

    // 有效能力等级: 纯朴/会心影响
    let atk_stage = if ignore_atk_stages { 0 } else { raw_atk_stage };
    let def_stage = if ignore_def_stages { 0 } else { raw_def_stage };

    // 会心一击 Gen 6+: 忽略攻击方正面等级，防御方等级正常生效
    let effective_atk_stage = if input.is_critical != 0 && atk_stage > 0 { 0 } else { atk_stage };
    // 防御方等级在会心时正常生效（Gen 6+ 规则）
    let effective_def_stage = def_stage;

    let a = u32::from(input.attack) * u32::from(stat_stage_multiplier(effective_atk_stage)) / 100;

    // 防御道具的能力值加成：进化奇石(物防+特防 ×1.5) / 突击背心(仅特防 ×1.5)。
    // input.defense 已是按招式类别选好的防御值（物防 or 特防），故突击背心只在
    // 特殊招式（move_category==1，命中特防）时生效；加成作用于能力值，再叠能力等级。
    let def_item_stat_mod: u16 = match input.defender_item {
        DEF_ITEM_EVIOLITE => 150,
        DEF_ITEM_ASSAULT_VEST if input.move_category == 1 => 150,
        _ => 100,
    };
    let def_with_item = u32::from(input.defense) * u32::from(def_item_stat_mod) / 100;
    let d = def_with_item * u32::from(stat_stage_multiplier(effective_def_stage)) / 100;
    let p = u32::from(input.base_power);
    let seed = u32::from(input.seed);

    // 基础公式: ((2L/5 + 2) × A × P / D / 50) + 2
    let mut damage = ((2 * l / 5 + 2) * a * p / d) / 50 + 2;
    if damage < 1 { damage = 1; }

    // ─── STAB 修正 ───
    let stab = calc_stab(input.move_type, input.attacker_type1, input.attacker_type2, effective_atk_ability);
    damage = damage * u32::from(stab) / 100;

    // ─── 属性克制 ───
    let type_eff = calc_type_effectiveness(input.move_type, input.defender_type1, input.defender_type2);
    if type_eff == 0 {
        return 0; // 免疫
    }
    damage = damage * u32::from(type_eff) / 100;

    // ─── 天气修正（无关天气/气闸压制） ───
    let weather_mod = if ignore_weather { 100 } else { calc_weather_mod(input.weather, input.move_type) };
    damage = damage * u32::from(weather_mod) / 100;

    // ─── 场地修正 ───
    let terrain_mod = calc_terrain_mod(input.terrain, input.move_type, input.move_category);
    damage = damage * u32::from(terrain_mod) / 100;

    // ─── 攻击方特性修正 ───
    let atk_ability_mod = lookup_attacker_ability(
        effective_atk_ability, input.move_type, input.base_power, input.move_flags,
    );
    damage = damage * u32::from(atk_ability_mod) / 100;

    // ─── 防御方特性修正 ───
    let is_super_effective = type_eff >= 200;
    let def_ability_mod = calc_defender_ability_mod(
        effective_def_ability,
        input.move_type,
        input.move_category,
        input.move_flags,
        is_super_effective,
    );
    damage = damage * u32::from(def_ability_mod) / 100;

    // ─── 防御道具：抗性树果（被克制时受伤 ×0.5） ───
    // 只在效果绝佳（type_eff ≥ 2×）时触发；与攻击道具的 item_mod 独立。
    if input.defender_item == DEF_ITEM_RESIST_BERRY && is_super_effective {
        damage = damage * 50 / 100;
    }

    // ─── 会心一击 (×1.5) ───
    if input.is_critical != 0 {
        damage = damage * 150 / 100;
    }

    // ─── 烧伤修正 (物攻×0.5) ───
    // 毅力覆盖烧伤: 不受烧伤减攻，反而获得 ×1.5 加成（已在 lookup_attacker_ability 中处理）
    let has_guts = effective_atk_ability == ABILITY_GUTS;
    if input.is_burned != 0 && input.move_category == 0 && !has_guts {
        damage = damage * 50 / 100;
    }

    // ─── 道具修正 ───
    damage = damage * u32::from(input.item_mod) / 100;

    // ─── 随机数范围 85-100% ───
    let random = seed % 16 + 85;
    damage = damage * random / 100;

    damage.min(65535) as u16
}

/// 批量计算所有随机值的伤害范围
pub fn calculate_damage_batch(input: &DamageInput) -> BatchDamageResult {
    let mut sum = 0u32;
    let mut min_dmg = u16::MAX;
    let mut max_dmg = 0u16;
    let mut rolls = Vec::with_capacity(16);

    for i in 0..16 {
        let mut temp_input = input.clone();
        temp_input.seed = i;
        let dmg = calculate_damage(&temp_input);
        sum += u32::from(dmg);
        min_dmg = min_dmg.min(dmg);
        max_dmg = max_dmg.max(dmg);
        rolls.push(dmg);
    }

    let average = sum as f64 / 16.0;

    BatchDamageResult { min: min_dmg, max: max_dmg, average, rolls }
}

/// 计算能力值（非 HP）
pub fn calculate_stat(level: u8, base: u16, iv: u8, ev: u8, nature_mod: u8) -> u16 {
    let b = u32::from(base);
    let i = u32::from(iv);
    let e = u32::from(ev);
    let l = u32::from(level);
    let n = u32::from(nature_mod);

    let base_stat = (2 * b + i + e / 4) * l / 100;
    ((base_stat + 5) * n / 100) as u16
}

/// 计算 HP 能力值
pub fn calculate_hp(level: u8, base: u16, iv: u8, ev: u8) -> u16 {
    let b = u32::from(base);
    let i = u32::from(iv);
    let e = u32::from(ev);
    let l = u32::from(level);

    (((2 * b + i + e / 4) * l / 100) + l + 10) as u16
}

/// 性格修正值查询
/// 0-24: 性格ID，返回 [atk, def, spa, spd, spe] 修正值 (90/100/110)
pub fn calculate_nature_mod(nature_id: u8) -> [u8; 5] {
    match nature_id {
        0 => [100, 100, 100, 100, 100], // Hardy
        1 => [110, 100, 100, 100, 90],  // Lonely
        2 => [110, 90, 100, 100, 100],  // Brave
        3 => [110, 100, 90, 100, 100],  // Adamant
        4 => [110, 100, 100, 90, 100],  // Naughty
        5 => [90, 110, 100, 100, 100],  // Bold
        6 => [100, 100, 100, 100, 100], // Docile
        7 => [100, 110, 100, 100, 90],  // Relaxed
        8 => [100, 110, 90, 100, 100],  // Impish
        9 => [100, 110, 100, 90, 100],  // Lax
        10 => [90, 100, 100, 110, 100], // Modest
        11 => [100, 90, 100, 110, 100], // Mild
        12 => [100, 100, 100, 100, 100],// Serious
        13 => [100, 100, 110, 90, 100], // Quiet
        14 => [100, 100, 100, 110, 90], // Rash
        15 => [90, 100, 100, 100, 110], // Calm
        16 => [100, 90, 100, 100, 110], // Gentle
        17 => [100, 100, 90, 100, 110], // Sassy
        18 => [100, 100, 100, 90, 110], // Careful
        19 => [90, 100, 100, 100, 100], // Timid
        20 => [100, 90, 100, 100, 100], // Hasty
        21 => [100, 100, 110, 100, 100],// Jolly
        22 => [100, 100, 100, 100, 90], // Naive
        23 => [100, 100, 100, 100, 100],// Bashful
        24 => [100, 100, 100, 100, 100],// Quirky
        _ => [100, 100, 100, 100, 100],
    }
}
