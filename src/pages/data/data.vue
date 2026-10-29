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
                iconClass="list-row__icon--violet"
                last
                showChevron
                @click="goBattleData"
            >
                <template #icon>
                    <HubIcon name="data-meta" />
                </template>
            </ListRow>
        </view>

        <PopularPokemonSection />
    </TabPageShell>
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import TabPageShell from "@/components/shared/TabPageShell.vue";
import ListRow from "@/components/shared/ListRow.vue";
import HubIcon, { type HubIconName } from '@/components/shared/HubIcon.vue';
import PopularPokemonSection from '@/components/pokemon/PopularPokemonSection.vue';
import { useI18nStore } from '@/store/i18n';
import { navigateToAuto } from '@/utils/navigation';

const { t } = useI18n();
const i18nStore = useI18nStore();
// 概览计数依赖名称组就绪（招式/特性/道具/蛋组真实条目数）；
// 热门样本名称由 PopularPokemonSection 自行 ensureLoaded。
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
    { key: 'pokemon', value: '1025', label: t('data.overview.total'), desc: t('data.overview.totalDesc'), icon: 'data-dex', iconClass: 'list-row__icon--gray', url: '/pages/index/index', tab: true },
    { key: 'types', value: '18', label: t('data.overview.types'), desc: t('data.overview.typesDesc'), icon: 'data-type', iconClass: 'list-row__icon--gold', url: '/pages/archive/types' },
    { key: 'moves', value: countOr(i18nStore.lookup?.moves.size, '400+'), label: t('data.overview.moves'), desc: t('data.overview.movesDesc'), icon: 'data-move', iconClass: 'list-row__icon--blue', url: '/pages/archive/moves' },
    { key: 'abilities', value: countOr(i18nStore.lookup?.abilities.size, '300+'), label: t('data.overview.abilities'), desc: t('data.overview.abilitiesDesc'), icon: 'data-ability', iconClass: 'list-row__icon--red', url: '/pages/archive/abilities' },
    { key: 'items', value: countOr(i18nStore.lookup?.items.size, '—'), label: t('data.overview.items'), desc: t('data.overview.itemsDesc'), icon: 'data-item', iconClass: 'list-row__icon--green', url: '/pages/archive/items' },
    { key: 'eggGroups', value: countOr(i18nStore.lookup?.eggGroups.size, '15'), label: t('data.overview.eggGroups'), desc: t('data.overview.eggGroupsDesc'), icon: 'data-egg', iconClass: 'list-row__icon--violet', url: '/pages/archive/egg-groups' },
]);

const goOverview = (item: OverviewEntry) => {
    // tab 项自动 switchTab（保活）；其余普通子页 navigateTo
    navigateToAuto(item.url);
};

const goBattleData = () => {
    uni.navigateTo({ url: '/pages/meta/meta' });
};

const onTabChange = (_index: number) => {
    // TabBar handles tab switching internally
};
</script>
