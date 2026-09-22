/**
 * 伤害浮动范围与击杀概率（纯 TS，无 WASM / uni 依赖）。
 *
 * 输入是 `calculateDamageBatch` 的 16 个随机伤害值 —— 对应游戏内 0.85–1.00 的
 * 16 档随机倍率，每档等概率（1/16）。据此：
 * - 伤害比例给一个 **min% – max%** 的浮动区间，而不是只看最大伤害；
 * - OHKO：单下伤害 ≥ 目标 HP 的档位数 / 16；
 * - 两击击杀：两次独立抽取的伤害之和 ≥ HP 的有序档位对数 / 256（即「两下内
 *   击倒」的概率，天然不低于 OHKO —— 第一下就击倒也算在两下内）。
 *
 * 同一档位即使因取整出现相同伤害，仍是不同的随机结果，按档位（而非去重值）计数。
 */

/** 把单条伤害折算成占目标 HP 的百分比，封顶 100（≥100 即保证击倒） */
function percentOf(damage: number, hp: number): number {
    return Math.min(100, Math.round((damage / hp) * 100));
}

/** 伤害占 HP 的浮动百分比区间（min – max）；HP 非法或无档位时为 0–0。 */
export function damagePercentRange(rolls: readonly number[], hp: number): { min: number; max: number } {
    if (hp <= 0 || rolls.length === 0) return { min: 0, max: 0 };
    let min = Infinity;
    let max = -Infinity;
    for (const d of rolls) {
        if (d < min) min = d;
        if (d > max) max = d;
    }
    return { min: percentOf(min, hp), max: percentOf(max, hp) };
}

/** 一击必杀概率（0..1）：单下伤害 ≥ HP 的档位占比。 */
export function ohkoChance(rolls: readonly number[], hp: number): number {
    if (hp <= 0 || rolls.length === 0) return 0;
    let n = 0;
    for (const d of rolls) if (d >= hp) n++;
    return n / rolls.length;
}

/**
 * 两击击杀概率（0..1）：两次独立随机伤害之和 ≥ HP 的有序档位对占比。
 * 含第一下即击倒的情形（这对组合的和必然 ≥ HP），即「两下内击倒」。
 */
export function twoHitKoChance(rolls: readonly number[], hp: number): number {
    if (hp <= 0 || rolls.length === 0) return 0;
    let ko = 0;
    for (const a of rolls) {
        for (const b of rolls) {
            if (a + b >= hp) ko++;
        }
    }
    return ko / (rolls.length * rolls.length);
}

/** 概率转 0..100 整数百分比 */
export function toPercent(chance: number): number {
    return Math.round(chance * 100);
}
