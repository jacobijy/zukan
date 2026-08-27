/**
 * 能力值计算器：性格表与能力维度常量
 *
 * 性格修正值与 WASM `calculator::calculate_nature_mod` **刻意不一致** ——
 * 那张表有多处错误（如 Lonely/Brave 减项互换、Jolly 误写成 +特攻），
 * 但伤害计算器从不传性格（恒 100）所以没暴露。能力值计算器里性格是核心，
 * 这里用经核对的官方口径：性格提升一项能力 ×1.1、降低一项 ×0.9，
 * 5 种中性性格全 100。
 *
 * 名称不在这里硬编码：显示名走 i18n 内容 bundle（`i18nStore.natureName(pokeId)`，
 * 与招式/特性同一套，自动双语），bundle 未就绪时回落英文 slug。
 */

import type { StatKey } from './statcalc-engine';

/** 六项能力，展示顺序固定 HP → 攻击 → 防御 → 特攻 → 特防 → 速度 */
export const STAT_KEYS: StatKey[] = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];

export interface NatureDef {
    /** WASM `calculate_nature_mod` 使用的性格 id（0..24，按攻击提升分组排序） */
    id: number;
    /** pokeapi 性格 id（1..25），用于查 i18n 内容 bundle 的性格名 */
    pokeId: number;
    /** 英文 slug，bundle 缺失时回落显示（首字母大写） */
    slug: string;
    /** 性格修正：提升项 110 / 降低项 90；中性性格为空对象。hp 永不出现。 */
    mods: Partial<Record<StatKey, number>>;
}

/** 25 种性格；id 与 WASM 对齐，pokeId 与 pokeapi/natures.json 对齐，mods 为核对后的正确值 */
export const NATURES: NatureDef[] = [
    { id: 0, pokeId: 1, slug: 'hardy', mods: {} },
    { id: 1, pokeId: 6, slug: 'lonely', mods: { atk: 110, def: 90 } },
    { id: 2, pokeId: 21, slug: 'brave', mods: { atk: 110, spe: 90 } },
    { id: 3, pokeId: 11, slug: 'adamant', mods: { atk: 110, spa: 90 } },
    { id: 4, pokeId: 17, slug: 'naughty', mods: { atk: 110, spd: 90 } },
    { id: 5, pokeId: 2, slug: 'bold', mods: { def: 110, atk: 90 } },
    { id: 6, pokeId: 7, slug: 'docile', mods: {} },
    { id: 7, pokeId: 22, slug: 'relaxed', mods: { def: 110, spe: 90 } },
    { id: 8, pokeId: 12, slug: 'impish', mods: { def: 110, spa: 90 } },
    { id: 9, pokeId: 18, slug: 'lax', mods: { def: 110, spd: 90 } },
    { id: 10, pokeId: 3, slug: 'modest', mods: { spa: 110, atk: 90 } },
    { id: 11, pokeId: 8, slug: 'mild', mods: { spa: 110, def: 90 } },
    { id: 12, pokeId: 25, slug: 'serious', mods: {} },
    { id: 13, pokeId: 23, slug: 'quiet', mods: { spa: 110, spe: 90 } },
    { id: 14, pokeId: 15, slug: 'rash', mods: { spa: 110, spd: 90 } },
    { id: 15, pokeId: 4, slug: 'calm', mods: { spd: 110, atk: 90 } },
    { id: 16, pokeId: 9, slug: 'gentle', mods: { spd: 110, def: 90 } },
    { id: 17, pokeId: 24, slug: 'sassy', mods: { spd: 110, spe: 90 } },
    { id: 18, pokeId: 14, slug: 'careful', mods: { spd: 110, spa: 90 } },
    { id: 19, pokeId: 5, slug: 'timid', mods: { spe: 110, atk: 90 } },
    { id: 20, pokeId: 10, slug: 'hasty', mods: { spe: 110, def: 90 } },
    { id: 21, pokeId: 16, slug: 'jolly', mods: { spe: 110, spa: 90 } },
    { id: 22, pokeId: 20, slug: 'naive', mods: { spe: 110, spd: 90 } },
    { id: 23, pokeId: 13, slug: 'bashful', mods: {} },
    { id: 24, pokeId: 19, slug: 'quirky', mods: {} },
];

/** 默认性格：勤奋（Hardy，中性） */
export const DEFAULT_NATURE_ID = 0;

export function getNature(id: number): NatureDef {
    return NATURES.find((n) => n.id === id) ?? NATURES[0];
}

/** 某性格对某项能力的修正值（90/100/110）；HP 恒 100 */
export function natureModFor(natureId: number, key: StatKey): number {
    if (key === 'hp') return 100;
    return getNature(natureId).mods[key] ?? 100;
}
