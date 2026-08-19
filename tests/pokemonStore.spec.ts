/**
 * store 的「筛选 → 分页」接线用例（`src/store/pokemon.ts`）
 *
 * `dexFilter.spec.ts` 只能证明纯函数本身正确；它无法发现 store 把顺序接反。
 * 而本次修的 bug 恰恰是**顺序**问题：先分页再筛选 → 选任意非第一世代得到空列表
 * → 容器无内容 → 滚动不触发 → `loadMore` 永不执行 → 死锁。
 *
 * 所以这里断言的是 store 暴露的 `matchedPokemons` / `visibleList` / `hasMore`
 * 之间的关系，尤其是「首屏 20 条之外的条件也能出结果」。
 * （变异测试验证过：去掉本文件，把 store 倒回先分页再筛选不会被任何用例发现。）
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { GENERATIONS } from '@/constants/generations';

const TYPES = ['grass', 'fire', 'water', 'electric', 'psychic'];

const atk = (p: IPokemonBaseModel) => p.stats.find((s) => s.name === '攻击')?.value ?? 0;

/** 与 bundle 一致：1025 只默认形态，id 从 1 连续排布 */
function roster(count = 1025): IPokemonBaseModel[] {
    return Array.from({ length: count }, (_, i) => {
        const id = i + 1;
        return {
            id,
            speciesId: id,
            isDefault: true,
            name: `pokemon-${id}`,
            types: [TYPES[id % TYPES.length]],
            abilities: [],
            hiddenAbility: '',
            eggGroups: [],
            image: '',
            description: '',
            moves: [],
            evolutionChain: [],
            stats: [
                { name: 'HP', value: (id * 7) % 160 + 20 },
                { name: '攻击', value: (id * 13) % 180 + 10 },
                { name: '防御', value: (id * 29) % 150 + 15 },
            ],
        } satisfies IPokemonBaseModel;
    });
}

const fetchPokemonList = vi.fn();

vi.mock('@/services/pokemon', () => ({ fetchPokemonList: (...args: unknown[]) => fetchPokemonList(...args) }));
vi.mock('@/services/api', () => ({
    favoritesApi: {
        addFavorite: vi.fn().mockResolvedValue(undefined),
        removeFavorite: vi.fn().mockResolvedValue(undefined),
        mergeFavorites: vi.fn().mockResolvedValue([]),
    },
}));
vi.mock('@/services/session', () => ({ isAuthenticated: () => false }));

/** 起一个已载入全量数据的 store */
async function loadedStore() {
    vi.resetModules();
    setActivePinia(createPinia());
    vi.stubGlobal('uni', {
        getStorageSync: () => '',
        setStorageSync: () => undefined,
        removeStorageSync: () => undefined,
    });
    fetchPokemonList.mockResolvedValue(roster());
    const { usePokemonStore } = await import('@/store/pokemon');
    const store = usePokemonStore();
    await store.fetchPokemon();
    return store;
}

describe('store 筛选', () => {
    beforeEach(() => {
        fetchPokemonList.mockReset();
    });

    it('载入后命中数是全量', async () => {
        const store = await loadedStore();
        expect(store.matchedCount).toBe(1025);
        expect(store.matchedPokemons).toHaveLength(1025);
    });

    // 死锁回归：每一代都必须有结果
    it.each(GENERATIONS.map((g) => [g.value, g.start, g.end] as const))(
        '筛 %s 后有结果（旧实现在此死锁）',
        async (value, start, end) => {
            const store = await loadedStore();
            store.setCriteria({ generation: value });

            expect(store.matchedCount).toBeGreaterThan(0);
            expect(store.matchedPokemons.length).toBeGreaterThan(0);
            expect(store.matchedPokemons.every((p) => p.id >= start && p.id <= end)).toBe(true);
        },
    );

    it('排序作用于全量：首条是全表最高攻击', async () => {
        const store = await loadedStore();
        store.setCriteria({ sort: 'attack' });

        const globalMax = Math.max(...store.allPokemons.map(atk));
        expect(atk(store.matchedPokemons[0])).toBe(globalMax);
    });

    it('仅收藏能看到列表靠后的条目', async () => {
        const store = await loadedStore();
        store.toggleFavorite(900);
        store.setCriteria({ favoritesOnly: true });

        expect(store.matchedCount).toBe(1);
        expect(store.matchedPokemons.map((p) => p.id)).toEqual([900]);
    });

    it('搜索命中列表靠后的条目', async () => {
        const store = await loadedStore();
        store.setCriteria({ query: '1025' });

        expect(store.matchedCount).toBe(1);
        expect(store.matchedPokemons.map((p) => p.id)).toEqual([1025]);
    });

    it('不再分页：matchedPokemons 一次给出全部命中（虚拟列表自己开窗口）', async () => {
        const store = await loadedStore();
        expect(store.matchedPokemons).toHaveLength(1025);

        store.setCriteria({ generation: 'gen6' });
        expect(store.matchedPokemons).toHaveLength(store.matchedCount);
        expect(store.matchedPokemons).toHaveLength(72);
    });

    it('无匹配时结果为空', async () => {
        const store = await loadedStore();
        store.setCriteria({ query: 'zzz-nonexistent' });

        expect(store.matchedCount).toBe(0);
        expect(store.matchedPokemons).toHaveLength(0);
    });

    it('条件切换后结果立刻整体更新，不残留上一次的片段', async () => {
        const store = await loadedStore();
        store.setCriteria({ generation: 'gen1' });
        expect(store.matchedPokemons.every((p) => p.id <= 151)).toBe(true);

        store.setCriteria({ generation: 'gen9' });
        expect(store.matchedPokemons.every((p) => p.id >= 906)).toBe(true);
        expect(store.matchedPokemons).toHaveLength(120);
    });

    it('收藏变化即时反映到筛选结果', async () => {
        const store = await loadedStore();
        store.setCriteria({ favoritesOnly: true });
        expect(store.matchedCount).toBe(0);

        store.toggleFavorite(500);
        expect(store.matchedCount).toBe(1);

        store.toggleFavorite(500);
        expect(store.matchedCount).toBe(0);
    });
});
