<template>
    <view class="list-row" :class="{ 'list-row--last': last }" @click="$emit('click')">
        <view v-if="$slots.icon" class="list-row__icon" :class="iconClass">
            <slot name="icon"></slot>
        </view>

        <view class="list-row__body">
            <view class="min-w-0 flex-1 py-3.5">
                <text class="list-row__title block text-[16px] font-semibold leading-5 tracking-[-0.01em]">{{ title }}</text>
                <text v-if="desc" class="list-row__desc mt-1 block text-[12px] font-medium leading-4">{{ desc }}</text>
                <slot name="body"></slot>
            </view>

            <view class="list-row__meta" v-if="$slots.meta || meta">
                <slot name="meta">
                    <text class="list-row__meta-text text-[11px] font-semibold">{{ meta }}</text>
                </slot>
                <!-- #ifdef MP-WEIXIN -->
                <text v-if="showChevron" class="ic list-row__chevron text-[16px]">{{ glyph('chevron-right') }}</text>
                <!-- #endif -->
                <!-- #ifndef MP-WEIXIN -->
                <svg v-if="showChevron" data-ic="chevron-right" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" class="list-row__chevron h-4 w-4">
                    <path d="m9 18 6-6-6-6"></path>
                </svg>
                <!-- #endif -->
            </view>
        </view>
    </view>
</template>

<script lang="ts" setup>
import { glyph } from '@/components/icon/glyphs';

defineProps<{
    title: string;
    desc?: string;
    meta?: string;
    iconClass?: string;
    last?: boolean;
    showChevron?: boolean;
}>();

defineEmits<{ click: [] }>();
</script>

<style scoped>
.list-row {
    display: flex;
    align-items: center;
    min-height: 78px;
    padding-left: 14px;
    transition: background-color 0.18s ease, transform 0.18s ease;
}

.list-row:active {
    background: rgba(241, 243, 248, 0.82);
    transform: scale(0.992);
}

/* .list-row__icon 及其配色变体在 global.css：
 * iconClass 由页面传入，scoped 选择器（0,2,0）会盖掉全局变体（0,1,0）的
 * 文字色，因此基础规则必须与变体同处全局、同特异性竞争。 */

.list-row__body {
    display: flex;
    flex: 1;
    align-items: center;
    min-width: 0;
    margin-left: 14px;
    padding-right: 12px;
    border-bottom: 1px solid rgba(222, 225, 232, 0.86);
}

.list-row--last .list-row__body {
    border-bottom: 0;
}

.list-row__title {
    color: var(--text-primary);
}

.list-row__desc {
    color: var(--text-secondary);
}

.list-row__meta-text {
    color: var(--text-secondary);
}

.list-row__chevron {
    color: var(--icon-tertiary);
}

.list-row__meta {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    gap: 4px;
    margin-left: 10px;
}
</style>