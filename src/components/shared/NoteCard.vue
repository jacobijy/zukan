<template>
    <view class="note-card">
        <view class="note-card__shine" :style="shineColor ? { background: shineColor } : {}"></view>
        <text class="relative z-10 block text-[13px] font-bold text-[#3b3f48]">{{ title }}</text>
        <text class="relative z-10 mt-1 block text-[12px] font-medium leading-5 text-[#8a8f99]">{{ desc }}</text>
        <slot></slot>
    </view>
</template>

<script lang="ts" setup>
defineProps<{
    title: string;
    desc: string;
    shineColor?: string;
}>();
</script>

<style scoped>
.note-card {
    position: relative;
    padding: 16px;
    overflow: hidden;
    border: 1px solid rgba(255, 255, 255, 0.78);
    border-radius: 24px;
    background: rgba(255, 255, 255, 0.92);
    box-shadow: 0 18px 42px rgba(48, 55, 72, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.88);
    backdrop-filter: blur(18px);
}

.note-card__shine {
    position: absolute;
    right: -32px;
    top: -48px;
    width: 130px;
    height: 130px;
    border-radius: 999px;
    background: radial-gradient(circle, rgba(83, 144, 244, 0.14), transparent 67%);
}
</style>