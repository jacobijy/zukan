<template>
    <view class="dex-page h-screen flex flex-col relative overflow-hidden" :style="{ paddingBottom: '100px' }">
        <view
            class="page-switch-panel relative z-10 flex flex-col flex-1 min-h-0"
            :style="{
                '--page-panel-x': showGenerationPanel ? '-280px' : '0px',
                '--page-panel-scale': showGenerationPanel ? '0.95' : '1',
                paddingTop: 'calc(var(--status-bar-height) + var(--navbar-content-height))'
            }"
        >
            <NavBar title="宝可梦图鉴" />

            <view class="px-3 pt-2 sm:px-5 sm:pt-3">
                <view class="mx-auto max-w-[1400px] overflow-hidden rounded-[24px] border border-[#e5e7ee] bg-white p-2.5 shadow-[0_14px_34px_rgba(48,55,72,0.08)] sm:rounded-[28px] sm:p-3">
                    <view class="flex items-center gap-2 sm:gap-3">
                        <view class="relative h-10 min-w-0 flex-1 sm:h-11">
                            <input
                                type="text"
                                placeholder="搜索名称、编号或属性..."
                                class="h-10 w-full rounded-[20px] border border-[#e1e4eb] bg-[#f5f6fa] pl-10 pr-9 text-sm font-semibold text-[#24262b] shadow-[inset_0_1px_0_#ffffff] outline-none placeholder:text-[#9da2ad] focus:border-[#357df4] focus:bg-white focus:shadow-[0_0_0_4px_rgba(53,125,244,0.12)] sm:h-11 sm:rounded-[22px] sm:pl-11 sm:pr-10"
                                v-model="searchText"
                                @input="onSearchInput"
                            />
                            <view class="absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[#8d929c] sm:left-4 sm:h-5 sm:w-5">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="h-full w-full">
                                    <circle cx="11" cy="11" r="8"></circle>
                                    <path d="m21 21-4.35-4.35"></path>
                                </svg>
                            </view>
                            <view v-if="searchText" class="absolute right-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 cursor-pointer text-[#90997f] sm:right-4 sm:h-5 sm:w-5" @click="clearSearch">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="h-full w-full">
                                    <line x1="18" y1="6" x2="6" y2="18"></line>
                                    <line x1="6" y1="6" x2="18" y2="18"></line>
                                </svg>
                            </view>
                        </view>

                        <button
                            class="icon-tool-button icon-tool-button--favorite panel-button"
                            :class="showFavoritesOnly ? 'icon-tool-button--favorite-active' : ''"
                            @click="toggleFavoritesView"
                        >
                            <svg viewBox="0 0 24 24" :fill="showFavoritesOnly ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="icon-tool-button__svg icon-tool-button__svg--star">
                                <polygon points="12 2.8 14.9 8.7 21.4 9.65 16.7 14.25 17.8 20.75 12 17.68 6.2 20.75 7.3 14.25 2.6 9.65 9.1 8.7 12 2.8"></polygon>
                            </svg>                        </button>

                        <button class="icon-tool-button panel-button" @click="isIndexCollapsed = !isIndexCollapsed">
                            <svg v-if="isIndexCollapsed" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" class="icon-tool-button__svg icon-tool-button__svg--arrow">
                                <path d="M7 10.5 12 15.5 17 10.5"></path>
                            </svg>
                            <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" class="icon-tool-button__svg icon-tool-button__svg--arrow">
                                <path d="M7 13.5 12 8.5 17 13.5"></path>
                            </svg>
                        </button>
                    </view>

                    <view v-if="!isIndexCollapsed" class="mt-2 grid grid-cols-[1fr_1fr_1.18fr] gap-2 sm:mt-3 sm:grid-cols-[140px_140px_180px]">
                        <view class="stat-tile">
                            <text class="stat-tile__label">当前样本</text>
                            <text class="stat-tile__value">{{ filteredPokemons.length }}</text>
                        </view>
                        <view class="stat-tile">
                            <text class="stat-tile__label">已收藏</text>
                            <text class="stat-tile__value">{{ pokemonStore.favorites.length }}</text>
                        </view>
                        <view class="filter-stack">
                            <button class="filter-stack__button" :class="showGenerationPanel ? 'filter-stack__button--active-green' : ''" @click="toggleGenerationPanel(!showGenerationPanel)">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" class="filter-stack__icon">
                                    <circle cx="12" cy="12" r="10"></circle>
                                    <polyline points="12 6 12 12 16 14"></polyline>
                                </svg>
                                <text class="filter-stack__text">{{ selectedGenerationLabel }}</text>
                                <view v-if="selectedGeneration" class="pill-dot"></view>
                            </button>

                            <button class="filter-stack__button" :class="isShow ? 'filter-stack__button--active-red' : ''" @click="filterToggle(!isShow)">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" class="filter-stack__icon">
                                    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
                                </svg>
                                <text class="filter-stack__text">属性筛选</text>
                                <view v-if="currentFilterTypes.length > 0" class="pill-dot"></view>
                            </button>
                        </view>
                    </view>
                </view>
            </view>

            <FilterBar v-show="isShow" @filterToggle="filterToggle" @filterChange="onFilterChange" />

            <view v-if="showFavoritesOnly" class="mx-3 mt-3 rounded-[24px] border border-[#efd274] bg-[linear-gradient(135deg,#ffe7a8,#f4c849)] px-4 py-3 shadow-[0_15px_32px_rgba(148,94,14,0.16)] sm:mx-5">
                <view class="mx-auto flex max-w-[1400px] items-center justify-between gap-3">
                    <view class="flex items-center gap-2">
                        <view class="flex h-9 w-9 items-center justify-center rounded-full bg-white text-[#d99b00] shadow-[inset_0_1px_0_#ffffff]">
                            <svg viewBox="0 0 24 24" fill="currentColor" class="icon-tool-button__svg icon-tool-button__svg--arrow">
                                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
                            </svg>
                        </view>
                        <view>
                            <text class="block text-sm font-black text-[#4c3506]">收藏标本架</text>
                            <text class="block text-xs font-semibold text-[#8a6a17]">当前显示 {{ filteredPokemons.length }} 只</text>
                        </view>
                    </view>
                    <button class="panel-button rounded-full bg-white px-4 py-2 text-xs font-black text-[#4c3506] shadow-[inset_0_1px_0_#ffffff,0_8px_18px_rgba(111,82,9,0.12)] active:scale-95" @click="toggleFavoritesView">查看全部</button>
                </view>
            </view>

            <view
                class="custom-scrollbar flex-1 min-h-0 overflow-y-auto px-3 pb-5 pt-4 sm:px-5"
                @scroll="onScroll"
                @touchstart="handleTouchStart"
                @touchmove="handleTouchMove"
                @touchend="handleTouchEnd"
            >
                <view v-if="loading" class="mx-auto flex max-w-[1400px] flex-col items-center justify-center py-20 text-[#8d929c]">
                    <view class="field-loader mb-4"></view>
                    <text class="text-sm font-black tracking-[0.18em]">正在整理图鉴样本...</text>
                </view>

                <view v-else-if="showFavoritesOnly && filteredPokemons.length === 0" class="empty-card mx-auto max-w-[560px] px-8 py-14 text-center">
                    <view class="mx-auto mb-5 flex h-24 w-24 items-center justify-center rounded-[32px] bg-[#fff1b8] text-[#c58a17] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.72),0_18px_34px_rgba(114,83,27,0.15)]">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" class="h-12 w-12">
                            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
                        </svg>
                    </view>
                    <text class="block text-xl font-black tracking-[-0.03em] text-[#24262b]">收藏标本架还是空的</text>
                    <text class="mt-2 block text-sm font-medium leading-6 text-[#8d929c]">点击卡片右上角的书签，就能把喜欢的宝可梦收入你的研究手册。</text>
                    <button class="panel-button mt-6 rounded-full bg-[#24262b] px-6 py-3 text-sm font-black text-white shadow-[0_14px_30px_rgba(48,55,72,0.22)] active:scale-95" @click="toggleFavoritesView">浏览全部宝可梦</button>
                </view>

                <view v-else-if="filteredPokemons.length === 0" class="empty-card mx-auto max-w-[560px] px-8 py-14 text-center">
                    <text class="block text-xl font-black tracking-[-0.03em] text-[#24262b]">没有匹配的宝可梦</text>
                    <text class="mt-2 block text-sm font-medium leading-6 text-[#8d929c]">尝试清空搜索词，或者减少属性与世代筛选条件。</text>
                    <button class="panel-button mt-6 rounded-full bg-[#357df4] px-6 py-3 text-sm font-black text-white shadow-[0_14px_30px_rgba(53,125,244,0.22)] active:scale-95" @click="clearSearch">清空搜索</button>
                </view>

                <view v-else class="mx-auto grid max-w-[1400px] grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3 pb-3 sm:grid-cols-[repeat(auto-fill,minmax(310px,1fr))] sm:gap-4 2xl:grid-cols-[repeat(auto-fill,minmax(340px,1fr))]">
                    <PokemonCard
                        v-for="pokemon in filteredPokemons"
                        :key="pokemon.id"
                        :pokemon="pokemon"
                    />
                </view>

                <view v-if="loadingMore" class="flex flex-col items-center justify-center py-8 text-[#8d929c]">
                    <view class="field-loader mb-3"></view>
                    <text class="text-xs font-black tracking-[0.18em]">继续翻页采样...</text>
                </view>
            </view>
        </view>

        <TabBar v-model="currentTab" @change="onTabChange" />

        <view
            class="generation-drawer fixed right-0 top-0 z-[999] h-full w-[280px] translate-x-full border-l border-[#e5e7ee] bg-white shadow-[-24px_0_60px_rgba(48,55,72,0.18)] transition-transform duration-300 ease-out"
            :class="showGenerationPanel ? 'translate-x-0' : 'translate-x-full'"
            :style="{ paddingTop: 'var(--status-bar-height)' }"
        >
            <view class="p-5">
                <view class="mb-5 flex items-start justify-between gap-3">
                    <view>
                        <text class="block text-2xl font-black tracking-[-0.05em] text-[#24262b]">世代索引</text>
                        <text class="mt-1 block text-xs font-bold uppercase tracking-[0.18em] text-[#89947e]">Generation drawer</text>
                    </view>
                    <button class="panel-button flex h-9 w-9 items-center justify-center rounded-full bg-[#f5f6fa] text-[#8d929c] shadow-[0_10px_22px_rgba(48,55,72,0.08)] active:scale-95" @click="showGenerationPanel = false">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </view>

                <view class="flex flex-col gap-2 overflow-y-auto pr-1" style="height: calc(100vh - 120px);">
                    <view
                        v-for="gen in generations"
                        :key="gen.value"
                        class="generation-item"
                        :class="selectedGeneration === gen.value ? 'generation-item--active' : ''"
                        @click="selectGeneration(gen.value)"
                    >
                        <view class="flex items-center gap-3">
                            <view class="generation-item__mark">
                                <text class="font-serif text-sm font-black">{{ gen.label }}</text>
                            </view>
                            <view>
                                <text class="block text-sm font-black text-[#24262b]">{{ gen.name }}</text>
                                <text class="block font-mono text-[11px] font-bold text-[#89947e]">{{ gen.range }}</text>
                            </view>
                        </view>
                        <svg v-if="selectedGeneration === gen.value" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5 text-[#83a84c]">
                            <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                    </view>
                </view>
            </view>
        </view>

        <view
            v-if="showGenerationPanel"
            class="fixed inset-0 z-[998] bg-[#24262b]/28 transition-opacity duration-300"
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
const isIndexCollapsed = ref(true);

onMounted(async () => {
    try {
        await fetchPokemon();
    } catch (error) {
        console.error("加载宝可梦数据失败:", error);
    } finally {
        loading.value = false;
    }
});

const currentFilterTypes = ref<string[]>([]);
const currentSort = ref<string>('id');
const isShow = ref(false);
const currentTab = ref(0);
const showFavoritesOnly = ref(false);
const showGenerationPanel = ref(false);
const selectedGeneration = ref<string | null>(null);

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

const selectedGenerationLabel = computed(() => {
    return generations.find(gen => gen.value === selectedGeneration.value)?.name ?? '世代';
});

const onFilterChange = (filterData: { types: string[], sort: string }) => {
    currentFilterTypes.value = filterData.types;
    currentSort.value = filterData.sort;
};

const toggleFavoritesView = () => {
    showFavoritesOnly.value = !showFavoritesOnly.value;
    if (showFavoritesOnly.value) {
        isShow.value = false;
    }
};

const toggleGenerationPanel = (visible: boolean) => {
    showGenerationPanel.value = visible;
};

const selectGeneration = (generation: string) => {
    selectedGeneration.value = selectedGeneration.value === generation ? null : generation;
};

const onSearchInput = () => {
    searchQuery.value = searchText.value;
};

const clearSearch = () => {
    searchText.value = '';
    searchQuery.value = '';
};

const filterToggle = (value: boolean) => {
    isShow.value = value;
};

const onTabChange = (index: number) => {
    currentTab.value = index;
};

const touchStartX = ref(0);
const touchStartY = ref(0);
const touchDeltaX = ref(0);

const handleTouchStart = (e: TouchEvent) => {
    touchStartX.value = e.touches[0].clientX;
    touchStartY.value = e.touches[0].clientY;
    touchDeltaX.value = 0;
};

const handleTouchMove = (e: TouchEvent) => {
    const deltaX = e.touches[0].clientX - touchStartX.value;
    const deltaY = e.touches[0].clientY - touchStartY.value;

    if (Math.abs(deltaX) > Math.abs(deltaY)) {
        touchDeltaX.value = deltaX;
        e.preventDefault();
    }
};

const handleTouchEnd = () => {
    const threshold = -50;

    if (touchDeltaX.value < threshold && !showGenerationPanel.value) {
        showGenerationPanel.value = true;
    } else if (touchDeltaX.value > 50 && showGenerationPanel.value) {
        showGenerationPanel.value = false;
    }

    touchDeltaX.value = 0;
};

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

    if (showFavoritesOnly.value) {
        const favoriteIds = pokemonStore.favorites;
        list = list.filter((p) => favoriteIds.includes(p.id));
    }

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

    if (currentFilterTypes.value.length > 0) {
        list = list.filter((p) =>
            currentFilterTypes.value.some(type => p.types.includes(type))
        );
    }

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
.dex-page {
    color: #24262b;
    background:
        radial-gradient(circle at 18% -10%, #ffffff 0%, transparent 34%),
        linear-gradient(180deg, #f7f8fb 0%, #f1f2f6 46%, #eef0f5 100%);
}

.dex-page::before {
    position: absolute;
    inset: 0;
    pointer-events: none;
    content: '';
    background-image:
        linear-gradient(rgba(45, 49, 58, 0.025) 1px, transparent 1px),
        linear-gradient(90deg, rgba(45, 49, 58, 0.022) 1px, transparent 1px);
    background-size: 32px 32px;
    mask-image: linear-gradient(to bottom, rgba(0, 0, 0, 0.5), transparent 58%);
}

.dex-orb {
    position: absolute;
    border-radius: 999px;
    filter: blur(4px);
    pointer-events: none;
}

.dex-orb--leaf {
    right: -80px;
    top: 110px;
    width: 230px;
    height: 230px;
    background: radial-gradient(circle, rgba(95, 145, 65, 0.28), transparent 68%);
}

.dex-orb--gold {
    left: -90px;
    bottom: 160px;
    width: 210px;
    height: 210px;
    background: radial-gradient(circle, rgba(232, 181, 62, 0.24), transparent 68%);
}

.stat-tile {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 12px;
    border: 1px solid #e5e7ee;
    border-radius: 22px;
    background: #f5f6fa;
    box-shadow: inset 0 1px 0 #ffffff, 0 10px 24px rgba(48, 55, 72, 0.06);
}

.stat-tile__label {
    font-size: 10px;
    font-weight: 900;
    letter-spacing: 0.14em;
    color: #9da2ad;
}

.stat-tile__value {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 24px;
    font-weight: 900;
    line-height: 1;
    color: #24262b;
}

.toolbar-pill {
    position: relative;
    display: inline-flex;
    flex-shrink: 0;
    align-items: center;
    gap: 8px;
    height: 48px;
    padding: 0 16px;
    border: 1px solid rgba(51, 67, 34, 0.09);
    border-radius: 999px;
    color: #6f7480;
    font-size: 13px;
    font-weight: 900;
    background: #ffffff;
    box-shadow: inset 0 1px 0 #ffffff, 0 12px 24px rgba(48, 55, 72, 0.06);
    transition: transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
}

.toolbar-pill:active {
    transform: scale(0.96);
}

.toolbar-pill--active-green {
    color: #fff;
    background: linear-gradient(135deg, #34b85a, #178f42);
    box-shadow: 0 16px 30px rgba(52, 184, 90, 0.2);
}

.toolbar-pill--active-red {
    color: #fff;
    background: linear-gradient(135deg, #ff8a76, #f05245);
    box-shadow: 0 16px 30px rgba(240, 82, 69, 0.2);
}

.filter-stack {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 0;
}

.filter-stack__button {
    position: relative;
    display: flex;
    align-items: center;
    gap: 7px;
    min-width: 0;
    height: 37px;
    padding: 0 10px;
    border: 1px solid #e1e4eb;
    border-radius: 18px;
    color: #6f7480;
    font-size: 11px;
    font-weight: 900;
    background: #f5f6fa;
    box-shadow: inset 0 1px 0 #ffffff, 0 8px 16px rgba(48, 55, 72, 0.06);
    transition: transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
}

.filter-stack__button:active {
    transform: scale(0.96);
}

.filter-stack__button--active-green {
    color: #fff;
    background: linear-gradient(135deg, #34b85a, #178f42);
    box-shadow: 0 10px 20px rgba(52, 184, 90, 0.18);
}

.filter-stack__button--active-red {
    color: #fff;
    background: linear-gradient(135deg, #ff8a76, #f05245);
    box-shadow: 0 10px 20px rgba(240, 82, 69, 0.18);
}

.filter-stack__icon {
    flex-shrink: 0;
    width: 14px;
    height: 14px;
}

.filter-stack__text {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.icon-tool-button {
    position: relative;
    display: inline-flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 40px;
    padding: 0;
    margin: 0;
    color: #6f7480;
    line-height: 1;
    background: transparent;
    border: 0;
    transition: transform 0.2s ease, color 0.2s ease;
}

.icon-tool-button:active {
    transform: scale(0.9);
}

.icon-tool-button__svg {
    display: block;
    flex-shrink: 0;
    color: currentColor;
}

.icon-tool-button__svg--star {
    width: 21px;
    height: 21px;
}

.icon-tool-button__svg--arrow {
    width: 20px;
    height: 20px;
}

.icon-tool-button--favorite-active {
    color: #e04f47;
}

.toolbar-pill::after,
.panel-button::after {
    border: none !important;
}

.pill-dot {
    width: 7px;
    height: 7px;
    border-radius: 999px;
    background: currentColor;
    box-shadow: 0 0 0 4px rgba(255, 255, 255, 0.55);
}

.empty-card {
    border: 1px solid #e5e7ee;
    border-radius: 34px;
    background: #ffffff;
    box-shadow: 0 24px 70px rgba(48, 55, 72, 0.12);
}

.generation-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 12px;
    border: 1px solid #e5e7ee;
    border-radius: 22px;
    background: #f5f6fa;
    box-shadow: inset 0 1px 0 #ffffff, 0 10px 22px rgba(48, 55, 72, 0.06);
    transition: transform 0.2s ease, background 0.2s ease, border-color 0.2s ease;
}

.generation-item:active {
    transform: scale(0.98);
}

.generation-item--active {
    border-color: rgba(53, 125, 244, 0.32);
    background: linear-gradient(135deg, #eef4ff, #fff7dc);
}

.generation-item__mark {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 42px;
    height: 42px;
    border-radius: 16px;
    color: #6f7480;
    background: #eef0f5;
    box-shadow: inset 0 0 0 1px #ffffff;
}

.generation-item--active .generation-item__mark {
    color: #fff;
    background: linear-gradient(135deg, #73b7ff, #357df4);
}

.field-loader {
    width: 34px;
    height: 34px;
    border: 3px solid rgba(131, 179, 82, 0.2);
    border-top-color: #357df4;
    border-right-color: #f4c849;
    border-radius: 999px;
    animation: spin 0.8s linear infinite;
}

.custom-scrollbar {
    &::-webkit-scrollbar {
        width: 6px;
    }

    &::-webkit-scrollbar-track {
        background: transparent;
    }

    &::-webkit-scrollbar-thumb {
        border-radius: 3px;
        background: rgba(48, 55, 72, 0.18);

        &:hover {
            background: rgba(67, 83, 58, 0.3);
        }
    }
}

@keyframes spin {
    to {
        transform: rotate(360deg);
    }
}
</style>
