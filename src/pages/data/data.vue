<template>
    <TabPageShell :title="t('data.title')" :tabIndex="2" @tab-change="onTabChange">
        <template v-for="(section, sectionIndex) in sections" :key="section.key">
            <view :class="['section-label', sectionIndex > 0 ? 'mt-6' : '']">{{ t(section.labelKey) }}</view>
            <view class="data-list glass-panel">
                <ListRow
                    v-for="(item, index) in section.rows"
                    :key="item.key"
                    :title="t(item.titleKey)"
                    :desc="t(item.descKey)"
                    :meta="metaText(item.meta)"
                    :iconClass="item.iconClass"
                    :last="index === section.rows.length - 1"
                    showChevron
                    @click="goToPage(item.url)"
                >
                    <template #icon>
                        <HubIcon :name="item.icon" />
                    </template>
                </ListRow>
            </view>
        </template>

        <PopularPokemonSection />
    </TabPageShell>
</template>

<script lang="ts" setup>
import { useI18n } from 'vue-i18n';
import TabPageShell from "@/components/shared/TabPageShell.vue";
import ListRow from "@/components/shared/ListRow.vue";
import HubIcon from '@/components/shared/HubIcon.vue';
import PopularPokemonSection from '@/components/pokemon/PopularPokemonSection.vue';
import { useI18nStore } from '@/store/i18n';
import { navigateToAuto } from '@/utils/navigation';
import { DATA_SECTIONS, resolveSections, type EntryCountMeta } from '@/constants/entryConfig';

const { t } = useI18n();
const i18nStore = useI18nStore();
// 概览计数依赖名称组就绪（招式/特性/道具/蛋组真实条目数）；
// 热门样本名称由 PopularPokemonSection 自行 ensureLoaded。
void i18nStore.ensureLoaded();

/** 资料页三分区（配置见 src/constants/entryConfig.ts，分区与条目 key 自由组合） */
const sections = resolveSections(DATA_SECTIONS);

// 招式/特性/道具计数：名称组就绪后用真实条目数，未就绪回落静态串
const countOr = (n: number | undefined, fallback: string) =>
    n && n > 0 ? String(n) : fallback;

/** 第三列：i18n key → t()；计数型 → 真实条目数或回落 */
const metaText = (m: string | EntryCountMeta | undefined): string => {
    if (!m) return '';
    if (typeof m === 'string') return t(m);
    const n = i18nStore.lookup?.[m.countOf]?.size;
    return countOr(n, m.fallback);
};

const goToPage = (url: string) => {
    // tab 页 → switchTab（保活）；其余 navigateTo（同为既有导航封装）
    navigateToAuto(url);
};

const onTabChange = (_index: number) => {
    // TabBar handles tab switching internally
};
</script>