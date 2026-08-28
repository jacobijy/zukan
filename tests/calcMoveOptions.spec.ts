/**
 * 计算器招式池构建用例（`src/pages/calc/calc-options.ts::toCalcMoveOptions`）
 *
 * 守护：只留物理/特殊伤害招（状态、威力非正、未知分类都滤掉）、按 moveId 去重
 * （同一招可能升级+机器重复）、名称经 nameOf 查表并在缺名时回落 move-{id}。
 */
import { describe, expect, it } from 'vitest';
import { toCalcMoveOptions } from '@/pages/calc/calc-options';

function rec(partial: Partial<MoveRecord> & Pick<MoveRecord, 'id'>): MoveRecord {
    return {
        name: '',
        type: 'normal',
        categoryId: 3, // 特殊（move_damage_classes：1=状态 2=物理 3=特殊）
        power: 80,
        accuracy: 100,
        learnMethod: 'level-up',
        ...partial,
    };
}

const nameOf = (id: number): string | null => (id === 7 ? '火焰拳' : null);

describe('toCalcMoveOptions', () => {
    it('把物理/特殊伤害招映射成选项，并转换分类', () => {
        const out = toCalcMoveOptions(
            [
                rec({ id: 1, categoryId: 2, power: 120, type: 'fire' }),
                rec({ id: 2, categoryId: 3, power: 90, type: 'water' }),
            ],
            nameOf,
        );
        expect(out).toHaveLength(2);
        expect(out[0]).toMatchObject({ id: 1, power: 120, type: 'fire', category: 'physical' });
        expect(out[1]).toMatchObject({ id: 2, power: 90, type: 'water', category: 'special' });
    });

    it('滤掉状态招、未知分类与威力非正的招', () => {
        const out = toCalcMoveOptions(
            [
                rec({ id: 10, categoryId: 1 }), // 剑舞之类，无伤害
                rec({ id: 11, categoryId: 0 }),
                rec({ id: 12, categoryId: 3, power: '—' }), // 威力显示 '—'（如反击）
                rec({ id: 13, categoryId: 3, power: 0 }),
                rec({ id: 14, categoryId: 2, power: 65 }),
            ],
            nameOf,
        );
        expect(out.map((m) => m.id)).toEqual([14]);
    });

    it('同一 moveId 跨学习方式去重，保留首次出现', () => {
        const out = toCalcMoveOptions(
            [
                rec({ id: 5, categoryId: 3, power: 90, learnMethod: 'level-up' }),
                rec({ id: 5, categoryId: 3, power: 90, learnMethod: 'machine' }),
                rec({ id: 5, categoryId: 3, power: 90, learnMethod: 'egg' }),
            ],
            nameOf,
        );
        expect(out).toHaveLength(1);
    });

    it('名称优先查 nameOf，查不到回落 move-{id}', () => {
        const out = toCalcMoveOptions(
            [rec({ id: 7, categoryId: 2, power: 75 }), rec({ id: 999, categoryId: 3, power: 80 })],
            nameOf,
        );
        expect(out[0].name).toBe('火焰拳');
        expect(out[1].name).toBe('move-999');
    });
});
