/**
 * 热门样本编排用例（`src/services/popularity/popularity.ts`）
 *
 * mock 热度 API 与 bundle 拉取（genForPokemonId 用真实号段表：25/6/9→gen1，
 * 906→gen9，10025 号段外→null），验证：
 * - 同代 id 只拉一次 bundle、跨代各拉一次，输出按榜单顺序；
 * - 号段外 id / bundle 找不到 / hasSprite===false 跳过（undefined 保留）；
 * - 空榜返回 []；失败清缓存可重试，成功按 limit 复用会话缓存；
 * - groupIdsByGen 纯函数保序、跳过 null 世代。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const ctrl = vi.hoisted(() => ({
    listItems: [] as unknown[],
    fetchList: vi.fn(),
}));

vi.mock('@/services/api', () => ({
    popularityApi: {
        listPokemonPopularity: vi.fn(async (limit: number) => ({
            updatedAt: '2026-10-29T10:00:00Z',
            total: ctrl.listItems.length,
            items: ctrl.listItems.slice(0, limit),
        })),
    },
}));

vi.mock('@/services/pokemon', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/services/pokemon')>();
    return {
        ...actual,
        fetchPokemonList: (...args: unknown[]) => ctrl.fetchList(...args) as Promise<IPokemonBaseModel[]>,
    };
});

import {
    clearPopularPokemonsCache,
    groupIdsByGen,
    loadPopularPokemons,
} from '@/services/popularity/popularity';
import { popularityApi } from '@/services/api';

/** 只填 service 实际读取的字段的模型构造器。 */
const model = (id: number, extra: Partial<IPokemonBaseModel> = {}): IPokemonBaseModel =>
    ({ id, speciesId: id, types: [], ...extra }) as IPokemonBaseModel;

const setBundles = (map: Record<number, IPokemonBaseModel[]>) => {
    ctrl.fetchList.mockImplementation(async (gen: number) => map[gen] ?? []);
};

beforeEach(() => {
    clearPopularPokemonsCache();
    ctrl.listItems = [];
    ctrl.fetchList.mockReset();
    setBundles({});
    vi.mocked(popularityApi.listPokemonPopularity).mockClear();
});

describe('loadPopularPokemons', () => {
    it('同代 id 只拉一次 bundle，输出按名次顺序并透传 speciesId/types', async () => {
        ctrl.listItems = [
            { rank: 1, pokemonId: 25, favoriteCount: 42 },
            { rank: 2, pokemonId: 6, favoriteCount: 38 },
            { rank: 3, pokemonId: 9, favoriteCount: 30 },
        ];
        setBundles({
            1: [
                model(25, { speciesId: 25, types: ['electric'] }),
                model(6, { speciesId: 6, types: ['fire', 'flying'] }),
                model(9, { speciesId: 9, types: ['water'] }),
            ],
        });
        const out = await loadPopularPokemons(3);
        expect(ctrl.fetchList).toHaveBeenCalledTimes(1);
        expect(ctrl.fetchList).toHaveBeenCalledWith(1, null);
        expect(out.map((p) => p.pokemonId)).toEqual([25, 6, 9]);
        expect(out[0]).toMatchObject({ rank: 1, favoriteCount: 42, speciesId: 25, types: ['electric'] });
        expect(out[2].types).toEqual(['water']);
    });

    it('跨代 id 按代各拉一次 bundle（并发去重）', async () => {
        ctrl.listItems = [
            { rank: 1, pokemonId: 25, favoriteCount: 42 },
            { rank: 9, pokemonId: 906, favoriteCount: 9 },
        ];
        setBundles({
            1: [model(25, { types: ['electric'] })],
            9: [model(906, { speciesId: 906, types: ['water'] })],
        });
        const out = await loadPopularPokemons(10);
        expect(ctrl.fetchList).toHaveBeenCalledTimes(2);
        expect(out.map((p) => p.pokemonId)).toEqual([25, 906]);
    });

    it('形态 id 无 speciesId 时回落用 pokemonId', async () => {
        ctrl.listItems = [{ rank: 1, pokemonId: 25, favoriteCount: 42 }];
        setBundles({ 1: [model(25, { speciesId: undefined, types: ['electric'] })] });
        const [out] = await loadPopularPokemons(3);
        expect(out.speciesId).toBe(25);
    });

    it('号段外 id（genForPokemonId=null）跳过；bundle 中找不到的 id 跳过', async () => {
        ctrl.listItems = [
            { rank: 1, pokemonId: 10025, favoriteCount: 50 },
            { rank: 2, pokemonId: 25, favoriteCount: 42 },
            { rank: 3, pokemonId: 6, favoriteCount: 38 },
        ];
        setBundles({ 1: [model(25, { types: ['electric'] })] });
        const out = await loadPopularPokemons(3);
        expect(out.map((p) => p.pokemonId)).toEqual([25]);
    });

    it('hasSprite===false 的形态屏蔽；undefined（缺省）保留', async () => {
        ctrl.listItems = [
            { rank: 1, pokemonId: 25, favoriteCount: 42 },
            { rank: 2, pokemonId: 6, favoriteCount: 38 },
        ];
        setBundles({
            1: [
                model(25, { hasSprite: undefined, types: ['electric'] }),
                model(6, { hasSprite: false, types: ['fire'] }),
            ],
        });
        const out = await loadPopularPokemons(3);
        expect(out.map((p) => p.pokemonId)).toEqual([25]);
    });

    it('空榜返回空数组，不拉任何 bundle', async () => {
        const out = await loadPopularPokemons(3);
        expect(out).toEqual([]);
        expect(ctrl.fetchList).not.toHaveBeenCalled();
    });

    it('请求失败向上抛且清缓存：下次调用重新请求 API', async () => {
        vi.mocked(popularityApi.listPokemonPopularity)
            .mockRejectedValueOnce(new Error('network'))
            .mockResolvedValueOnce({ updatedAt: '', total: 0, items: [] });
        await expect(loadPopularPokemons(3)).rejects.toThrow('network');
        const out = await loadPopularPokemons(3);
        expect(out).toEqual([]);
        expect(popularityApi.listPokemonPopularity).toHaveBeenCalledTimes(2);
    });

    it('成功后同 limit 复用会话缓存（API 只调一次、bundle 只拉一次）', async () => {
        ctrl.listItems = [{ rank: 1, pokemonId: 25, favoriteCount: 42 }];
        setBundles({ 1: [model(25, { types: ['electric'] })] });
        await loadPopularPokemons(3);
        await loadPopularPokemons(3);
        expect(popularityApi.listPokemonPopularity).toHaveBeenCalledTimes(1);
        expect(ctrl.fetchList).toHaveBeenCalledTimes(1);
    });
});

describe('groupIdsByGen', () => {
    it('保持入参首次出现顺序分桶，null 世代的 id 丢弃', () => {
        const genFor = (id: number): number | null => (id === 0 ? null : id % 2 === 0 ? 2 : 1);
        const buckets = groupIdsByGen([3, 2, 5, 0, 4], genFor);
        expect([...buckets.entries()]).toEqual([
            [1, [3, 5]],
            [2, [2, 4]],
        ]);
    });
});
