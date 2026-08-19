<template>
    <view class="info-card" :class="{ 'info-card--wide': wide }">
        <view class="info-card__icon" :class="iconClass">
            <slot name="icon" />
        </view>
        <view class="min-w-0 flex-1">
            <text class="block text-[10px] font-black tracking-[0.14em] text-[#8d929c]">{{ label }}</text>
            <slot name="value">
                <text class="mt-1 block truncate text-base font-black text-[#24262b]">{{ value }}</text>
            </slot>
        </view>
    </view>
</template>

<script lang="ts" setup>
defineProps<{
    label: string;
    value: string;
    iconClass: string;
    /** 横跨整行（用于列表型内容如多个特性） */
    wide?: boolean;
}>();
</script>

<style scoped>
.info-card {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 0;
    padding: 13px;
    border-radius: 22px;
    border: 1px solid #e5e7ee;
    background: #ffffff;
    box-shadow: 0 14px 34px rgba(48, 55, 72, 0.08);
}

.info-card__icon {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    width: 42px;
    height: 42px;
    border-radius: 15px;
}

.info-card--wide {
    grid-column: 1 / -1;
    align-items: flex-start;
}

.info-card--wide .info-card__icon {
    margin-top: 1px;
}

.info-card__icon--green {
    color: #ffffff;
    background: linear-gradient(135deg, #68cc67, #34b85a);
}

.info-card__icon--gold {
    color: #3b2c0d;
    background: linear-gradient(135deg, #f4d06f, #d89a1e);
}

.info-card__icon--red {
    color: #ffffff;
    background: linear-gradient(135deg, #ff7b6e, #e04f47);
}

.info-card__icon--paper {
    color: #ffffff;
    background: linear-gradient(135deg, #73b7ff, #357df4);
}
</style>