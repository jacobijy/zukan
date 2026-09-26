/**
 * 对战数据 mock —— 后端缺席期的唯一数据出口。
 *
 * ⚠️ 后端接口就绪后删除本文件（或停止引用）：把 `service.ts` 的取数改为真实
 * `metaApi.getUsage()` 即可，页面与 adapter 无需改动。
 *
 * 本模块刻意返回 **DTO 形态**（而非 UI 模型），使「取数 → adapter 转换」整条链路
 * 在 mock 期就被真实跑通；数据按赛制各给 30 条（跨越虚拟列表分页边界）、
 * 1 个当前赛季 + 2 个历史赛季。
 */
import type { BattleFormat, CategoryUsageEntryDTO, PokemonMetaResponseDTO, SeasonDTO, UsageResponseDTO } from './types';

/** [speciesId, 基础使用率(0..1)]，已按当前赛季降序 */
const SINGLES_TABLE: ReadonlyArray<readonly [number, number]> = [
    [1000, 0.342],
    [983, 0.318],
    [887, 0.286],
    [987, 0.271],
    [645, 0.255],
    [445, 0.231],
    [1005, 0.218],
    [984, 0.205],
    [485, 0.192],
    [815, 0.181],
    [979, 0.17],
    [892, 0.158],
    [990, 0.147],
    [248, 0.136],
    [980, 0.128],
    [591, 0.119],
    [1006, 0.11],
    [637, 0.101],
    [150, 0.094],
    [658, 0.087],
    [778, 0.08],
    [6, 0.073],
    [94, 0.067],
    [130, 0.06],
    [149, 0.054],
    [212, 0.048],
    [257, 0.042],
    [282, 0.037],
    [350, 0.032],
    [392, 0.027],
];

const DOUBLES_TABLE: ReadonlyArray<readonly [number, number]> = [
    [876, 0.312],
    [591, 0.298],
    [641, 0.272],
    [984, 0.255],
    [1000, 0.238],
    [547, 0.221],
    [198, 0.205],
    [987, 0.188],
    [645, 0.172],
    [887, 0.158],
    [445, 0.144],
    [983, 0.132],
    [485, 0.121],
    [990, 0.11],
    [892, 0.099],
    [248, 0.089],
    [637, 0.08],
    [815, 0.072],
    [979, 0.064],
    [1005, 0.057],
    [1006, 0.05],
    [658, 0.044],
    [778, 0.038],
    [6, 0.033],
    [94, 0.028],
    [149, 0.023],
    [212, 0.019],
    [130, 0.015],
    [257, 0.011],
    [350, 0.008],
];

function tableOf(format: BattleFormat): ReadonlyArray<readonly [number, number]> {
    return format === 'doubles' ? DOUBLES_TABLE : SINGLES_TABLE;
}

/** 赛季列表（两种赛制一致） */
export function mockSeasons(_format: BattleFormat): SeasonDTO[] {
    return [
        { id: 'cur', label: '2026 · 第三赛季', is_current: true },
        { id: 's2', label: '2026 · 第二赛季', is_current: false },
        { id: 's1', label: '2025 · 第一赛季', is_current: false },
    ];
}

/** 历史赛季整体使用率略低于当前，便于切换时看出差异 */
const SEASON_FACTOR: Record<string, number> = { cur: 1, s2: 0.9, s1: 0.8 };

/** 某赛制 × 赛季的使用率响应（DTO） */
export function mockUsageResponse(format: BattleFormat, seasonId: string): UsageResponseDTO {
    const factor = SEASON_FACTOR[seasonId] ?? 1;
    const entries = tableOf(format).map(([species_id, rate]) => ({
        species_id,
        usage_rate: Math.round(rate * factor * 10000) / 10000,
    }));
    return { season_id: seasonId, entries };
}

// ── 宝可梦对战配置（招式 / 道具 / 特性选用率）──

/** 安全池取连续小 id：名称表与道具图标覆盖好，任意 speciesId 点进去都能解析出名字 */
const ABILITY_POOL = range(1, 40);
const ITEM_POOL = range(1, 40);
const MOVE_POOL = range(1, 60);

/** 某赛制 × 赛季 × 宝可梦的配置选用率响应（DTO）；确定性伪随机，入参变化结果随之变 */
export function mockPokemonMeta(speciesId: number, format: BattleFormat, seasonId: string): PokemonMetaResponseDTO {
    const rng = mulberry32(hashSeed(speciesId, format, seasonId));
    return {
        species_id: speciesId,
        format,
        season_id: seasonId,
        // 特性基本必选：榜首 70–98%；道具 25–60%；招式 35–70%
        abilities: categoryEntries(ABILITY_POOL, 1 + Math.floor(rng() * 3), rng, 0.7 + rng() * 0.28),
        items: categoryEntries(ITEM_POOL, 6 + Math.floor(rng() * 5), rng, 0.25 + rng() * 0.35),
        moves: categoryEntries(MOVE_POOL, 8 + Math.floor(rng() * 5), rng, 0.35 + rng() * 0.35),
    };
}

function categoryEntries(pool: number[], n: number, rng: () => number, topScale: number): CategoryUsageEntryDTO[] {
    const ids = pickN(pool, n, rng);
    // 随机权重降序后归一化，使榜首=topScale
    const weights = ids.map(() => 0.25 + rng() * 0.75).sort((a, b) => b - a);
    const max = weights[0];
    return ids.map((id, i) => ({
        id,
        usage_rate: Math.round((weights[i] / max) * topScale * 10000) / 10000,
    }));
}

/** 从池中无重复抽 n 个（部分 Fisher–Yates） */
function pickN(pool: number[], n: number, rng: () => number): number[] {
    const arr = [...pool];
    for (let i = 0; i < n; i++) {
        const j = i + Math.floor(rng() * (arr.length - i));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr.slice(0, n);
}

function range(from: number, to: number): number[] {
    return Array.from({ length: to - from + 1 }, (_, i) => from + i);
}

/** FNV-1a 组合哈希 → 32bit 种子 */
function hashSeed(...parts: Array<number | string>): number {
    let h = 2166136261 >>> 0;
    for (const p of parts) {
        for (const c of String(p)) {
            h ^= c.charCodeAt(0);
            h = Math.imul(h, 16777619);
        }
    }
    return h >>> 0;
}

/** mulberry32 确定性 PRNG */
function mulberry32(seed: number): () => number {
    let a = seed;
    return () => {
        a |= 0;
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
