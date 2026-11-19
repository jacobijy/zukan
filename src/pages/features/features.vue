<template>
    <TabPageShell :title="t('features.title')" :tabIndex="1" @tab-change="onTabChange">
        <view class="section-label">{{ t(toolsSection.labelKey) }}</view>
        <view class="feature-list glass-panel">
            <ListRow
                v-for="(item, index) in toolsSection.rows"
                :key="item.key"
                :title="t(item.titleKey)"
                :desc="t(item.descKey)"
                :meta="metaText(item.meta)"
                :iconClass="item.iconClass"
                :last="index === toolsSection.rows.length - 1"
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
import { useI18n } from 'vue-i18n';
import TabPageShell from "@/components/shared/TabPageShell.vue";
import { navigateToAuto } from "@/utils/navigation";
import ListRow from "@/components/shared/ListRow.vue";
import HubIcon from '@/components/shared/HubIcon.vue';
import { FEATURE_SECTIONS, resolveSections, type EntryCountMeta } from '@/constants/entryConfig';

const { t } = useI18n();

/** 功能页单分区（配置见 src/constants/entryConfig.ts，条目 key 自由组合） */
const toolsSection = resolveSections(FEATURE_SECTIONS)[0];

/** 功能页第三列都是 i18n key；计数型兜底为空（功能页不使用） */
const metaText = (m: string | EntryCountMeta | undefined): string => (typeof m === 'string' ? t(m) : '');

const goToPage = (url: string) => {
    // tab 页 → switchTab（保活）；其余 navigateTo（同为既有导航封装）
    navigateToAuto(url);
};

const onTabChange = (_index: number) => {
    // TabBar handles tab switching internally
};
</script>