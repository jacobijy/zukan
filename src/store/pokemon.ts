import { fetchPokemonList } from '@/services/pokemon';
import { favoritesApi } from '@/services/api';
import { isAuthenticated } from '@/services/session';
import { padId } from '@/utils/helpers';
import { filterAndSortPokemons, type DexFilterCriteria } from '@/utils/dexFilter';
import { defineStore } from 'pinia';
import { computed, ref, type Ref } from 'vue';

/** 首屏默认代次；与 `boot.ts` LATEST_GEN_ID 保持一致以复用预取缓存 */
const DEFAULT_GEN_ID = 9;

const FAV_STORAGE_KEY = 'pokemonFavorites';

/**
 * 读本地收藏。
 *
 * 走 `uni.getStorageSync` 以兼容小程序端（与 `session/token.ts`、
 * `resources/dataVersion.ts` 同一套写法）。
 *
 * 需要同时认两种形态：
 * - **数组** —— `setStorageSync(key, ids)` 写入的当前格式（H5 上实际落盘为
 *   `{"type":"object","data":[...]}`，读取时被 uni 还原成数组）
 * - **字符串** —— 历史上直接 `localStorage.setItem(key, JSON.stringify(ids))`
 *   写的裸 JSON。uni 的 `parseValue` 认不出这种没有 `type` 字段的值，会把原始
 *   字符串原样返回；不在这里解析的话老用户的收藏会被静默清空。
 *
 * 任一形态都过一遍数字校验，脏数据降级为空列表而不是把 `NaN` 灌进 UI。
 */
function loadLocalFavorites(): number[] {
    try {
        const raw = uni.getStorageSync(FAV_STORAGE_KEY) as unknown;
        const parsed = typeof raw === 'string' ? (raw ? JSON.parse(raw) : []) : raw;
        if (!Array.isArray(parsed)) return [];
        return parsed.filter((id): id is number => typeof id === 'number' && Number.isFinite(id));
    } catch {
        return [];
    }
}

function saveLocalFavorites(ids: number[]) {
    try {
        uni.setStorageSync(FAV_STORAGE_KEY, ids);
    } catch (err) {
        // quota / 沙箱错误：内存 state 保持，仅丢失持久化
        console.warn('[favorites] 写入本地存储失败', err);
    }
}

export const usePokemonStore = defineStore('pokemon', () => {
    const favorites: Ref<number[]> = ref(loadLocalFavorites());
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
        const data = await fetchPokemonList(genId);
        allPokemons.value = data.map((p) => ({
            ...p,
            formattedId: padId(p.id),
        }));
    };

    /**
     * 切换收藏。策略：
     * 1. 立即更新本地 state + 本地存储（UI 反馈零延迟）
     * 2. 已登录时后台 fire-and-forget 同步到后端（幂等，失败静默 log）
     * 3. 后端失败不影响本地 —— 下次登录 `syncFavoritesOnLogin` 时并集合并会补齐
     */
    const toggleFavorite = (id: number) => {
        const index = favorites.value.indexOf(id);
        const willAdd = index < 0;
        if (willAdd) favorites.value.push(id);
        else favorites.value.splice(index, 1);
        saveLocalFavorites(favorites.value);

        if (isAuthenticated()) {
            const p = willAdd ? favoritesApi.addFavorite(id) : favoritesApi.removeFavorite(id);
            p.catch((err) => console.warn('[favorites] sync failed', { id, willAdd }, err));
        }
    };

    // 检查是否收藏
    const isFavorite = (id: number) => {
        return favorites.value.includes(id);
    };

    /**
     * 登录成功后同步收藏：把本地并集提交给后端，返回合并后完整列表覆盖本地。
     * 失败静默降级 —— 保留本地状态，下次登录 / 操作再试。
     */
    const syncFavoritesOnLogin = async (): Promise<void> => {
        try {
            const local = favorites.value.slice();
            const merged = await favoritesApi.mergeFavorites(local);
            favorites.value = merged;
            saveLocalFavorites(merged);
        } catch (err) {
            console.warn('[favorites] initial sync failed', err);
        }
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
        syncFavoritesOnLogin,
        // 形态查询
        getFormsBySpecies,
        getById,
    };
});
