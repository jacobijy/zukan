/**
 * `src/utils/dexFilter.ts` 用例
 *
 * 守的是曾经真实发生过的 bug：筛选/排序作用在**分页后的 20 条**上，导致选任意
 * 非第一世代就得到空列表 → 容器无内容 → 滚动不触发 → `loadMore` 永不执行 → 死锁。
 *
 * 因此这里刻意用**跨越多页的数据集**（1025 条，远超 pageSize 20）：
 * 只在前 20 条内成立的实现会立刻失败。
 */
import { describe, expect, it } from 'vitest';
import { filterAndSortPokemons, type DexSortKey } from '@/utils/dexFilter';
import { GENERATIONS } from '@/constants/generations';

const TYPES = ['grass', 'fire', 'water', 'electric', 'psychic'];

/**
 * 造 1025 只默认形态，数值用取模散开以便断言排序。
 *
 * 每 3 只给一个副属性 —— 单属性数据集下 `some` 与 `every` 在长度 1 的数组上
 * 等价，属性多选的 OR/AND 语义测不出区别（变异测试发现过这个盲区）。
 */
function makeRoster(count = 1025): IPokemonBaseModel[] {
    return Array.from({ length: count }, (_, i) => {
        const id = i + 1;
        const types = [TYPES[id % TYPES.length]];
        if (id % 3 === 0) {
            types.push(TYPES[(id + 2) % TYPES.length]);
        }
        return {
            id,
            name: `pokemon-${id}`,
            types,
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

const roster = makeRoster();
const statOf = (p: IPokemonBaseModel, name: string) => p.stats.find((s) => s.name === name)?.value ?? 0;

/** 模拟 store 的「先筛后切」；页大小与 store 的 pageSize 保持一致 */
const PAGE_SIZE = 20;
const paginate = (list: IPokemonBaseModel[], pages = 1) => list.slice(0, PAGE_SIZE * pages);

describe('世代筛选', () => {
    // 这组是死锁的核心回归：每一代都必须在首页就有内容
    it.each(GENERATIONS.map((g) => [g.value, g.start, g.end] as const))(
        '%s 命中该号段全部宝可梦，且首页非空',
        (value, start, end) => {
            const matched = filterAndSortPokemons(roster, { generation: value });
            const expected = roster.filter((p) => p.id >= start && p.id <= end);

            expect(matched).toHaveLength(expected.length);
            expect(matched.every((p) => p.id >= start && p.id <= end)).toBe(true);
            // 关键断言：首页切片必须有内容，否则滚动加载死锁
            expect(paginate(matched).length).toBeGreaterThan(0);
        },
    );

    it('gen9 覆盖到 1025（曾误写为 1010，漏掉 1011..1025）', () => {
        const matched = filterAndSortPokemons(roster, { generation: 'gen9' });
        const ids = matched.map((p) => p.id);

        expect(ids).toContain(1011);
        expect(ids).toContain(1025);
        expect(Math.max(...ids)).toBe(1025);
    });

    it('未知 / null 世代不筛', () => {
        expect(filterAndSortPokemons(roster, { generation: null })).toHaveLength(roster.length);
        expect(filterAndSortPokemons(roster, { generation: 'gen99' })).toHaveLength(roster.length);
    });
});

describe('排序', () => {
    // 排序必须作用于全量：只排前 20 条的实现会在这里失败
    it.each([
        ['hp', 'HP'],
        ['attack', '攻击'],
        ['defense', '防御'],
    ] as const)('按 %s 降序，首条是全表最高', (sort, statName) => {
        const matched = filterAndSortPokemons(roster, { sort: sort as DexSortKey });
        const globalMax = Math.max(...roster.map((p) => statOf(p, statName)));

        expect(statOf(matched[0], statName)).toBe(globalMax);
        const values = matched.map((p) => statOf(p, statName));
        expect(values.every((v, i) => i === 0 || values[i - 1] >= v)).toBe(true);
    });

    it('默认按 id 升序', () => {
        const matched = filterAndSortPokemons(roster, {});
        expect(matched[0].id).toBe(1);
        expect(matched.at(-1)!.id).toBe(1025);
    });

    it('按 name 字典序', () => {
        const matched = filterAndSortPokemons(roster, { sort: 'name' });
        const names = matched.map((p) => p.name);
        const sorted = [...names].toSorted((a, b) => a.localeCompare(b));
        expect(names).toEqual(sorted);
    });

    it('不改动入参数组', () => {
        const source = makeRoster(30);
        const before = source.map((p) => p.id);
        filterAndSortPokemons(source, { sort: 'attack' });
        expect(source.map((p) => p.id)).toEqual(before);
    });

    it('缺 stats 的条目按 0 处理，不抛错', () => {
        const partial: IPokemonBaseModel[] = [
            { ...roster[0], id: 1, stats: [] },
            { ...roster[1], id: 2 },
        ];
        expect(() => filterAndSortPokemons(partial, { sort: 'hp' })).not.toThrow();
        // 有 stats 的排在前面（降序）
        expect(filterAndSortPokemons(partial, { sort: 'hp' })[0].id).toBe(2);
    });
});

describe('仅收藏', () => {
    it('命中跨越分页边界的收藏（第 20 条之后）', () => {
        const favorites = [3, 700, 1025];
        const matched = filterAndSortPokemons(roster, { favoritesOnly: true, favorites });

        expect(matched.map((p) => p.id)).toEqual([3, 700, 1025]);
    });

    it('收藏为空 → 空结果', () => {
        expect(filterAndSortPokemons(roster, { favoritesOnly: true, favorites: [] })).toHaveLength(0);
        expect(filterAndSortPokemons(roster, { favoritesOnly: true })).toHaveLength(0);
    });

    it('favoritesOnly 关闭时忽略 favorites', () => {
        expect(filterAndSortPokemons(roster, { favoritesOnly: false, favorites: [1] })).toHaveLength(roster.length);
    });
});

describe('属性筛选', () => {
    it('多选是 OR 语义', () => {
        const matched = filterAndSortPokemons(roster, { types: ['fire', 'water'] });
        expect(matched.every((p) => p.types.includes('fire') || p.types.includes('water'))).toBe(true);

        // 用「命中任一」计数，双属性只算一次；若实现误用 AND（要求全部属性都在
        // 所选集合里），双属性宝可梦会被漏掉，这里的数量断言就会失败
        const expected = roster.filter((p) => p.types.some((t) => t === 'fire' || t === 'water')).length;
        expect(matched).toHaveLength(expected);
    });

    it('单选命中副属性（双属性宝可梦不应被漏掉）', () => {
        const dual = roster.filter((p) => p.types.length > 1);
        expect(dual.length).toBeGreaterThan(0);

        const matched = filterAndSortPokemons(roster, { types: ['fire'] });
        const dualFire = dual.filter((p) => p.types.includes('fire'));
        expect(dualFire.length).toBeGreaterThan(0);
        // 副属性为 fire 的双属性宝可梦必须在结果里
        for (const p of dualFire) {
            expect(matched.map((m) => m.id)).toContain(p.id);
        }
    });

    it('空数组不筛', () => {
        expect(filterAndSortPokemons(roster, { types: [] })).toHaveLength(roster.length);
    });
});

describe('搜索', () => {
    it('匹配编号', () => {
        expect(filterAndSortPokemons(roster, { query: '025' }).map((p) => p.id)).toContain(1025);
    });

    it('匹配属性', () => {
        const matched = filterAndSortPokemons(roster, { query: 'water' });
        expect(matched.length).toBeGreaterThan(PAGE_SIZE);
        expect(matched.every((p) => p.types.includes('water'))).toBe(true);
    });

    it('搜索结果跨越多页（旧实现会被 !searchQuery 挡住翻页）', () => {
        const matched = filterAndSortPokemons(roster, { query: '7' });
        expect(matched.length).toBeGreaterThan(PAGE_SIZE);
        expect(paginate(matched, 2)).toHaveLength(PAGE_SIZE * 2);
    });

    it('大小写不敏感 + 忽略首尾空格', () => {
        const a = filterAndSortPokemons(roster, { query: 'WATER' });
        const b = filterAndSortPokemons(roster, { query: '  water  ' });
        expect(a.map((p) => p.id)).toEqual(b.map((p) => p.id));
    });

    it('空串 / 纯空格不筛', () => {
        expect(filterAndSortPokemons(roster, { query: '' })).toHaveLength(roster.length);
        expect(filterAndSortPokemons(roster, { query: '   ' })).toHaveLength(roster.length);
    });

    it('无匹配 → 空结果', () => {
        expect(filterAndSortPokemons(roster, { query: 'zzz-nonexistent' })).toHaveLength(0);
    });
});

describe('组合条件与分页推进', () => {
    it('世代 + 属性 + 排序同时生效', () => {
        const matched = filterAndSortPokemons(roster, {
            generation: 'gen9',
            types: ['fire'],
            sort: 'hp',
        });

        expect(matched.every((p) => p.id >= 906 && p.id <= 1025 && p.types.includes('fire'))).toBe(true);
        const hps = matched.map((p) => statOf(p, 'HP'));
        expect(hps.every((v, i) => i === 0 || hps[i - 1] >= v)).toBe(true);
    });

    it('逐页推进可枚举完整结果集且能到底', () => {
        const matched = filterAndSortPokemons(roster, { generation: 'gen6' });
        let pages = 0;
        let visible = 0;
        // 模拟 store：visibleCount 每次 += pageSize，hasMore 为 false 时停
        while (visible < matched.length && pages < 100) {
            pages += 1;
            visible = Math.min(PAGE_SIZE * pages, matched.length);
        }
        expect(visible).toBe(matched.length);
        expect(paginate(matched, pages)).toHaveLength(matched.length);
    });

    it('空数据源不抛错', () => {
        expect(filterAndSortPokemons([], { generation: 'gen9', query: 'x', sort: 'hp' })).toEqual([]);
    });
});
