/**
 * 图鉴反查索引用例（`src/services/pokemon/archive.ts`）
 *
 * 两个重点（变异测试查出过的盲区类型）：
 * - **双属性宝可梦必须同时进两个属性索引**（OR）；单属性数据上 some/every 等价，
 *   测不出双属性漏聚合。
 * - 只取默认形态（isDefault）并按 speciesId 去重：gen bundle 是全形态快照，
 *   非默认形态（超进化/地区形态）不能把同一物种重复计入。
 * - 特性三个槽位（普特 1/2 + 隐藏）都计入。
 */
import { describe, expect, it } from 'vitest';
import { buildAbilityIndex, buildMoveList, buildTypePokemonIndex } from '@/services/pokemon/archive';
import type { Move } from '@/infra/wasm';

describe('buildTypePokemonIndex', () => {
    const base = [
        { id: 1, speciesId: 1, isDefault: true }, // 妙蛙种子：草+毒（双属性）
        { id: 2, speciesId: 2, isDefault: true }, // 喷火龙：火
        { id: 3, speciesId: 3, isDefault: true }, // 尼多王：毒（单属性，跨分页边界）
        { id: 10006, speciesId: 6, isDefault: false }, // 喷火龙 Mega X：非默认形态，忽略
    ];
    const types = [
        { id: 1, type1Id: 12, type2Id: 4 }, // 草=12 毒=4
        { id: 2, type1Id: 10, type2Id: 0 }, // 火=10
        { id: 3, type1Id: 4, type2Id: 0 }, // 毒=4
        { id: 10006, type1Id: 10, type2Id: 17 }, // Mega 喷 X 火+恶，应被忽略
    ];

    it('双属性宝可梦同时进两个属性索引（OR 聚合）', () => {
        const idx = buildTypePokemonIndex({ base, types });
        expect(idx.get('grass')).toEqual([1]);
        expect(idx.get('poison')?.toSorted((a, b) => a - b)).toEqual([1, 3]);
    });

    it('非默认形态不参与聚合（按 speciesId 去重）', () => {
        const idx = buildTypePokemonIndex({ base, types });
        // Mega 喷 X 的恶属性不应带入任何物种
        expect(idx.get('dark')).toBeUndefined();
        // 火属性只有物种 2，Mega X（speciesId=6 重复且非默认）不加入
        expect(idx.get('fire')).toEqual([2]);
    });
});

describe('buildAbilityIndex', () => {
    const base = [
        { id: 1, speciesId: 1, isDefault: true },
        { id: 2, speciesId: 2, isDefault: true },
        { id: 10006, speciesId: 6, isDefault: false },
    ];
    const abilities = [
        { id: 1, ability1Id: 65, ability2Id: 0, abilityHiddenId: 0 }, // 茂盛=65
        { id: 2, ability1Id: 66, ability2Id: 0, abilityHiddenId: 94 }, // 烈火 + 太阳之力(隐)
        { id: 10006, ability1Id: 66, ability2Id: 0, abilityHiddenId: 0 }, // 非默认，忽略
    ];

    it('三个特性槽位都计入反查', () => {
        const idx = buildAbilityIndex({ base, abilities });
        expect(idx.get(65)).toEqual([1]);
        expect(idx.get(66)).toEqual([2]);
        // 隐藏特性槽位
        expect(idx.get(94)).toEqual([2]);
    });

    it('非默认形态不进特性索引', () => {
        const idx = buildAbilityIndex({ base, abilities });
        // speciesId 6 的 Mega 形态被忽略：特性 66 只关联物种 2
        expect(idx.get(66)).toEqual([2]);
    });
});

describe('buildMoveList', () => {
    it('滤掉 id<=0 占位行并按 id 升序', () => {
        const moves = [
            { id: 30, typeId: 1, power: 0, accuracy: 0, pp: 30, priority: 0, damageClassId: 1, targetId: 1 },
            { id: 0, typeId: 0, power: 0, accuracy: 0, pp: 0, priority: 0, damageClassId: 0, targetId: 0 },
            { id: -1, typeId: 0, power: 0, accuracy: 0, pp: 0, priority: 0, damageClassId: 0, targetId: 0 },
            { id: 10, typeId: 10, power: 90, accuracy: 100, pp: 15, priority: 0, damageClassId: 3, targetId: 10 },
        ] as Move[];
        const list = buildMoveList(moves);
        expect(list.map((m) => m.id)).toEqual([10, 30]);
        expect(list[0]).toMatchObject({ id: 10, typeId: 10, power: 90, damageClassId: 3 });
    });
});
