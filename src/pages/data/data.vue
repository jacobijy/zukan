<template>
    <TabPageShell :title="t('data.title')" :tabIndex="2" @tab-change="onTabChange">
        <view class="section-label">{{ t('data.sectionOverview') }}</view>
        <view class="data-list glass-panel">
            <ListRow
                v-for="(item, index) in overviewItems"
                :key="item.key"
                :title="item.label"
                :desc="item.desc"
                :meta="item.value"
                :iconClass="item.iconClass"
                :last="index === overviewItems.length - 1"
                showChevron
                @click="goOverview(item)"
            >
                <template #icon>
                    <svg v-if="item.icon === 'book'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" class="h-6 w-6">
                        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 3H20v18H6.5A2.5 2.5 0 0 1 4 18.5v-13A2.5 2.5 0 0 1 6.5 3z"></path><path d="M9 8h6"></path>
                    </svg>
                    <svg v-else-if="item.icon === 'spark'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" class="h-6 w-6">
                        <path d="m12 2 2.6 6.5L21 11l-6.4 2.5L12 20l-2.6-6.5L3 11l6.4-2.5L12 2z"></path>
                    </svg>
                    <svg v-else-if="item.icon === 'bolt'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" class="h-6 w-6">
                        <polygon points="13 2.5 4 14 12 14 11 21.5 20 10 12 10 13 2.5"></polygon>
                    </svg>
                    <svg v-else-if="item.icon === 'bag'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="h-6 w-6">
                        <path d="M6 7h12l1 13H5L6 7z"></path><path d="M9 7a3 3 0 0 1 6 0"></path>
                    </svg>
                    <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" class="h-6 w-6">
                        <path d="M12 3.5 19.5 8v8L12 20.5 4.5 16V8L12 3.5z"></path><path d="M12 12 19.5 8M12 12v8.5M12 12 4.5 8"></path>
                    </svg>
                </template>
            </ListRow>
        </view>

        <view class="section-label mt-6">{{ t('data.sectionPopular') }}</view>
        <view class="data-list glass-panel">
            <ListRow
                v-for="(pokemon, index) in popularPokemons"
                :key="pokemon.id"
                :title="pokemon.name"
                :desc="pokemon.type"
                :meta="t('data.detail')"
                :last="index === popularPokemons.length - 1"
                :iconClass="pokemon.markClass"
                showChevron
                @click="goToDetail(pokemon.id)"
            >
                <template #icon>
                    <text class="pokemon-mark__text">{{ String(pokemon.id).padStart(3, '0') }}</text>
                </template>
            </ListRow>
        </view>
    </TabPageShell>
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import TabPageShell from "@/components/shared/TabPageShell.vue";
import ListRow from "@/components/shared/ListRow.vue";
import { useI18nStore } from '@/store/i18n';
import { getTypeName } from '@/constants/pokemonTypes';

const { t } = useI18n();
const i18nStore = useI18nStore();
// 热门样本名称与属性都走 i18n 内容 bundle：随「宝可梦内容语言」切换，
// 深链/冷启动时名称可能未到，到达后自动刷新。概览计数也依赖名称组就绪。
void i18nStore.ensureLoaded();

interface OverviewEntry {
    key: string;
    value: string;
    label: string;
    desc: string;
    icon: 'book' | 'spark' | 'bolt' | 'cube' | 'bag';
    iconClass: string;
    /** tab 页用 reLaunch，子页用 navigateTo */
    url: string;
    tab?: boolean;
}

// 招式/特性/道具计数：名称组就绪后用真实条目数，未就绪回落静态串
const countOr = (n: number | undefined, fallback: string) =>
    n && n > 0 ? String(n) : fallback;

const overviewItems = computed<OverviewEntry[]>(() => [
    { key: 'pokemon', value: '1025', label: t('data.overview.total'), desc: t('data.overview.totalDesc'), icon: 'book', iconClass: 'list-row__icon--green', url: '/pages/index/index', tab: true },
    { key: 'types', value: '18', label: t('data.overview.types'), desc: t('data.overview.typesDesc'), icon: 'spark', iconClass: 'list-row__icon--gold', url: '/pages/archive/types' },
    { key: 'moves', value: countOr(i18nStore.lookup?.moves.size, '400+'), label: t('data.overview.moves'), desc: t('data.overview.movesDesc'), icon: 'bolt', iconClass: 'list-row__icon--blue', url: '/pages/archive/moves' },
    { key: 'abilities', value: countOr(i18nStore.lookup?.abilities.size, '300+'), label: t('data.overview.abilities'), desc: t('data.overview.abilitiesDesc'), icon: 'cube', iconClass: 'list-row__icon--violet', url: '/pages/archive/abilities' },
    { key: 'items', value: countOr(i18nStore.lookup?.items.size, '—'), label: t('data.overview.items'), desc: t('data.overview.itemsDesc'), icon: 'bag', iconClass: 'list-row__icon--gray', url: '/pages/archive/items' },
]);

// 物种名按 species id 查内容名称表；属性走 typeName（随内容语言），未就绪回落常量中文名。
const popularDefs = [
    { id: 25, speciesId: 25, fallback: '皮卡丘', types: ['electric'], markClass: 'pokemon-mark--gold' },
    { id: 6, speciesId: 6, fallback: '喷火龙', types: ['fire', 'flying'], markClass: 'pokemon-mark--red' },
    { id: 9, speciesId: 9, fallback: '水箭龟', types: ['water'], markClass: 'pokemon-mark--blue' }
];
const popularPokemons = computed(() =>
    popularDefs.map(p => ({
        id: p.id,
        name: i18nStore.speciesName(p.speciesId) ?? p.fallback,
        type: p.types.map(slug => i18nStore.typeName(slug) ?? getTypeName(slug)).join(' / '),
        markClass: p.markClass,
    }))
);

const goOverview = (item: OverviewEntry) => {
    if (item.tab) {
        // tab 页不能压栈（TabBar 用 reLaunch 切换）
        uni.reLaunch({ url: item.url });
    } else {
        uni.navigateTo({ url: item.url });
    }
};

const goToDetail = (id: number) => {
    uni.navigateTo({
        url: `/pages/detail/detail?id=${id}`
    });
};

const onTabChange = (_index: number) => {
    // TabBar handles tab switching internally
};
</script>

<style lang="scss" scoped>
/* 编号标记的字形；配色 .pokemon-mark--* 在 global.css（经 iconClass 传入 ListRow） */
.pokemon-mark__text {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 12px;
    font-weight: 900;
}
</style>
