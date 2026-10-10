import { fetchPokemonList, type NameResolvers } from '@/services/pokemon';
import { favoritesApi } from '@/services/api';
import { confirmLogin, isAuthenticated } from '@/services/session';
import { useI18nStore } from '@/store/i18n';
import { padId } from '@/utils/helpers';
import { filterAndSortPokemons, type DexFilterCriteria } from '@/utils/dexFilter';
import { defineStore } from 'pinia';
import { computed, ref, watch, type Ref } from 'vue';

/** 首屏默认代次；与 `boot.ts` LATEST_GEN_ID 保持一致以复用预取缓存 */
const DEFAULT_GEN_ID = 9;

export const usePokemonStore = defineStore('pokemon', () => {
    const favorites: Ref<number[]> = ref([]);
    /** 收藏是否已在本次会话从后端拉取过（未登录不发请求）。 */
    const favoritesLoaded = ref(false);
    const currentGenId = ref<number>(DEFAULT_GEN_ID);

    const allPokemons = ref<IPokemonBaseModel[]>([]);

    /** 按 speciesId 分组的所有形态。同 species 的多形态在同一 bucket。 */
    const formsBySpecies = computed(() => {
        const map = new Map<number, IPokemonBaseModel[]>();
        for (const p of allPokemons.value) {
            const sid = p.speciesId ?? p.id;
            const bucket = map.get(sid);
            if (bucket) bucket.push(p);
            else map.set(sid, [p]);
        }
        return map;
    });

    /**
     * 首页列表源：每 species 只保留默认形态（无 default 标记时兜底取第一条）。
     * 保序：按 species 首次出现顺序（源自 bundle.baseEntries 的顺序）。
     */
    const defaultPokemons = computed<IPokemonBaseModel[]>(() =>
        Array.from(formsBySpecies.value.values()).map((forms) => forms.find((f) => f.isDefault) ?? forms[0]),
    );

    /** 拿指定 species 的所有形态（含 default）；未找到返回空数组 */
    const getFormsBySpecies = (speciesId: number): IPokemonBaseModel[] => formsBySpecies.value.get(speciesId) ?? [];

    /** 按 form id 精确查一只宝可梦（含非默认形态） */
    const getById = (id: number): IPokemonBaseModel | undefined => allPokemons.value.find((p) => p.id === id);

    // ─────────────────────────────────────────────────────────
    // 筛选
    //
    // 筛选**作用于全量**，不做分页 —— 列表渲染由 `VirtualGrid` 虚拟化，
    // DOM 只保留视口附近的行，因此不需要再用分页来限制渲染量。
    //
    // 历史坑：早先是「先分页再筛选」，选任意非第一世代会把首页 20 条全滤掉
    // → 列表空 → 容器无内容 → 滚动不触发 → loadMore 永不执行 → 死锁。
    // 现在没有分页，这个失败模式不存在了；`tests/pokemonStore.spec.ts` 仍保留
    // 「每代都有结果」的回归用例守着筛选本身。
    // ─────────────────────────────────────────────────────────

    /** 当前筛选条件；由页面写入 */
    const criteria = ref<DexFilterCriteria>({});

    /** 全量筛选排序后的结果。世代/属性/搜索/排序都作用于此，直接喂给虚拟列表。 */
    const matchedPokemons = computed<IPokemonBaseModel[]>(() =>
        filterAndSortPokemons(defaultPokemons.value, {
            ...criteria.value,
            favorites: favorites.value,
        }),
    );

    /** 命中总数，供工具栏显示 */
    const matchedCount = computed(() => matchedPokemons.value.length);

    /** 更新筛选条件 */
    const setCriteria = (next: DexFilterCriteria): void => {
        criteria.value = next;
    };

    // 获取指定世代的宝可梦数据（默认 gen-9，与启动预取同代）
    const fetchPokemon = async (genId: number = DEFAULT_GEN_ID) => {
        currentGenId.value = genId;
        const data = await fetchPokemonList(genId, resolveNames());
        allPokemons.value = data.map((p) => ({
            ...p,
            formattedId: padId(p.id),
        }));
    };

    // ── i18n 名称注入 ────────────────────────────────────────
    // 名称解析器在这里组装（store → store 是允许的方向），service 层保持纯数据。
    // 反过来的依赖（store/i18n → store/pokemon）不存在：名称就绪/切换语言时由
    // 下面的 watch 触发重映射，i18n store 不需要回头 import 本 store。
    // 历史坑：i18n 曾用动态 import('@/store/pokemon') 触发刷新，小程序端动态
    // import 被错编成 `await "字符串"`，刷新永不执行 → 卡片全是占位名。
    const i18n = useI18nStore();

    function resolveNames(): NameResolvers | null {
        if (!i18n.ready) return null;
        return {
            species: (id) => i18n.speciesName(id),
            genus: (id) => i18n.speciesGenus(id),
            form: (id) => i18n.formLabel(id),
            ability: (id) => i18n.abilityName(id),
            eggGroup: (id) => i18n.eggGroupName(id),
        };
    }

    // 名称查找表就绪或切换语言（lookup 引用替换）后，若列表已加载则用内存缓存
    // 重映射一遍（resourceManager 命中内存 LRU，零网络），把占位名替换成真实名称。
    watch(
        () => i18n.lookup,
        (table) => {
            if (table && allPokemons.value.length > 0) {
                void fetchPokemon(currentGenId.value);
            }
        },
    );

    /**
     * 切换收藏（纯后端，需登录）：
     * 1. confirmLogin：未登录先「是否去登录」确认、再弹登录框；取消则什么都不做。
     * 2. 乐观更新内存（UI 即时反馈；不落本地存储）。
     * 3. POST/DELETE 同步后端，失败回滚内存，避免与服务端长期不一致。
     */
    const toggleFavorite = async (id: number): Promise<void> => {
        if (!(await confirmLogin())) return;
        const willAdd = !favorites.value.includes(id);
        if (willAdd) favorites.value.push(id);
        else favorites.value = favorites.value.filter((x) => x !== id);
        try {
            if (willAdd) await favoritesApi.addFavorite(id);
            else await favoritesApi.removeFavorite(id);
        } catch (err) {
            // 回滚乐观更新
            if (willAdd) favorites.value = favorites.value.filter((x) => x !== id);
            else if (!favorites.value.includes(id)) favorites.value.push(id);
            console.warn('[favorites] sync failed', { id, willAdd }, err);
        }
    };

    // 检查是否收藏
    const isFavorite = (id: number) => {
        return favorites.value.includes(id);
    };

    /**
     * 从后端拉取登录用户的收藏（服务端为唯一来源）。
     * 未登录 → 清空、不发请求、不弹窗；已登录且已加载则复用（force 强制刷新）。
     * 失败静默置空，不打断图鉴浏览。
     */
    const loadFavorites = async (force = false): Promise<void> => {
        if (!isAuthenticated()) {
            favorites.value = [];
            favoritesLoaded.value = false;
            return;
        }
        if (favoritesLoaded.value && !force) return;
        try {
            const ids = await favoritesApi.listFavorites();
            // 再守一道不变量：favorites 必须是有限数字数组，脏数据不灌进筛选 / UI。
            favorites.value = ids.filter((id) => typeof id === 'number' && Number.isFinite(id));
            favoritesLoaded.value = true;
        } catch (err) {
            console.warn('[favorites] 加载失败', err);
            favorites.value = [];
        }
    };

    /** 登出时清空内存收藏，避免下一账号看到上一账号的收藏（本就无本地持久化）。 */
    const resetFavorites = (): void => {
        favorites.value = [];
        favoritesLoaded.value = false;
    };

    return {
        // 数据
        allPokemons,
        defaultPokemons,
        favorites,
        currentGenId,
        fetchPokemon,
        // 筛选
        criteria,
        matchedPokemons,
        matchedCount,
        setCriteria,
        // 收藏
        toggleFavorite,
        isFavorite,
        loadFavorites,
        resetFavorites,
        // 形态查询
        getFormsBySpecies,
        getById,
    };
});
