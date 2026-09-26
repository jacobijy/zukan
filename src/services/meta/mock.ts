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
import type { BattleFormat, SeasonDTO, UsageResponseDTO } from './types';

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
