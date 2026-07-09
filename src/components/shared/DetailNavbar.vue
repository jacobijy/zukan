<template>
    <view class="det-navbar fixed left-0 right-0 top-0 z-[1000] flex items-center justify-between px-4 pb-3" :style="{ paddingTop: 'var(--status-bar-height)' }">
        <button class="det-navbar__btn" @click="handleBack">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5">
                <path d="M19 12H5"></path>
                <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
        </button>

        <view class="min-w-0 flex-1 px-3 text-center">
            <text class="block truncate text-lg font-black tracking-[-0.04em] text-[#24262b]">{{ title }}</text>
        </view>

        <view class="det-navbar__right">
            <slot name="right">
                <view class="det-navbar__btn det-navbar__btn--ghost">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5">
                        <path d="M12 8h.01"></path>
                        <path d="M11 12h1v4h1"></path>
                        <circle cx="12" cy="12" r="9"></circle>
                    </svg>
                </view>
            </slot>
        </view>
    </view>
</template>

<script lang="ts" setup>
defineProps<{ title: string }>();

const emit = defineEmits<{ back: [] }>();

const handleBack = () => {
    emit('back');
    uni.navigateBack({
        fail: () => { uni.reLaunch({ url: '/pages/features/features' }); }
    });
};
</script>

<style scoped>
.det-navbar {
    background: #ffffff;
    border-bottom: 1px solid #e5e7ee;
    box-shadow: 0 4px 18px rgba(48, 55, 72, 0.06);
}

.det-navbar__btn {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    padding: 0;
    margin: 0;
    color: #8d929c;
    background: transparent;
    border: 0;
}

.det-navbar__btn--ghost {
    color: #c4c7cf;
}

.det-navbar__right {
    display: flex;
    flex-shrink: 0;
    align-items: center;
}
</style>