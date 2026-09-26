/**
 * 对战数据 adapter 用例（`src/services/meta/adapter.ts`）
 *
 * 纯函数、node 环境零 stub。覆盖：降序、0..1→百分比、相对榜首的 barWidth、
 * 无效行（id<=0 / 负或 NaN 使用率）过滤、当前赛季置顶。
 */
import { describe, expect, it } from 'vitest';
import { toSeasonList, toUsageRanking } from '@/services/meta/adapter';
import type { SeasonDTO, UsageResponseDTO } from '@/services/meta/types';

describe('toUsageRanking', () => {
    const dto: UsageResponseDTO = {
        season_id: 'cur',
        entries: [
            { species_id: 3, usage_rate: 0.1 },
            { species_id: 1, usage_rate: 0.3 },
            { species_id: 2, usage_rate: 0.2 },
            { species_id: 0, usage_rate: 0.9 }, // 无效 id，滤掉
            { species_id: 4, usage_rate: -0.1 }, // 负使用率，滤掉
            { species_id: 5, usage_rate: Number.NaN }, // 非有限值，滤掉
        ],
    };

    it('滤掉无效行并按使用率降序', () => {
        const rows = toUsageRanking(dto);
        expect(rows.map((r) => r.speciesId)).toEqual([1, 2, 3]);
    });

    it('usage_rate 0..1 → 百分比（保留 1 位小数）', () => {
        const rows = toUsageRanking(dto);
        expect(rows.map((r) => r.usageRate)).toEqual([30, 20, 10]);
    });

    it('barWidth 相对榜首：榜首=100，其余按比例', () => {
        const rows = toUsageRanking(dto);
        expect(rows.map((r) => r.barWidth)).toEqual([100, 66.7, 33.3]);
    });

    it('空榜单返回空数组', () => {
        expect(toUsageRanking({ season_id: 'x', entries: [] })).toEqual([]);
    });
});

describe('toSeasonList', () => {
    const seasons: SeasonDTO[] = [
        { id: 'a', label: 'A', is_current: false },
        { id: 'b', label: 'B', is_current: true },
        { id: 'c', label: 'C', is_current: false },
    ];

    it('当前赛季置顶，其余保持输入顺序', () => {
        const list = toSeasonList(seasons);
        expect(list.map((s) => s.id)).toEqual(['b', 'a', 'c']);
        expect(list[0]).toMatchObject({ id: 'b', isCurrent: true });
    });
});
