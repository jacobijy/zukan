<template>
    <view class="archive-row" @click="emit('select')">
        <text class="rank-num" :class="{ 'rank-num--top': rank <= 3 }">{{ String(rank).padStart(2, '0') }}</text>

        <EncryptedSprite
            :pokemon-id="item.speciesId"
            variant="front"
            :preview="false"
            img-class="h-10 w-10"
            skeleton-class="h-10 w-10"
        />

        <view class="archive-row__main">
            <text class="archive-row__title">{{ name }}</text>
            <view class="rank-bar">
                <view class="rank-bar__fill" :style="{ width: `${item.barWidth}%` }"></view>
            </view>
        </view>

        <text class="archive-row__meta rank-pct">{{ t('meta.usagePercent', { value: item.usageRate }) }}</text>
    </view>
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import EncryptedSprite from '@/components/sprite/EncryptedSprite.vue';
import { useI18nStore } from '@/store/i18n';
import type { UsageRankingItem } from '@/services/meta';

const props = defineProps<{
    item: UsageRankingItem;
    rank: number;
}>();
const emit = defineEmits<{ select: [] }>();

const { t } = useI18n();
const i18nStore = useI18nStore();

// 名称走内容名称表（随内容语言切换）；未就绪回落 pokemon-{id} 占位
const name = computed(
    () => i18nStore.speciesName(props.item.speciesId) ?? `pokemon-${props.item.speciesId}`,
);
</script>

<style lang="scss" scoped>
.rank-num {
    width: 24px;
    flex-shrink: 0;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 13px;
    font-weight: 800;
    color: #b6bac3;
    text-align: center;
    font-variant-numeric: tabular-nums;
}

.rank-num--top {
    color: #e0a923;
    font-weight: 900;
}

.rank-bar {
    height: 6px;
    overflow: hidden;
    border-radius: 999px;
    background: #eef0f5;
}

.rank-bar__fill {
    height: 100%;
    border-radius: inherit;
    background: linear-gradient(90deg, #73b7ff, #357df4);
}

.rank-pct {
    color: #24262b;
}
</style>
