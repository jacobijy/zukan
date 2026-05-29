<template>
    <view 
        class="h-screen bg-gradient-to-b from-[#f8f9fa] to-[#e9ecef] flex flex-col relative overflow-hidden"
        :style="{ paddingBottom: '100px' }"
    >
        <!-- 主内容区：transform 仅作用于此，避免 fixed TabBar 随页面高度偏移 -->
        <view
            class="flex flex-col flex-1 min-h-0 transition-all duration-300"
            :class="{'opacity-0': transitioning, 'opacity-100': !transitioning}"
            :style="{
                paddingTop: 'calc(var(--status-bar-height) + var(--navbar-content-height))',
                transform: showGenerationPanel ? 'translateX(-280px) scale(0.95)' : 'translateX(0) scale(1)'
            }"
        >
        <!-- 导航栏 -->
        <NavBar title="宝可梦图鉴" />

        <!-- 图鉴工具栏 -->
        <view class="sticky top-0 z-[997] bg-white/95 backdrop-blur border-b border-black/5 shadow-[0_2px_12px_rgba(0,0,0,0.06)] px-3 py-3">
            <view class="max-w-[1400px] mx-auto flex items-center gap-2">
                <view class="flex-1 relative h-10">
                    <input
                        type="text"
                        placeholder="搜索宝可梦名称、编号或属性..."
                        class="w-full h-10 rounded-full border-none bg-gray-100 text-[#333] text-sm shadow-inner pl-10 pr-10 box-border placeholder:text-[#999] focus:bg-white focus:shadow-[0_0_0_2px_rgba(238,90,111,0.18)] transition-all"
                        v-model="searchText"
                        @input="onSearchInput"
                    />
                    <view class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-60">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="w-full h-full text-[#666]">
                            <circle cx="11" cy="11" r="8"></circle>
                            <path d="m21 21-4.35-4.35"></path>
                        </svg>
                    </view>
                    <view v-if="searchText" class="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 cursor-pointer" @click="clearSearch">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="w-full h-full text-[#999]">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </view>
                </view>

                <button
                    class="toolbar-button w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 active:scale-95 relative border-none p-0"
                    :class="showGenerationPanel ? 'bg-gradient-to-br from-[#5B8CFF] to-[#6D5DF6] shadow-[0_6px_14px_rgba(91,140,255,0.32)]' : 'bg-[#EEF4FF] shadow-[inset_0_0_0_1px_rgba(91,140,255,0.12),0_2px_6px_rgba(35,65,120,0.06)]'"
                    @click="toggleGenerationPanel(!showGenerationPanel)"
                >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5" :class="showGenerationPanel ? 'text-white' : 'text-[#5B75D6]'">
                        <circle cx="12" cy="12" r="10"></circle>
                        <polyline points="12 6 12 12 16 14"></polyline>
                    </svg>
                    <view v-if="selectedGeneration" class="absolute -top-1 -right-1 w-3 h-3 bg-blue-400 rounded-full border-2 border-white"></view>
                </button>

                <button
                    class="toolbar-button w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 active:scale-95 relative border-none p-0"
                    :class="isShow ? 'bg-gradient-to-br from-[#FF7A90] to-[#EE5A6F] shadow-[0_6px_14px_rgba(238,90,111,0.34)]' : 'bg-[#FFF0F3] shadow-[inset_0_0_0_1px_rgba(238,90,111,0.13),0_2px_6px_rgba(120,35,50,0.06)]'"
                    @click="filterToggle(!isShow)"
                >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="toolbar-filter-icon w-5 h-5" :class="isShow ? 'text-white' : 'text-[#D94A62]'">
                        <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
                    </svg>
                    <view v-if="currentFilterTypes.length > 0" class="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full border-2 border-white"></view>
                </button>

                <button
                    class="toolbar-button w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 active:scale-95 relative border-none p-0"
                    :class="showFavoritesOnly ? 'bg-gradient-to-br from-[#FFD166] to-[#F59E0B] shadow-[0_6px_14px_rgba(245,158,11,0.34)]' : 'bg-[#FFF7DE] shadow-[inset_0_0_0_1px_rgba(245,158,11,0.16),0_2px_6px_rgba(120,80,15,0.06)]'"
                    @click="toggleFavoritesView"
                >
                    <svg viewBox="0 0 24 24" :fill="showFavoritesOnly ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="toolbar-favorite-icon w-5 h-5 transition-colors duration-200" :class="showFavoritesOnly ? 'text-white' : 'text-[#D97706]'">
                        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
                    </svg>
                    <view v-if="pokemonStore.favorites.length > 0" class="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-yellow-400 rounded-full flex items-center justify-center border-2 border-white shadow-[0_2px_4px_rgba(0,0,0,0.2)]">
                        <text class="text-[10px] font-bold text-white">{{ pokemonStore.favorites.length > 99 ? '99+' : pokemonStore.favorites.length }}</text>
                    </view>
                </button>
            </view>
        </view>

        <!-- 筛选和排序 -->
        <FilterBar v-show="isShow" @filterToggle="filterToggle" @filterChange="onFilterChange" />

        <!-- 收藏视图提示 -->
        <view v-if="showFavoritesOnly" class="sticky top-0 z-[996] bg-gradient-to-r from-yellow-400 to-orange-400 shadow-[0_2px_8px_rgba(0,0,0,0.1)] animate-slideDown">
            <view class="px-5 py-3 flex items-center justify-between">
                <view class="flex items-center gap-2">
                    <svg viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5 text-white">
                        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
                    </svg>
                    <text class="text-sm font-semibold text-white">已收藏的宝可梦 ({{ filteredPokemons.length }})</text>
                </view>
                <button class="px-3 py-1.5 bg-white/20 rounded-full text-xs font-semibold text-white hover:bg-white/30 transition-all active:scale-95" @click="toggleFavoritesView">
                    查看全部
                </button>
            </view>
        </view>

        <!-- 宝可梦列表 -->
        <view 
            class="flex-1 min-h-0 overflow-y-auto p-3 custom-scrollbar" 
            @scroll="onScroll"
            @touchstart="handleTouchStart"
            @touchmove="handleTouchMove"
            @touchend="handleTouchEnd"
        >
            <!-- 空状态提示 -->
            <view v-if="showFavoritesOnly && filteredPokemons.length === 0" class="flex flex-col items-center justify-center py-20 gap-4">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="w-20 h-20 text-gray-300">
                    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
                </svg>
                <text class="text-lg font-semibold text-gray-400">还没有收藏任何宝可梦</text>
                <text class="text-sm text-gray-400">点击卡片右上角的星标即可收藏</text>
                <button class="mt-4 px-6 py-2.5 bg-gradient-to-r from-yellow-400 to-orange-400 text-white rounded-full font-semibold shadow-[0_4px_12px_rgba(255,165,0,0.3)] hover:shadow-[0_6px_16px_rgba(255,165,0,0.4)] transition-all active:scale-95" @click="toggleFavoritesView">
                    浏览全部宝可梦
                </button>
            </view>

            <view v-else class="grid grid-cols-[repeat(auto-fill,minmax(360px,1fr))] gap-2 max-w-[1400px] mx-auto">
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
        </view>

        <!-- 底部 TabBar（置于 transform 容器外，保持相对视口固定） -->
        <TabBar v-model="currentTab" @change="onTabChange" />

        <!-- 世代筛选面板 -->
        <view 
            class="fixed top-0 right-0 h-full w-[280px] bg-white shadow-[-4px_0_20px_rgba(0,0,0,0.1)] z-[999] transition-transform duration-300 ease-out"
            :class="showGenerationPanel ? 'translate-x-0' : 'translate-x-full'"
            :style="{ paddingTop: 'var(--status-bar-height)' }"
        >
            <!-- 面板头部 -->
            <view class="p-5 border-b border-gray-200">
                <view class="flex items-center justify-between">
                    <text class="text-lg font-bold text-[#333]">选择世代</text>
                    <button 
                        class="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors active:scale-95"
                        @click="showGenerationPanel = false"
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#666" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </view>
            </view>

            <!-- 世代列表 -->
            <view class="p-4 overflow-y-auto" style="height: calc(100vh - 120px);">
                <view class="flex flex-col gap-2">
                    <view 
                        v-for="gen in generations" 
                        :key="gen.value"
                        class="flex items-center justify-between p-4 rounded-xl cursor-pointer transition-all duration-200 border-2"
                        :class="selectedGeneration === gen.value ? 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-400 shadow-[0_2px_8px_rgba(59,130,246,0.15)]' : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-[0_2px_8px_rgba(0,0,0,0.08)]'"
                        @click="selectGeneration(gen.value)"
                    >
                        <view class="flex items-center gap-3">
                            <view 
                                class="w-10 h-10 rounded-lg flex items-center justify-center"
                                :class="selectedGeneration === gen.value ? 'bg-gradient-to-br from-blue-500 to-indigo-600' : 'bg-gray-100'"
                            >
                                <text class="text-sm font-bold" :class="selectedGeneration === gen.value ? 'text-white' : 'text-gray-600'">{{ gen.label }}</text>
                            </view>
                            <view>
                                <text class="text-sm font-semibold text-[#333] block">{{ gen.name }}</text>
                                <text class="text-xs text-gray-500">{{ gen.range }}</text>
                            </view>
                        </view>
                        <!-- 选中标记 -->
                        <svg v-if="selectedGeneration === gen.value" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                    </view>
                </view>
            </view>
        </view>

        <!-- 遮罩层 -->
        <view 
            v-if="showGenerationPanel" 
            class="fixed inset-0 bg-black/30 backdrop-blur-sm z-[998] transition-opacity duration-300"
            @click="showGenerationPanel = false"
        ></view>
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
const { pokemonList, hasMore } = storeToRefs(pokemonStore);
const { fetchPokemon, loadMore } = pokemonStore;
const loadingMore = ref(false);
const searchText = ref("");
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
const currentFilterTypes = ref<string[]>([]); // 选中的类型数组
const currentSort = ref<string>('id'); // 排序方式
const isShow = ref(false);
const currentTab = ref(0); // 当前选中的 tab 索引
const showFavoritesOnly = ref(false); // 是否只显示收藏
const showGenerationPanel = ref(false); // 是否显示世代面板
const selectedGeneration = ref<string | null>(null); // 选中的世代

// 处理筛选变化
const onFilterChange = (filterData: { types: string[], sort: string }) => {
    currentFilterTypes.value = filterData.types;
    currentSort.value = filterData.sort;
};

// 切换收藏视图
const toggleFavoritesView = () => {
    showFavoritesOnly.value = !showFavoritesOnly.value;
    // 如果切换到收藏视图，关闭筛选栏
    if (showFavoritesOnly.value) {
        isShow.value = false;
    }
};

// 切换世代面板
const toggleGenerationPanel = (visible: boolean) => {
    showGenerationPanel.value = visible;
};

// 选择世代
const selectGeneration = (generation: string) => {
    selectedGeneration.value = selectedGeneration.value === generation ? null : generation;
};

// 搜索处理
const onSearchInput = () => {
    searchQuery.value = searchText.value;
};

const clearSearch = () => {
    searchText.value = '';
    searchQuery.value = '';
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

// 触摸滑动相关变量
const touchStartX = ref(0);
const touchStartY = ref(0);
const touchDeltaX = ref(0);

// 世代数据
const generations = [
    { value: 'gen1', label: 'I', name: '第一世代', range: '#001 - #151' },
    { value: 'gen2', label: 'II', name: '第二世代', range: '#152 - #251' },
    { value: 'gen3', label: 'III', name: '第三世代', range: '#252 - #386' },
    { value: 'gen4', label: 'IV', name: '第四世代', range: '#387 - #493' },
    { value: 'gen5', label: 'V', name: '第五世代', range: '#494 - #649' },
    { value: 'gen6', label: 'VI', name: '第六世代', range: '#650 - #721' },
    { value: 'gen7', label: 'VII', name: '第七世代', range: '#722 - #809' },
    { value: 'gen8', label: 'VIII', name: '第八世代', range: '#810 - #905' },
    { value: 'gen9', label: 'IX', name: '第九世代', range: '#906 - #1010' }
];

// 触摸开始
const handleTouchStart = (e: TouchEvent) => {
    touchStartX.value = e.touches[0].clientX;
    touchStartY.value = e.touches[0].clientY;
    touchDeltaX.value = 0;
};

// 触摸移动
const handleTouchMove = (e: TouchEvent) => {
    const deltaX = e.touches[0].clientX - touchStartX.value;
    const deltaY = e.touches[0].clientY - touchStartY.value;
    
    // 只处理水平滑动，且向左滑动
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
        touchDeltaX.value = deltaX;
        e.preventDefault();
    }
};

// 触摸结束
const handleTouchEnd = () => {
    const threshold = -50; // 向左滑动阈值
    
    if (touchDeltaX.value < threshold && !showGenerationPanel.value) {
        // 向左滑动超过阈值，打开世代面板
        showGenerationPanel.value = true;
    } else if (touchDeltaX.value > 50 && showGenerationPanel.value) {
        // 向右滑动，关闭世代面板
        showGenerationPanel.value = false;
    }
    
    touchDeltaX.value = 0;
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

    // 应用收藏筛选
    if (showFavoritesOnly.value) {
        const favoriteIds = pokemonStore.favorites;
        list = list.filter((p) => favoriteIds.includes(p.id));
    }

    // 应用世代筛选
    if (selectedGeneration.value) {
        const genRanges: { [key: string]: [number, number] } = {
            'gen1': [1, 151],
            'gen2': [152, 251],
            'gen3': [252, 386],
            'gen4': [387, 493],
            'gen5': [494, 649],
            'gen6': [650, 721],
            'gen7': [722, 809],
            'gen8': [810, 905],
            'gen9': [906, 1010]
        };
        const range = genRanges[selectedGeneration.value];
        if (range) {
            list = list.filter((p) => p.id >= range[0] && p.id <= range[1]);
        }
    }

    // 应用类型筛选
    if (currentFilterTypes.value.length > 0) {
        list = list.filter((p) => 
            currentFilterTypes.value.some(type => p.types.includes(type))
        );
    }

    // 应用排序
    if (currentSort.value === 'id') {
        list.sort((a, b) => a.id - b.id);
    } else if (currentSort.value === 'name') {
        list.sort((a, b) => a.name.localeCompare(b.name));
    } else if (currentSort.value === 'hp') {
        list.sort((a, b) => {
            const hpA = a.stats?.find(s => s.name === 'HP')?.value || 0;
            const hpB = b.stats?.find(s => s.name === 'HP')?.value || 0;
            return hpB - hpA;
        });
    } else if (currentSort.value === 'attack') {
        list.sort((a, b) => {
            const atkA = a.stats?.find(s => s.name === '攻击')?.value || 0;
            const atkB = b.stats?.find(s => s.name === '攻击')?.value || 0;
            return atkB - atkA;
        });
    } else if (currentSort.value === 'defense') {
        list.sort((a, b) => {
            const defA = a.stats?.find(s => s.name === '防御')?.value || 0;
            const defB = b.stats?.find(s => s.name === '防御')?.value || 0;
            return defB - defA;
        });
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

.toolbar-button {
    line-height: 1;
}

.toolbar-filter-icon {
    transform: translateY(1px);
}

.toolbar-favorite-icon {
    display: block;
    flex-shrink: 0;
}

.toolbar-button::after {
    border: none !important;
}

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