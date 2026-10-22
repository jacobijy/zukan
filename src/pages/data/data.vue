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
                    <HubIcon :name="item.icon" />
                </template>
            </ListRow>
        </view>

        <view class="section-label mt-6">{{ t('data.sectionBattle') }}</view>
        <view class="data-list glass-panel">
            <ListRow
                :title="t('meta.entryTitle')"
                :desc="t('meta.entryDesc')"
                iconClass="list-row__icon--red"
                last
                showChevron
                @click="goBattleData"
            >
                <template #icon>
                    <HubIcon name="data-meta" />
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
import HubIcon, { type HubIconName } from '@/components/shared/HubIcon.vue';
import { useI18nStore } from '@/store/i18n';
import { getTypeName } from '@/constants/pokemonTypes';
import { navigateToAuto } from '@/utils/navigation';

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
    icon: HubIconName;
    iconClass: string;
    /** tab 页用 reLaunch，子页用 navigateTo */
    url: string;
    tab?: boolean;
}

// 招式/特性/道具计数：名称组就绪后用真实条目数，未就绪回落静态串
const countOr = (n: number | undefined, fallback: string) =>
    n && n > 0 ? String(n) : fallback;

const overviewItems = computed<OverviewEntry[]>(() => [
    { key: 'pokemon', value: '1025', label: t('data.overview.total'), desc: t('data.overview.totalDesc'), icon: 'data-dex', iconClass: 'list-row__icon--green', url: '/pages/index/index', tab: true },
    { key: 'types', value: '18', label: t('data.overview.types'), desc: t('data.overview.typesDesc'), icon: 'data-type', iconClass: 'list-row__icon--gold', url: '/pages/archive/types' },
    { key: 'moves', value: countOr(i18nStore.lookup?.moves.size, '400+'), label: t('data.overview.moves'), desc: t('data.overview.movesDesc'), icon: 'data-move', iconClass: 'list-row__icon--blue', url: '/pages/archive/moves' },
    { key: 'abilities', value: countOr(i18nStore.lookup?.abilities.size, '300+'), label: t('data.overview.abilities'), desc: t('data.overview.abilitiesDesc'), icon: 'data-ability', iconClass: 'list-row__icon--violet', url: '/pages/archive/abilities' },
    { key: 'items', value: countOr(i18nStore.lookup?.items.size, '—'), label: t('data.overview.items'), desc: t('data.overview.itemsDesc'), icon: 'data-item', iconClass: 'list-row__icon--gray', url: '/pages/archive/items' },
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
    // tab 项自动 switchTab（保活）；其余普通子页 navigateTo
    navigateToAuto(item.url);
};

const goToDetail = (id: number) => {
    uni.navigateTo({
        url: `/pages/detail/detail?id=${id}`
    });
};

const goBattleData = () => {
    uni.navigateTo({ url: '/pages/meta/meta' });
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
