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
                :sample-count="matchedCount"
                :favorite-count="pokemonStore.favorites.length"
                @toggle-favorites="toggleFavoritesView"
                @toggle-generation="toggleGenerationPanel(!showGenerationPanel)"
                @toggle-type-filter="filterToggle(!isShow)"
            />

            <FilterBar v-show="isShow" @filterToggle="filterToggle" @filterChange="onFilterChange" />

            <FavoritesBanner
                v-if="showFavoritesOnly"
                :count="matchedCount"
                @show-all="toggleFavoritesView"
            />

            <!--
                空态与列表互斥。空态包一层撑满剩余高度的容器，替代原先由
                滚动容器提供的 `flex-1 min-h-0`（虚拟列表接管滚动后空态不再在其内部）。
            -->
            <view
                v-if="loading || matchedCount === 0"
                class="flex-1 min-h-0 overflow-y-auto px-3 pb-5 pt-4 sm:px-5"
            >
                <DexEmptyState v-if="loading" variant="loading" />

                <DexEmptyState
                    v-else-if="showFavoritesOnly"
                    variant="favorites-empty"
                    @action="toggleFavoritesView"
                />

                <DexEmptyState v-else variant="no-match" @action="clearSearch" />
            </view>

            <!--
                虚拟化列表：DOM 只保留视口附近的行（1025 条实测 3083 → 35 节点）。
                列数与 gap 的响应式定义只写在 grid-class 里一处，组件从
                computed style 读回来算窗口，不复制断点。
            -->
            <VirtualGrid
                v-else
                :items="matchedPokemons"
                :item-key="pokemonKey"
                scroller-class="custom-scrollbar flex-1 min-h-0 px-3 pb-5 pt-4 sm:px-5"
                grid-class="mx-auto max-w-[1400px] grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3 sm:grid-cols-[repeat(auto-fill,minmax(310px,1fr))] sm:gap-4 2xl:grid-cols-[repeat(auto-fill,minmax(340px,1fr))]"
                @touchstart="handleTouchStart"
                @touchmove="handleTouchMove"
                @touchend="handleTouchEnd"
            >
                <template #default="{ item }">
                    <PokemonCard :pokemon="item as IPokemonCardModel" />
                </template>
            </VirtualGrid>
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
import VirtualGrid from "@/components/dex/VirtualGrid.vue";
import TabBar from "@/components/TabBar.vue";
import { usePokemonStore } from "@/store/pokemon";
import { authGate, LoginDismissedError } from "@/services/session/authGate";
import { debounce } from 'lodash-es';
import { storeToRefs } from "pinia";
import { computed, onMounted, ref, watch } from "vue";
import { findGeneration } from "@/constants/generations";
import type { DexSortKey } from "@/utils/dexFilter";

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
const { matchedPokemons, matchedCount } = storeToRefs(pokemonStore);
const { fetchPokemon, setCriteria } = pokemonStore;
const searchText = ref("");
/**
 * 已有数据时（从其他 tab 切回）不进 loading 态，避免整页闪空态再重渲染列表。
 * 数据由 boot 预取 + 内存 LRU 缓存保证新鲜度，session 内无需重拉。
 */
const loading = ref(pokemonStore.allPokemons.length === 0);
const isIndexCollapsed = ref(true);

/** 虚拟列表的稳定 key —— 回收复用时下标会变，必须用 id */
const pokemonKey = (item: IPokemonBaseModel) => item.id;

onMounted(async () => {
    // 切 tab 走 reLaunch 会重建页面；store 已有数据时跳过 fetch，
    // 避免重跑 mergeBundleToModel（1351 对象分配）+ 全列表重渲染。
    if (pokemonStore.allPokemons.length > 0) return;
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
const currentSort = ref<DexSortKey>('id');
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
    currentSort.value = filterData.sort as DexSortKey;
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

const clearSearch = () => {
    searchText.value = '';
};

/**
 * 页面级筛选状态 → store。
 *
 * store 用它对**全量**筛选排序后再分页（`visibleList`），所以世代/搜索这类
 * 会滤掉首页 20 条的条件也能正常出结果。
 *
 * 搜索走 300ms 防抖：`searchText` 每次按键都变，而筛选要重算 1025 条。
 * 其余条件是离散点击，立即生效。
 */
const debouncedQuery = ref('');
const applyQuery = debounce((v: string) => { debouncedQuery.value = v; }, 300);

watch(searchText, (v) => {
    // 清空立即生效，不等防抖（点 × 应当马上看到全量列表）
    if (!v) {
        applyQuery.cancel();
        debouncedQuery.value = '';
        return;
    }
    applyQuery(v);
});

watch(
    [showFavoritesOnly, selectedGeneration, currentFilterTypes, currentSort, debouncedQuery],
    ([favoritesOnly, generation, types, sort, query]) => {
        setCriteria({
            favoritesOnly,
            generation,
            types,
            sort,
            query,
        });
    },
    { immediate: true },
);

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
