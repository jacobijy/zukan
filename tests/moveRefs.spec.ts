/**
 * `src/services/meta/moveRefs.ts` 用例
 *
 * 招式反查的关键是「英文名 → move id → 属性/分类」：meta 给的英文引用名与英文名称
 * 表的 enName 可能仅差空格 / 大小写 / 连字符，若只做精确相等，大量招式查不到而漏显示
 * 属性徽章。数据刻意覆盖物理 / 特殊 / 变化三种分类与不同属性。
 */
import { describe, expect, it } from 'vitest';
import { buildMoveMetaIndex, normalize, resolveMoveMeta } from '@/services/meta';
import type { MoveListRow } from '@/services/pokemon/archive';

/** 造一条招式列表行（只填本测试关心字段） */
function move(id: number, typeId: number, damageClassId: number): MoveListRow {
    return { id, typeId, damageClassId, power: 0, accuracy: 0, pp: 0, priority: 0, targetId: 0 };
}

// normal=1 fighting=2 fire=10 water=11；damageClass：1=状态 2=物理 3=特殊
const moveList: MoveListRow[] = [
    move(1, 1, 1), // 变化
    move(2, 2, 2), // 物理
    move(3, 11, 3), // 特殊
    move(4, 10, 2),
];
const enNames = new Map<number, string>([
    [1, 'Harden'],
    [2, 'Double-Edge'],
    [3, 'Hydro Pump'],
    [4, 'Flare Blitz'],
]);

describe('meta moveRefs · normalize', () => {
    it('转小写并移除空格 / 连字符', () => {
        expect(normalize('Hydro Pump')).toBe('hydropump');
        expect(normalize('Double-Edge')).toBe('doubleedge');
    });
});

describe('meta moveRefs · buildMoveMetaIndex', () => {
    const index = buildMoveMetaIndex(moveList, enNames);

    it('用英文引用名反查属性 / 分类', () => {
        expect(index.get('doubleedge')).toEqual({ typeId: 2, damageClassId: 2 });
        expect(index.get('hydropump')).toEqual({ typeId: 11, damageClassId: 3 });
        expect(index.get('harden')).toEqual({ typeId: 1, damageClassId: 1 });
    });

    it('查询侧容忍大小写 / 空格 / 连字符', () => {
        expect(index.get(normalize('  HYDRO-pump '))).toEqual({ typeId: 11, damageClassId: 3 });
        expect(index.get(normalize('flare blitz'))).toEqual({ typeId: 10, damageClassId: 2 });
    });

    it('英文名缺失的招式不入表', () => {
        const partial = new Map<number, string>([[2, 'Double-Edge']]);
        const i = buildMoveMetaIndex(moveList, partial);
        expect(i.size).toBe(1);
        expect(i.get('harden')).toBeUndefined();
    });

    it('规范化后碰撞时先到先得', () => {
        const collideList = [move(7, 1, 1), move(8, 2, 2)];
        const collideNames = new Map<number, string>([
            [7, 'X-Y'],
            [8, 'XY'],
        ]);
        expect(buildMoveMetaIndex(collideList, collideNames).get('xy')).toEqual({
            typeId: 1,
            damageClassId: 1,
        });
    });

    it('查无返回 undefined', () => {
        expect(index.get('nonexistent')).toBeUndefined();
    });
});

describe('meta moveRefs · resolveMoveMeta', () => {
    it('ensureMoveRefs 完成前 / 查无返回 undefined（不触发资源加载）', () => {
        expect(resolveMoveMeta('Double-Edge')).toBeUndefined();
    });
});
