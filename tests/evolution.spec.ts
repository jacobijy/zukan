/**
 * 进化链构建纯函数用例（`src/services/pokemon/evolution.ts`）
 *
 * 守护三件事：
 * 1. 从链中任意节点都能上溯到根再展开（不只是根入口）；
 * 2. 线性链的 level 被提取到边上；
 * 3. 分支（伊布一家）生成多个 children，且道具触发填 triggerText 而非 level。
 *
 * 抽样数据对齐 docs/data/bundle-decode.md §EVO1：
 * 妙蛙种子(1)→妙蛙草(2,Lv? )→妙蛙花(3, minimumLevel=32)；
 * 伊布(133)→水伊布(134, triggerItem=84) / 雷伊布(135)。
 */
import { describe, expect, it } from 'vitest';
import { buildEvolutionChain, type EvolutionResolvers } from '@/services/pokemon';
import type { EvolutionBundle, EvolutionDetail, EvolutionEdge, EvolutionSpecies } from '@/infra/wasm';

function species(partial: Partial<EvolutionSpecies>): EvolutionSpecies {
    return { parentSpecies: 0, chainId: 0, edgeStart: 0, edgeCount: 0, ...partial };
}
function edge(partial: Partial<EvolutionEdge>): EvolutionEdge {
    return { targetSpecies: 0, detailStart: 0, detailCount: 0, ...partial };
}
function detail(partial: Partial<EvolutionDetail>): EvolutionDetail {
    return {
        triggerItem: 0, heldItem: 0, knownMove: 0, partySpecies: 0, tradeSpecies: 0,
        location: 0, minimumSteps: 0, minimumDamageTaken: 0, evolvedForm: 0, baseForm: 0,
        versionGroupId: 0, triggerId: 0, knownMoveType: 0, partyType: 0, gender: 0,
        timeOfDay: 0, minimumLevel: 0, minimumHappiness: 0, minimumBeauty: 0,
        minimumAffection: 0, relativePhysicalStats: 0, minimumMoveCount: 0, region: 0, flags: 0,
        ...partial,
    } as EvolutionDetail;
}

/** species 数组按下标 = speciesId-1 排列；构造时按 id 稀疏填充 */
function bundle(specs: Record<number, EvolutionSpecies>, edges: EvolutionEdge[], details: EvolutionDetail[]): EvolutionBundle {
    const maxId = Math.max(...Object.keys(specs).map(Number));
    const speciesArr: EvolutionSpecies[] = [];
    for (let i = 1; i <= maxId; i++) {
        speciesArr[i - 1] = specs[i] ?? species({});
    }
    return { species: speciesArr, edges, details };
}

const resolvers: EvolutionResolvers = {
    defaultPokemonId: (sid) => sid,
    speciesName: (sid) => `species-${sid}`,
    itemName: (id) => (id === 84 ? '水之石' : null),
    moveName: () => null,
    triggerName: (id) => (id === 3 ? '使用道具' : null),
    regionName: () => null,
};

describe('buildEvolutionChain', () => {
    it('从中间节点上溯到根并展开线性链，level 落在目标节点', () => {
        // 1 → 2 → 3（3 的触发等级 32）
        const b = bundle(
            {
                1: species({ edgeStart: 0, edgeCount: 1 }),
                2: species({ parentSpecies: 1, edgeStart: 1, edgeCount: 1 }),
                3: species({ parentSpecies: 2 }),
            },
            [
                edge({ targetSpecies: 2, detailStart: 0, detailCount: 1 }),
                edge({ targetSpecies: 3, detailStart: 1, detailCount: 1 }),
            ],
            [detail({}), detail({ minimumLevel: 32 })],
        );

        const root = buildEvolutionChain(b, 2, resolvers); // 从妙蛙草进入
        expect(root?.id).toBe(1);
        expect(root?.children).toHaveLength(1);
        const ivysaur = root!.children![0];
        expect(ivysaur.id).toBe(2);
        expect(ivysaur.level).toBeUndefined(); // 种子→草无等级要求
        const venusaur = ivysaur.children![0];
        expect(venusaur.id).toBe(3);
        expect(venusaur.level).toBe(32);
    });

    it('分支进化生成多个 children，道具触发填 triggerText', () => {
        // 伊布(133) → 水伊布(134, 水之石) / 雷伊布(135, 雷之石不在 resolver → 回落触发器名)
        const b = bundle(
            { 133: species({ edgeStart: 0, edgeCount: 2 }), 134: species({ parentSpecies: 133 }), 135: species({ parentSpecies: 133 }) },
            [
                edge({ targetSpecies: 134, detailStart: 0, detailCount: 1 }),
                edge({ targetSpecies: 135, detailStart: 1, detailCount: 1 }),
            ],
            [
                detail({ triggerId: 3, triggerItem: 84 }),
                detail({ triggerId: 3, triggerItem: 99 }), // 99 在 itemName 里返回 null
            ],
        );

        const root = buildEvolutionChain(b, 133, resolvers);
        expect(root?.id).toBe(133);
        expect(root?.children?.map((c) => c.id)).toEqual([134, 135]);
        const vaporeon = root!.children!.find((c) => c.id === 134)!;
        expect(vaporeon.triggerText).toContain('水之石');
        expect(vaporeon.level).toBeUndefined();
    });

    it('孤立物种返回只含自己的单节点', () => {
        const b = bundle({ 500: species({}) }, [], []);
        const root = buildEvolutionChain(b, 500, resolvers);
        expect(root?.id).toBe(500);
        expect(root?.children).toBeUndefined();
    });

    it('越界 speciesId 返回 null', () => {
        const b = bundle({ 1: species({}) }, [], []);
        expect(buildEvolutionChain(b, 9999, resolvers)).toBeNull();
        expect(buildEvolutionChain(b, 0, resolvers)).toBeNull();
    });

    it('优先取 is_default 那条 detail（跨版本组多条时）', () => {
        // 同一条边两条 detail：旧版本无等级、新版本 is_default + 等级 16
        const b = bundle(
            {
                1: species({ edgeStart: 0, edgeCount: 1 }),
                2: species({ parentSpecies: 1 }),
            },
            [edge({ targetSpecies: 2, detailStart: 0, detailCount: 2 })],
            [
                detail({ minimumLevel: 0, flags: 0 }),
                detail({ minimumLevel: 16, flags: 0x10 }),
            ],
        );
        const root = buildEvolutionChain(b, 1, resolvers);
        expect(root!.children![0].level).toBe(16);
    });
});
