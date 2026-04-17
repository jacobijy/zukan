<template>
    <view 
        class="min-h-screen bg-gradient-to-b from-[#f8f9fa] to-[#e9ecef] transition-opacity duration-300" 
        :class="{'opacity-0': transitioning, 'opacity-100': !transitioning}"
        :style="{ paddingTop: 'calc(var(--status-bar-height) + 60px)', paddingBottom: '100px' }"
    >
        <!-- 导航栏 -->
        <NavBar />

        <!-- 筛选和排序 -->
        <FilterBar v-show="isShow" :types="types" @filterToggle="filterToggle" @sort="onSort" />

        <!-- 收藏按钮区域 -->
        <view class="px-5 py-3">
            <view 
                class="flex items-center justify-between bg-white rounded-xl px-4 py-3 shadow-[0_2px_12px_rgba(0,0,0,0.08)] cursor-pointer active:scale-98 transition-transform"
                @click="goToFavorites"
            >
                <view class="flex items-center gap-3">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="#EF4444" stroke="#EF4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                    </svg>
                    <text class="text-sm font-semibold text-[#333]">我的收藏</text>
                </view>
                <view class="flex items-center gap-1">
                    <view v-if="favoritesCount > 0" class="bg-[#EF4444] text-white text-xs font-bold px-2.5 py-1 rounded-full">
                        {{ favoritesCount }}
                    </view>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="9 18 15 12 9 6"></polyline>
                    </svg>
                </view>
            </view>
        </view>

        <!-- 宝可梦列表 -->
        <view class="h-[calc(100vh-var(--status-bar-height)-60px-100px-70px)] overflow-y-auto p-5 custom-scrollbar" @scroll="onScroll">
            <view class="grid grid-cols-[repeat(auto-fill,minmax(360px,1fr))] gap-4 max-w-[1400px] mx-auto">
                <PokemonCard 
                    v-for="pokemon in filteredPokemons" 
                    :key="pokemon.id" 
                    :pokemon="pokemon"
                    @click="navigateToDetail(pokemon.id)" 
                />
            </view>
            <view v-if="loadingMore" class="flex flex-col items-center justify-center py-8 gap-3 text-[#666] text-sm">
                <view class="w-8 h-8 border-[3px] border-[rgba(255,107,107,0.2)] border-t-[#FF6B6B] rounded-full animate-spin"></view>
                <text>加载中...</text>
            </view>
            <view v-if="!hasMore && filteredPokemons.length > 0" class="text-center py-8 text-[#999] text-sm">
                <text>已经到底了~</text>
            </view>
        </view>

        <!-- 底部 TabBar -->
        <TabBar v-model="currentTab" @change="onTabChange" />
    </view>
</template>

<script lang="ts" setup>
import FilterBar from "@/components/FilterBar.vue";
import NavBar from "@/components/NavBar.vue";
import PokemonCard from "@/components/pokemon/PokemonCard.vue";
import TabBar from "@/components/TabBar.vue";
import { usePokemonStore } from "@/store/pokemon";
import { debounce } from 'lodash-es';
import { storeToRefs } from "pinia";
import { computed, onMounted, ref } from "vue";

const pokemonStore = usePokemonStore();
const { pokemonList, hasMore, favorites } = storeToRefs(pokemonStore);
const { fetchPokemon, loadMore } = pokemonStore;
const loadingMore = ref(false);
const searchQuery = ref("");
const loading = ref(true);
const transitioning = ref(false); // 控制页面切换动画

// 监听页面显示事件，添加淡入动画
onMounted(async () => {
    try {
        await fetchPokemon();
        // 页面加载完成后执行淡入动画
        setTimeout(() => {
            transitioning.value = false;
        }, 100);
    } catch (error) {
        console.error("加载宝可梦数据失败:", error);
    } finally {
        loading.value = false;
    }
});

// 定义类型数组
const types = ref(['一般', '火', '水', '电', '草', '冰', '格斗', '毒', '地面', '飞行', '超能力', '虫', '岩石', '幽灵', '龙', '恶', '钢', '妖精']);

// 显示详情
const showDetail = (pokemon: IPokemonBaseModel) => {
    // selectedPokemon.value = pokemon;
};

const navigateToDetail = (id: number) => {
    uni.navigateTo({
        url: `/pages/detail/detail?id=${id}`,
    });
};

// 新增响应式变量用于存储当前筛选和排序状态
const currentFilter = ref<string | null>(null);
const currentSort = ref<string>('default');
const isShow = ref(false);
const currentTab = ref(0); // 当前选中的 tab 索引

// 实现 onFilter 方法
const onFilter = (filterType: string) => {
    currentFilter.value = filterType;
};

// 实现 onSort 方法
const onSort = (sortBy: string) => {
    currentSort.value = sortBy;
};

const filterToggle = (value: boolean) => {
    // 显示或隐藏筛选和排序
    // ...
    // vShow.value = value;
    console.log('filterToggle', value);
    isShow.value = value;
};

// Tab 切换处理
const onTabChange = (index: number) => {
    console.log('Tab changed to:', index);
    
    // 添加页面切换动画
    transitioning.value = true;
    
    // 延迟切换页面，确保动画完成
    setTimeout(() => {
        currentTab.value = index;
    }, 150);
};

// 收藏数量
const favoritesCount = computed(() => {
    return favorites.value.length;
});

// 跳转到收藏页面
const goToFavorites = () => {
    uni.navigateTo({
        url: '/pages/favorite/favorite'
    });
};

// 更新计算属性 filteredPokemons 以应用筛选和排序
const onScroll = debounce((e: Event) => {
    const target = e.target as HTMLElement;
    const { scrollHeight, scrollTop, clientHeight } = target;
    const threshold = 100;

    if (scrollHeight - (scrollTop + clientHeight) < threshold &&
        hasMore.value &&
        !loadingMore.value &&
        !searchQuery.value) {
        loadingMore.value = true;
        loadMore().finally(() => {
            loadingMore.value = false;
        });
    }
}, 200);

const filteredPokemons = computed(() => {
    let list = [...pokemonList.value];

    // 应用筛选
    if (currentFilter.value) {
        list = list.filter((p) => p.types.includes(currentFilter.value!));
    }

    // 应用排序
    if (currentSort.value === 'id') {
        list.sort((a, b) => a.id - b.id);
    } else if (currentSort.value === 'name') {
        list.sort((a, b) => a.name.localeCompare(b.name));
    }

    // 应用搜索筛选
    if (searchQuery.value) {
        const query = searchQuery.value.toLowerCase();
        list = list.filter(
            (p) =>
                p.name.toLowerCase().includes(query) ||
                p.id.toString().includes(query) ||
                p.types.some((type) => type.toLowerCase().includes(query))
        );
    }

    return list;
});
</script>

<style lang="scss" scoped>
/* 所有样式已迁移至 Tailwind CSS */

.custom-scrollbar {
    &::-webkit-scrollbar {
        width: 6px;
    }
    
    &::-webkit-scrollbar-track {
        background: transparent;
    }
    
    &::-webkit-scrollbar-thumb {
        background: rgba(0, 0, 0, 0.1);
        border-radius: 3px;
        
        &:hover {
            background: rgba(0, 0, 0, 0.2);
        }
    }
}

@keyframes spin {
    to {
        transform: rotate(360deg);
    }
}

.animate-spin {
    animation: spin 0.8s linear infinite;
}
</style>