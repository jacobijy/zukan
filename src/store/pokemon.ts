import { fetchPokemonList } from '@/services/pokemon';
import { padId } from '@/utils/helpers';
import { defineStore } from 'pinia';
import { ref, type Ref } from 'vue';

export const usePokemonStore = defineStore('pokemon', () => {
    const pokemonList: Ref<IPokemonBaseModel[]> = ref([]);
    const favorites: Ref<number[]> = ref(JSON.parse(localStorage.getItem('pokemonFavorites') + '') || []);

    // 获取宝可梦数据
    const fetchPokemon = async () => {
        const data = await fetchPokemonList();
        allPokemons.value = data.map(p => ({
            ...p,
            formattedId: padId(p.id)
        }));
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
        fetchPokemon,
        loadMore,
        toggleFavorite,
        isFavorite
    };
});
