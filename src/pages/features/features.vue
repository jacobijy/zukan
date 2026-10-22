<template>
    <TabPageShell :title="t('features.title')" :tabIndex="1" @tab-change="onTabChange">
        <view class="section-label">{{ t('features.sectionTools') }}</view>
        <view class="feature-list glass-panel">
            <ListRow
                v-for="(item, index) in featureItems"
                :key="item.title"
                :title="item.title"
                :desc="item.desc"
                :meta="item.meta"
                :iconClass="item.iconClass"
                :last="index === featureItems.length - 1"
                showChevron
                @click="goToPage(item.url)"
            >
                <template #icon>
                    <HubIcon :name="item.icon" />
                </template>
            </ListRow>
        </view>
    </TabPageShell>
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import TabPageShell from "@/components/shared/TabPageShell.vue";
import { navigateToAuto } from "@/utils/navigation";
import ListRow from "@/components/shared/ListRow.vue";
import HubIcon, { type HubIconName } from '@/components/shared/HubIcon.vue';

const { t } = useI18n();

interface FeatureEntry {
    title: string;
    desc: string;
    meta: string;
    url: string;
    icon: HubIconName;
    iconClass: string;
}

const featureItems = computed<FeatureEntry[]>(() => [
    { title: t('features.calc.title'), desc: t('features.calc.desc'), meta: t('features.calc.meta'), url: '/pages/calc/calc', icon: 'hub-damage', iconClass: 'list-row__icon--green' },
    { title: t('features.statcalc.title'), desc: t('features.statcalc.desc'), meta: t('features.statcalc.meta'), url: '/pages/statcalc/statcalc', icon: 'hub-stat', iconClass: 'list-row__icon--gold' },
    { title: t('features.simulate.title'), desc: t('features.simulate.desc'), meta: t('features.simulate.meta'), url: '/pages/simulate/simulate', icon: 'hub-battle', iconClass: 'list-row__icon--blue' },
    { title: t('features.teams.title'), desc: t('features.teams.desc'), meta: t('features.teams.meta'), url: '/pages/teams/teams', icon: 'hub-team', iconClass: 'list-row__icon--blue' },
    { title: t('features.templates.title'), desc: t('features.templates.desc'), meta: t('features.templates.meta'), url: '/pages/templates/templates', icon: 'hub-template', iconClass: 'list-row__icon--violet' },
    { title: t('features.stats.title'), desc: t('features.stats.desc'), meta: t('features.stats.meta'), url: '/pages/data/data', icon: 'hub-stats', iconClass: 'list-row__icon--violet' },
]);

const goToPage = (url: string) => {
    // /pages/data/data 是 tabBar 页 → 自动 switchTab（保活）；其余 navigateTo
    navigateToAuto(url);
};

const onTabChange = (_index: number) => {
    // TabBar handles tab switching internally
};
</script>
