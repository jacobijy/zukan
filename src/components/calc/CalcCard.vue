<template>
    <view class="calc-card">
        <view class="calc-head">
            <view class="calc-head__icon" :class="iconClass">
                <slot name="icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4">
                        <circle cx="12" cy="12" r="8"></circle><circle cx="12" cy="12" r="3"></circle>
                        <path d="M12 4v3M12 17v3M4 12h3M17 12h3"></path>
                    </svg>
                </slot>
            </view>
            <text class="calc-head__title">{{ title }}</text>
        </view>
        <slot />
    </view>
</template>

<script lang="ts" setup>
defineProps<{
    title: string;
    iconClass: string;
}>();
</script>

<style lang="scss" scoped>
.calc-card {
    border: 1px solid #e5e7ee;
    border-radius: 20px;
    background: #ffffff;
    box-shadow: 0 10px 24px rgba(48, 55, 72, 0.06);
    overflow: hidden;
}

.calc-head {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;
    border-bottom: 1px solid #eef0f5;
    background: #fafbfd;
}

.calc-head__icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    border-radius: 8px;
    color: #ffffff;
}

.calc-head__icon--green {
    background: linear-gradient(135deg, #68cc67, #34b85a);
}

.calc-head__icon--blue {
    background: linear-gradient(135deg, #73b7ff, #357df4);
}

.calc-head__icon--violet {
    background: linear-gradient(135deg, #9a86f4, #7350d4);
}

.calc-head__icon--gold {
    background: linear-gradient(135deg, #f4d06f, #d89a1e);
}

.calc-head__title {
    font-size: 13px;
    font-weight: 800;
    letter-spacing: 0.04em;
    color: #3b3f48;
}
</style>