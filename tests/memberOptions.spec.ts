/**
 * member-options 纯函数用例：buildAbilityIds / dedupeMoveRecords。
 * 网络加载器（require resourceManager + DEK）不在 node 单测覆盖，与 archive/moves 测试策略一致。
 */
import { describe, expect, it } from 'vitest';
import { buildAbilityIds, dedupeMoveRecords } from '@/services/teams/member-options';

describe('buildAbilityIds', () => {
    it('正 id 保留；0 / 负值 → null', () => {
        expect(buildAbilityIds({ id: 25, ability1Id: 7, ability2Id: 0, abilityHiddenId: 21 })).toEqual({
            ability1: 7,
            ability2: null,
            hidden: 21,
        });
        expect(buildAbilityIds({ id: 1, ability1Id: -3, ability2Id: 2, abilityHiddenId: 0 })).toEqual({
            ability1: null,
            ability2: 2,
            hidden: null,
        });
    });

    it('undefined → 全 null', () => {
        expect(buildAbilityIds(undefined)).toEqual({ ability1: null, ability2: null, hidden: null });
    });
});

const rec = (id: number, method: MoveRecord['learnMethod']) =>
    ({ id, learnMethod: method }) as unknown as MoveRecord;

describe('dedupeMoveRecords', () => {
    it('同 id 保留首次出现，保序', () => {
        const pool = [rec(1, 'level-up'), rec(2, 'machine'), rec(1, 'tutor'), rec(3, 'egg'), rec(2, 'level-up')];

        const out = dedupeMoveRecords(pool);
        expect(out.map((r) => r.id)).toEqual([1, 2, 3]);
        // 首次出现的学习方式被保留
        expect(out[0]).toMatchObject({ id: 1, learnMethod: 'level-up' });
    });

    it('空数组', () => {
        expect(dedupeMoveRecords([])).toEqual([]);
    });
});
