/**
 * 能力值计算引擎（纯 TS，无 WASM / uni 依赖）
 *
 * 能力值公式与 WASM `calculator::calculate_stat` / `calculate_hp` 完全同构，
 * 这里独立成纯函数是因为：
 *   1. 能力值是确定性整数运算，不需要 WASM 的 TypeChart / 随机批量；
 *   2. vitest 跑在 node，加载不了 WASM，纯函数才能直接单测；
 *   3. 性格修正是能力值计算器的核心，逐维传入修正值，不依赖 WASM 那张
 *      有错的性格表（见 statcalc-options.ts 的 NATURES）。
 *
 * 世代口径：Gen 3+（现行公式）。
 */

/** 六项能力的短键（HP 与其余五项公式不同，且不受性格修正） */
export type StatKey = 'hp' | 'atk' | 'def' | 'spa' | 'spd' | 'spe';

/** store model 里 stats 数组使用的能力名（见 services/pokemon/pokemon.ts） */
const STAT_LABEL_BY_KEY: Record<StatKey, string> = {
    hp: 'HP',
    atk: '攻击',
    def: '防御',
    spa: '特攻',
    spd: '特防',
    spe: '速度',
};

/** stats 数组按短键取种族值；缺失时回落到 50（未知宝可梦的中庸值，与 calc-engine 一致） */
export function getBaseStat(stats: { name: string; value: number }[], key: StatKey): number {
    const label = STAT_LABEL_BY_KEY[key];
    const found = stats.find((s) => (label === 'HP' ? s.name.includes('HP') : s.name === label));
    return found?.value ?? 50;
}

/** 单项努力值上限 252，总和上限 510 */
export const MAX_EV_PER_STAT = 252;
export const MAX_EV_TOTAL = 510;
/** 单项个体值上限 31 */
export const MAX_IV = 31;

export function clampIv(iv: number): number {
    return Math.max(0, Math.min(MAX_IV, Math.round(iv)));
}

export function clampEv(ev: number): number {
    return Math.max(0, Math.min(MAX_EV_PER_STAT, Math.round(ev)));
}

/**
 * HP 能力值：
 *   floor((2*base + iv + floor(ev/4)) * level / 100) + level + 10
 * Shedinja（hp 种族值 1）固定为 1，这里不特殊处理——调用方可据结果自行兜底。
 */
export function calcHp(base: number, level: number, iv: number, ev: number): number {
    const b = base | 0;
    const i = clampIv(iv);
    const e = clampEv(ev);
    const l = clampLevel(level);
    return Math.floor(((2 * b + i + Math.floor(e / 4)) * l) / 100) + l + 10;
}

/**
 * 非 HP 能力值：
 *   floor((floor((2*base + iv + floor(ev/4)) * level / 100) + 5) * nature / 100)
 * natureMod：90=降低 10%，100=持平，110=提升 10%。
 */
export function calcOtherStat(base: number, level: number, iv: number, ev: number, natureMod: number): number {
    const b = base | 0;
    const i = clampIv(iv);
    const e = clampEv(ev);
    const l = clampLevel(level);
    const n = natureMod | 0;
    const core = Math.floor(((2 * b + i + Math.floor(e / 4)) * l) / 100) + 5;
    return Math.floor((core * n) / 100);
}

/** 按短键分派：HP 走 HP 公式且无视性格，其余五项走性格修正公式 */
export function calcStat(key: StatKey, base: number, level: number, iv: number, ev: number, natureMod = 100): number {
    if (key === 'hp') return calcHp(base, level, iv, ev);
    return calcOtherStat(base, level, iv, ev, natureMod);
}

export function clampLevel(level: number): number {
    return Math.max(1, Math.min(100, Math.round(level)));
}

export interface StatInput {
    key: StatKey;
    base: number;
    iv: number;
    ev: number;
}

/** 一次性算六项；natureMods 按短键给性格修正（hp 位忽略） */
export function calcAllStats(
    level: number,
    inputs: StatInput[],
    natureMods: Partial<Record<StatKey, number>>,
): Record<StatKey, number> {
    const result = {} as Record<StatKey, number>;
    for (const { key, base, iv, ev } of inputs) {
        result[key] = calcStat(key, base, level, iv, ev, natureMods[key] ?? 100);
    }
    return result;
}

// ─── Pokémon Champions 能力点（SP）模式 ─────────────────────────────
// Champions 取消 IV（恒为满个体 31）、取消等级差（对战固定 Lv50），
// 努力值改为「能力点 SP」：每只 66 SP、单项上限 32，1 SP 在 Lv50 直接 +1 能力。
// 性格改名 Stat Alignment，仍是 ±10%。来源：champsdex 攻略，公式为社区推断口径。

/** 能力点固定对战等级 */
export const CHAMPION_LEVEL = 50;
/** 每只宝可梦可分配的 SP 总量 */
export const MAX_SP_TOTAL = 66;
/** 单项 SP 硬上限 */
export const MAX_SP_PER_STAT = 32;
/** SP 1:1 加到能力值上，步进为 1 */
export const SP_STEP = 1;

export function clampSp(sp: number): number {
    return Math.max(0, Math.min(MAX_SP_PER_STAT, Math.round(sp)));
}

/**
 * Champions HP：
 *   floor((2*base + 31) * 50 / 100) + 50 + 10 + SP
 * 即满个体 Lv50 的传统 HP（无努力）再 1:1 加 SP。
 */
export function calcChampHp(base: number, sp: number): number {
    return Math.floor(((2 * (base | 0) + 31) * CHAMPION_LEVEL) / 100) + CHAMPION_LEVEL + 10 + clampSp(sp);
}

/**
 * Champions 非 HP 能力：
 *   floor((floor((2*base + 31) * 50 / 100) + 5 + SP) * alignment / 100)
 * SP 先加进核心值，再整体乘性格修正（与传统 IV/EV 公式同构，ev 项恒为 0）。
 */
export function calcChampOtherStat(base: number, sp: number, alignmentMod: number): number {
    const core = Math.floor(((2 * (base | 0) + 31) * CHAMPION_LEVEL) / 100) + 5 + clampSp(sp);
    return Math.floor((core * (alignmentMod | 0)) / 100);
}

/** 按短键分派 Champions 能力值（HP 不受 alignment 修正） */
export function calcChampStat(key: StatKey, base: number, sp: number, alignmentMod = 100): number {
    if (key === 'hp') return calcChampHp(base, sp);
    return calcChampOtherStat(base, sp, alignmentMod);
}
