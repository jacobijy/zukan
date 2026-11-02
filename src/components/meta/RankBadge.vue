<template>
    <view class="rank-badge" :class="tierClass">
        <!-- #ifdef MP-WEIXIN -->
        <text v-if="tier" class="ic rank-badge__crown">{{ glyph('crown') }}</text>
        <text v-else class="rank-badge__num">{{ label }}</text>
        <!-- #endif -->
        <!-- #ifndef MP-WEIXIN -->
        <svg
            v-if="tier"
            data-ic="crown"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.2"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="rank-badge__crown h-5 w-5"
        >
            <path d="M3.4 8.1 8 11.6 12 5l4 6.6 4.6-3.5-1.9 10.1H5.3L3.4 8.1Z" />
        </svg>
        <text v-else class="rank-badge__num">{{ label }}</text>
        <!-- #endif -->
    </view>
</template>

<script lang="ts" setup>
/**
 * 排行榜名次徽标：前三名用金 / 银 / 铜三色皇冠，其余显示两位序号。
 * 皇冠是单色字形（mp 端走图标字体），排名靠颜色区分，因此不需要额外文字。
 */
import { computed } from 'vue';
import { glyph } from '@/components/icon/glyphs';

const props = defineProps<{ rank: number }>();

const TIER_CLASS: Record<number, string> = {
    1: 'rank-badge--gold',
    2: 'rank-badge--silver',
    3: 'rank-badge--bronze',
};

const tierClass = computed(() => TIER_CLASS[props.rank] ?? '');
const tier = computed(() => props.rank <= 3 && props.rank >= 1);
const label = computed(() => String(props.rank).padStart(2, '0'));
</script>

<style lang="scss" scoped>
.rank-badge {
    display: flex;
    width: 24px;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
}

.rank-badge__num {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 13px;
    font-weight: 800;
    color: #b6bac3;
    text-align: center;
    font-variant-numeric: tabular-nums;
}

.rank-badge__crown {
    flex-shrink: 0;
    font-size: 20px;
}

.rank-badge--gold .rank-badge__crown {
    color: #e0a923;
}

.rank-badge--silver .rank-badge__crown {
    color: #9fa9b8;
}

.rank-badge--bronze .rank-badge__crown {
    color: #c08a52;
}
</style>
