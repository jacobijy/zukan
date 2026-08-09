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

            <DexToolbar
                v-model:search="searchText"
                v-model:collapsed="isIndexCollapsed"
                :favorites-active="showFavoritesOnly"
                :generation-panel-open="showGenerationPanel"
                :generation-active="!!selectedGeneration"
                :generation-label="selectedGenerationLabel"
                :type-filter-open="isShow"
                :type-filter-active="currentFilterTypes.length > 0"
                :sample-count="filteredPokemons.length"
                :favorite-count="pokemonStore.favorites.length"
                @toggle-favorites="toggleFavoritesView"
                @toggle-generation="toggleGenerationPanel(!showGenerationPanel)"
                @toggle-type-filter="filterToggle(!isShow)"
            />

            <FilterBar v-show="isShow" @filterToggle="filterToggle" @filterChange="onFilterChange" />

            <FavoritesBanner
                v-if="showFavoritesOnly"
                :count="filteredPokemons.length"
                @show-all="toggleFavoritesView"
            />

            <view
                class="custom-scrollbar flex-1 min-h-0 overflow-y-auto px-3 pb-5 pt-4 sm:px-5"
                @scroll="onScroll"
                @touchstart="handleTouchStart"
                @touchmove="handleTouchMove"
                @touchend="handleTouchEnd"
            >
                <DexEmptyState v-if="loading" variant="loading" />

                <DexEmptyState
                    v-else-if="showFavoritesOnly && filteredPokemons.length === 0"
                    variant="favorites-empty"
                    @action="toggleFavoritesView"
                />

                <DexEmptyState
                    v-else-if="filteredPokemons.length === 0"
                    variant="no-match"
                    @action="clearSearch"
                />

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

        <GenerationDrawer
            v-model:visible="showGenerationPanel"
            v-model:selected="selectedGeneration"
        />

        <!--
            全局登录弹层。状态由 authGate 单例控制：getKey() 遇未认证时
            自动置 visible，登录成功后 authGate.notifySuccess() 唤醒等待者重试。
        -->
        <LoginModal
            v-model:visible="showLogin"
            @success="onLoginSuccess"
        />
    </view>
</template>

<script lang="ts" setup>
import DexToolbar from "@/components/dex/DexToolbar.vue";
import FilterBar from "@/components/dex/FilterBar.vue";
import FavoritesBanner from "@/components/dex/FavoritesBanner.vue";
import DexEmptyState from "@/components/dex/DexEmptyState.vue";
import GenerationDrawer from "@/components/dex/GenerationDrawer.vue";
import NavBar from "@/components/NavBar.vue";
import LoginModal from "@/components/shared/LoginModal.vue";
import PokemonCard from "@/components/pokemon/PokemonCard.vue";
import TabBar from "@/components/TabBar.vue";
import { usePokemonStore } from "@/store/pokemon";
import { authGate, LoginDismissedError } from "@/services/session/authGate";
import { debounce } from 'lodash-es';
import { storeToRefs } from "pinia";
import { computed, onMounted, ref } from "vue";
import { findGeneration, isInGeneration } from "@/constants/generations";

/**
 * 代理 authGate.visible，供 v-model 绑定。
 * 直接绑 `authGate.visible`（一个嵌套 Ref）会让 v-model 的赋值覆盖 ref 本身；
 * 用可写 computed 转成 `.value` 读写。
 */
const showLogin = computed({
    get: () => authGate.visible.value,
    set: (v: boolean) => { authGate.visible.value = v; },
});

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
        if (error instanceof LoginDismissedError) {
            // 用户关掉了登录弹层，主动选择不登录 —— 不是错误，不打 error 日志，
            // 列表保持空态（loading 已在 finally 中关掉）。
            return;
        }
        console.error("加载宝可梦数据失败:", error);
    } finally {
        loading.value = false;
    }
});

/**
 * 登录弹层成功回调：token 已由 authApi.login 写入存储。
 * 重新拉取数据 —— 此时 getKey() 拿着新 token 能正常拿到 DEK。
 */
async function onLoginSuccess() {
    authGate.notifySuccess();
    loading.value = true;
    try {
        await fetchPokemon();
    } catch (error) {
        if (!(error instanceof LoginDismissedError)) {
            console.error("登录后加载宝可梦数据失败:", error);
        }
    } finally {
        loading.value = false;
    }
}

const currentFilterTypes = ref<string[]>([]);
const currentSort = ref<string>('id');
const isShow = ref(false);
const currentTab = ref(0);
const showFavoritesOnly = ref(false);
const showGenerationPanel = ref(false);
const selectedGeneration = ref<string | null>(null);

const selectedGenerationLabel = computed(() => {
    return findGeneration(selectedGeneration.value)?.name ?? '世代';
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
        list = list.filter((p) => isInGeneration(p.id, selectedGeneration.value));
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
</style>
