<template>
    <view class="calc-card">
        <view class="calc-head">
            <view v-if="$slots.icon" class="calc-head__icon" :class="iconClass">
                <slot name="icon" />
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
}

/* 底色与 ink 统一走全局 .func-tile--*（按图标主色自动生成的同色相浅底），
   由 iconClass 传入；这里不设 color/background，避免 scoped 高特异性盖过全局类。 */

.calc-head__title {
    font-size: 13px;
    font-weight: 800;
    letter-spacing: 0.04em;
    color: #3b3f48;
}
</style>