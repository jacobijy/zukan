/**
 * popular 纯函数用例：invertNameMap（id→名 反转）/ toNatureSlug（英文名→合法 slug）。
 * buildPopularPatch 走网络编排（resourceManager + meta），不在 node 单测覆盖。
 */
import { describe, expect, it } from 'vitest';
import { invertNameMap, toNatureSlug } from '@/services/teams/popular';

describe('invertNameMap', () => {
    it('名→id，跳过空名', () => {
        const m = new Map<number, string>([
            [1, 'Adamant'],
            [2, ''],
            [3, 'Serious'],
        ]);
        const out = invertNameMap(m);
        expect(out.get('Adamant')).toBe(1);
        expect(out.get('Serious')).toBe(3);
        expect(out.size).toBe(2);
    });
});

describe('toNatureSlug', () => {
    it('大小写 / 空白归一，命中 Champions 21 种', () => {
        expect(toNatureSlug('Adamant')).toBe('adamant');
        expect(toNatureSlug('  timid ')).toBe('timid');
        expect(toNatureSlug('Serious')).toBe('serious');
    });

    it('被移除性格 / 非字符串 → null', () => {
        expect(toNatureSlug('Hardy')).toBeNull(); // 真实性格但 Champions 已移除
        expect(toNatureSlug(123)).toBeNull();
        expect(toNatureSlug(null)).toBeNull();
    });
});
