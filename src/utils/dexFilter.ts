/**
 * 图鉴列表筛选 + 排序（纯函数，无 Vue 依赖）
 *
 * 抽出来的原因：这套逻辑必须作用于**全量** 1025 条默认形态，而不是分页后的
 * 20 条。之前写在 `index.vue` 的 `filteredPokemons` 里、过滤 `pokemonList`
 * （已分页结果），导致：
 * - 选任意非第一世代 → 首页 20 条（ids 1..20）无一命中 → 空列表 → 容器无内容
 *   → 滚动事件不触发 → `loadMore` 永不执行 → 死锁
 * - 排序 / 仅收藏 / 搜索 同样只在当前 20 条内生效
 *
 * 正确顺序是 **先筛选排序、再分页**（见 `store/pokemon.ts` 的 `visibleList`）。
 * 数据全在内存（bundle 一次解出 1351 条），不涉及网络。
 */

import { isInGeneration } from '@/constants/generations';

/** 排序键。`id` 为默认（按全国编号升序）。 */
export type DexSortKey = 'id' | 'name' | 'hp' | 'attack' | 'defense';

/** 排序键 → `stats[].name` 里的中文种族值名 */
const STAT_NAME_BY_SORT: Partial<Record<DexSortKey, string>> = {
    hp: 'HP',
    attack: '攻击',
    defense: '防御',
};

export interface DexFilterCriteria {
    /** 仅显示收藏；需同时给出 `favorites` */
    favoritesOnly?: boolean;
    favorites?: number[];
    /** 世代 key（'gen1'…'gen9'）；null / undefined 表示不筛 */
    generation?: string | null;
    /** 属性 slug 列表；命中任一即保留（OR 语义，与 FilterBar 的多选一致） */
    types?: string[];
    /** 搜索词，匹配名称 / 编号 / 属性；空串表示不筛 */
    query?: string;
    sort?: DexSortKey;
}

function statValue(p: IPokemonBaseModel, statName: string): number {
    return p.stats?.find((s) => s.name === statName)?.value ?? 0;
}

/**
 * 按条件筛选 + 排序。返回新数组，不改动入参
 * （`sort` 会原地改数组，所以先 `slice`）。
 */
export function filterAndSortPokemons(
    source: readonly IPokemonBaseModel[],
    criteria: DexFilterCriteria,
): IPokemonBaseModel[] {
    const { favoritesOnly, favorites, generation, types, query, sort = 'id' } = criteria;

    let list = source.slice();

    if (favoritesOnly) {
        // 收藏为空时结果必然为空——不特殊照顾，交给调用方渲染空态
        const favSet = new Set(favorites ?? []);
        list = list.filter((p) => favSet.has(p.id));
    }

    if (generation) {
        list = list.filter((p) => isInGeneration(p.id, generation));
    }

    if (types && types.length > 0) {
        const wanted = new Set(types);
        list = list.filter((p) => p.types.some((t) => wanted.has(t)));
    }

    const trimmed = query?.trim().toLowerCase();
    if (trimmed) {
        list = list.filter(
            (p) =>
                p.name.toLowerCase().includes(trimmed) ||
                String(p.id).includes(trimmed) ||
                p.types.some((t) => t.toLowerCase().includes(trimmed)),
        );
    }

    const statName = STAT_NAME_BY_SORT[sort];
    if (statName) {
        // 种族值降序（高的在前）
        list.sort((a, b) => statValue(b, statName) - statValue(a, statName));
    } else if (sort === 'name') {
        list.sort((a, b) => a.name.localeCompare(b.name));
    } else {
        list.sort((a, b) => a.id - b.id);
    }

    return list;
}
