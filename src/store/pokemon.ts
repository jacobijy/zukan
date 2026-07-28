import { fetchPokemonList } from '@/services/pokemon';
import { padId } from '@/utils/helpers';
import { defineStore } from 'pinia';
import { ref, type Ref } from 'vue';

/** 首屏默认代次；与 `boot.ts` LATEST_GEN_ID 保持一致以复用预取缓存 */
const DEFAULT_GEN_ID = 9;

export const usePokemonStore = defineStore('pokemon', () => {
    const pokemonList: Ref<IPokemonBaseModel[]> = ref([]);
    const favorites: Ref<number[]> = ref(JSON.parse(localStorage.getItem('pokemonFavorites') + '') || []);
    const currentGenId = ref<number>(DEFAULT_GEN_ID);

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
        hasMore.value = allPokemons.value.length > 0;
        loadMore();
    };

    // 切换收藏状态
    const toggleFavorite = (id: number) => {
        const index = favorites.value.indexOf(id);
        if (index >= 0) {
            favorites.value.splice(index, 1);
        } else {
            favorites.value.push(id);
        }
        // 保存到本地存储
        localStorage.setItem('pokemonFavorites', JSON.stringify(favorites.value));
    };

    // 检查是否收藏
    const isFavorite = (id: number) => {
        return favorites.value.includes(id);
    };

    const currentPage = ref(1);
    const pageSize = ref(20);
    const hasMore = ref(true);
    const allPokemons = ref<IPokemonBaseModel[]>([]);

    const loadMore = (): Promise<void> => {
        return new Promise((resolve) => {
            const start = (currentPage.value - 1) * pageSize.value;
            const end = start + pageSize.value;
            const newPokemons = allPokemons.value.slice(start, end);

            if (newPokemons.length > 0) {
                pokemonList.value = [...pokemonList.value, ...newPokemons];
                currentPage.value++;
                hasMore.value = end < allPokemons.value.length;
            }
            resolve();
        });
    };



    return {
        pokemonList,
        allPokemons,
        favorites,
        hasMore,
        currentGenId,
        fetchPokemon,
        loadMore,
        toggleFavorite,
        isFavorite
    };
});
