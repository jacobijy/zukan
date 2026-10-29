/**
 * 「热门样本」编排：收藏热度榜 → 跨代 bundle 解析成可直接渲染的条目。
 *
 * 热度接口只给 pokemon_id（形态 id 空间）与收藏数，名称 / 属性需要按
 * `genForPokemonId` 号段定位世代、拉对应 FlatBuffers bundle
 * （resourceManager 三层缓存，重复拉零网络）。
 *
 * 名称刻意不在此解析：UI 直接用 i18n store 的 computed 查物种 / 属性名，
 * 随内容语言切换自动刷新，本模块无需感知语言、也不必因切语言重跑。
 *
 * 榜单服务端一天只重建 4 次，做会话级 Promise 缓存；请求失败清掉缓存，
 * 下次调用可重试。协议见 docs/data/popularity.md。
 */
import { popularityApi } from '@/services/api';
import { fetchPokemonList, genForPokemonId } from '@/services/pokemon';

export interface PopularPokemon {
    /** 全局名次（从 1 开始） */
    rank: number;
    /** 收藏该宝可梦的去重用户数 */
    favoriteCount: number;
    /** 形态 id；跳详情 / 立绘请求都用它 */
    pokemonId: number;
    /** 物种 id；查名称 / 展示编号用 */
    speciesId: number;
    /** 属性 slug（'fire' / 'flying' …），与 TypeBadge / getTypeName 同口径 */
    types: string[];
}

const cache = new Map<number, Promise<PopularPokemon[]>>();

/**
 * 拉取并解析热门榜前 limit 名。
 * 无法用全国编号号段定位世代的 id（如部分形态内部 id）与明确无立绘的形态跳过；
 * 网络失败向上抛（缓存已清理，可重试），由 UI 决定回落。
 */
export function loadPopularPokemons(limit: number): Promise<PopularPokemon[]> {
    const cached = cache.get(limit);
    if (cached) return cached;
    const promise = resolvePopular(limit);
    promise.catch(() => {
        cache.delete(limit);
    });
    cache.set(limit, promise);
    return promise;
}

/** 测试辅助：清空会话缓存（失败重试飞 / bundle 切换时用）。 */
export function clearPopularPokemonsCache(): void {
    cache.clear();
}

async function resolvePopular(limit: number): Promise<PopularPokemon[]> {
    const { items } = await popularityApi.listPokemonPopularity(limit);
    if (items.length === 0) return [];

    // 按世代分组要拉取的 id；同一世代只拉一次 bundle。
    const idsByGen = groupIdsByGen(items.map((it) => it.pokemonId));
    const bundles = await Promise.all(Array.from(idsByGen.keys()).map((gen) => fetchPokemonList(gen, null)));
    const models = new Map<number, IPokemonBaseModel>();
    for (const list of bundles) {
        for (const p of list) models.set(p.id, p);
    }

    const out: PopularPokemon[] = [];
    for (const it of items) {
        const model = models.get(it.pokemonId);
        if (!model) continue;
        // hasSprite 为三态：仅明确 false 的形态屏蔽，undefined（缺省）保留。
        if (model.hasSprite === false) continue;
        out.push({
            rank: it.rank,
            favoriteCount: it.favoriteCount,
            pokemonId: it.pokemonId,
            speciesId: model.speciesId ?? model.id,
            types: model.types,
        });
    }
    return out;
}

/**
 * 按 `genForPokemonId` 把形态 id 分进世代桶，保持入参首次出现顺序。
 * 号段外（genForPokemonId 返回 null）的 id 不入桶。纯函数。
 */
export function groupIdsByGen(
    ids: readonly number[],
    genFor: (id: number) => number | null = genForPokemonId,
): Map<number, number[]> {
    const out = new Map<number, number[]>();
    for (const id of ids) {
        const gen = genFor(id);
        if (gen === null) continue;
        const bucket = out.get(gen);
        if (bucket) bucket.push(id);
        else out.set(gen, [id]);
    }
    return out;
}
