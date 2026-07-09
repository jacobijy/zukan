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

.list-row__icon {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    border-radius: 14px;
    color: #fff;
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.38), 0 10px 20px rgba(63, 70, 86, 0.12);
}

.list-row__icon--green {
    background: linear-gradient(135deg, #7ad66f 0%, #34b85a 58%, #178f42 100%);
}

.list-row__icon--blue {
    background: linear-gradient(135deg, #73b7ff 0%, #357df4 58%, #275bd8 100%);
}

.list-row__icon--violet {
    background: linear-gradient(135deg, #9a86f4 0%, #7350d4 58%, #4b32a6 100%);
}

.list-row__icon--gold {
    color: #4c3506;
    background: linear-gradient(135deg, #ffe7a8 0%, #f4c849 54%, #e99a24 100%);
}

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