<template>
    <view class="list-row" :class="{ 'list-row--last': last }" @click="$emit('click')">
        <view v-if="$slots.icon" class="list-row__icon" :class="iconClass">
            <slot name="icon"></slot>
        </view>

        <view class="list-row__body">
            <view class="min-w-0 flex-1 py-3.5">
                <text class="block text-[16px] font-semibold leading-5 tracking-[-0.01em] text-[#24262b]">{{ title }}</text>
                <text v-if="desc" class="mt-1 block text-[12px] font-medium leading-4 text-[#8d929c]">{{ desc }}</text>
                <slot name="body"></slot>
            </view>

            <view class="list-row__meta" v-if="$slots.meta || meta">
                <slot name="meta">
                    <text class="text-[11px] font-semibold text-[#b4b8c0]">{{ meta }}</text>
                </slot>
                <svg v-if="showChevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4 text-[#c4c7cf]">
                    <path d="m9 18 6-6-6-6"></path>
                </svg>
            </view>
        </view>
    </view>
</template>

<script lang="ts" setup>
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

.list-row__meta {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    gap: 4px;
    margin-left: 10px;
}
</style>