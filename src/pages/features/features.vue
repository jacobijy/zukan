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
                    <svg v-if="item.icon === 'target'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" class="h-6 w-6">
                        <circle cx="12" cy="12" r="8"></circle><circle cx="12" cy="12" r="3"></circle>
                        <path d="M12 4v3M12 17v3M4 12h3M17 12h3"></path>
                    </svg>
                    <svg v-else-if="item.icon === 'grid'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" class="h-6 w-6">
                        <rect x="3.5" y="3.5" width="17" height="17" rx="4"></rect><path d="M3.5 9.5h17M9.5 20.5v-11"></path>
                    </svg>
                    <svg v-else-if="item.icon === 'chart'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" class="h-6 w-6">
                        <path d="M4 19V5"></path><path d="M8.5 19v-6"></path><path d="M13 19V8"></path><path d="M17.5 19v-9"></path><path d="M3.5 19h17"></path>
                    </svg>
                    <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" class="h-6 w-6">
                        <rect x="3.5" y="5" width="17" height="14" rx="3"></rect><path d="m4.5 7.5 7.5 5.25 7.5-5.25"></path>
                    </svg>
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

const { t } = useI18n();

const featureItems = computed(() => [
    { title: t('features.calc.title'), desc: t('features.calc.desc'), meta: t('features.calc.meta'), url: '/pages/calc/calc', icon: 'target', iconClass: 'list-row__icon--green' },
    { title: t('features.simulate.title'), desc: t('features.simulate.desc'), meta: t('features.simulate.meta'), url: '/pages/simulate/simulate', icon: 'grid', iconClass: 'list-row__icon--blue' },
    { title: t('features.stats.title'), desc: t('features.stats.desc'), meta: t('features.stats.meta'), url: '/pages/data/data', icon: 'chart', iconClass: 'list-row__icon--violet' },
]);

const goToPage = (url: string) => {
    uni.navigateTo({ url });
};

const onTabChange = (_index: number) => {
    // TabBar handles tab switching internally
};
</script>
