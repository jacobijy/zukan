import { fetchPokemonList } from '@/services/pokemon';
import { addFavorite, mergeFavorites, removeFavorite } from '@/services/favoritesApi';
import { isAuthenticated } from '@/services/auth';
import { padId } from '@/utils/helpers';
import { defineStore } from 'pinia';
import { computed, ref, type Ref } from 'vue';

/** 首屏默认代次；与 `boot.ts` LATEST_GEN_ID 保持一致以复用预取缓存 */
const DEFAULT_GEN_ID = 9;

const FAV_STORAGE_KEY = 'pokemonFavorites';

function loadLocalFavorites(): number[] {
    try {
        const raw = localStorage.getItem(FAV_STORAGE_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

function saveLocalFavorites(ids: number[]) {
    try {
        localStorage.setItem(FAV_STORAGE_KEY, JSON.stringify(ids));
    } catch {
        // 忽略 quota / 沙箱错误；UI 状态保持
    }
}

export const usePokemonStore = defineStore('pokemon', () => {
    const pokemonList: Ref<IPokemonBaseModel[]> = ref([]);
    const favorites: Ref<number[]> = ref(loadLocalFavorites());
    const currentGenId = ref<number>(DEFAULT_GEN_ID);

    const currentPage = ref(1);
    const pageSize = ref(20);
    const hasMore = ref(true);
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
        Array.from(formsBySpecies.value.values()).map(
            forms => forms.find(f => f.isDefault) ?? forms[0]
        )
    );

    /** 拿指定 species 的所有形态（含 default）；未找到返回空数组 */
    const getFormsBySpecies = (speciesId: number): IPokemonBaseModel[] =>
        formsBySpecies.value.get(speciesId) ?? [];

    /** 按 form id 精确查一只宝可梦（含非默认形态） */
    const getById = (id: number): IPokemonBaseModel | undefined =>
        allPokemons.value.find(p => p.id === id);

    // 获取指定世代的宝可梦数据（默认 gen-9，与启动预取同代）
    const fetchPokemon = async (genId: number = DEFAULT_GEN_ID) => {
        currentGenId.value = genId;
        // 切代时清空分页视图，重新从首页开始
        pokemonList.value = [];
        currentPage.value = 1;
        const data = await fetchPokemonList(genId);
        allPokemons.value = data.map(p => ({
            ...p,
            formattedId: padId(p.id)
        }));
        hasMore.value = defaultPokemons.value.length > 0;
        loadMore();
    };

    /**
     * 切换收藏。策略：
     * 1. 立即更新本地 state + localStorage（UI 反馈零延迟）
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
            const p = willAdd ? addFavorite(id) : removeFavorite(id);
            p.catch(err => console.warn('[favorites] sync failed', { id, willAdd }, err));
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
            const merged = await mergeFavorites(local);
            favorites.value = merged;
            saveLocalFavorites(merged);
        } catch (err) {
            console.warn('[favorites] initial sync failed', err);
        }
    };

    /**
     * 分页把 `defaultPokemons`（每 species 一条默认形态）追加到 `pokemonList`。
     * 详情页仍能通过 `getFormsBySpecies` / `getById` 访问全部形态。
     */
    const loadMore = (): Promise<void> => {
        return new Promise((resolve) => {
            const source = defaultPokemons.value;
            const start = (currentPage.value - 1) * pageSize.value;
            const end = start + pageSize.value;
            const nextPage = source.slice(start, end);

            if (nextPage.length > 0) {
                pokemonList.value = [...pokemonList.value, ...nextPage];
                currentPage.value++;
                hasMore.value = end < source.length;
            } else {
                hasMore.value = false;
            }
            resolve();
        });
    };

    return {
        pokemonList,
        allPokemons,
        defaultPokemons,
        favorites,
        hasMore,
        currentGenId,
        fetchPokemon,
        loadMore,
        toggleFavorite,
        isFavorite,
        syncFavoritesOnLogin,
        getFormsBySpecies,
        getById,
    };
});
