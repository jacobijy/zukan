<template>
    <view class="det-navbar fixed left-0 right-0 top-0 z-[1000] flex items-center justify-between px-4" :style="{ paddingTop: 'var(--status-bar-height)', height: 'calc(var(--status-bar-height) + 52px)' }">
        <button class="det-navbar__btn" @click="handleBack">
            <!-- #ifdef MP-WEIXIN -->
            <text class="ic text-[20px]">{{ glyph('arrow-left') }}</text>
            <!-- #endif -->
            <!-- #ifndef MP-WEIXIN -->
            <svg data-ic="arrow-left" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5">
                <path d="M19 12H5"></path>
                <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
            <!-- #endif -->
        </button>

        <view class="flex min-w-0 flex-1 items-center justify-center px-3">
            <text class="block truncate text-lg font-black tracking-[-0.04em] text-[#24262b]">{{ title }}</text>
        </view>

        <view class="det-navbar__right">
            <slot name="right">
                <view class="det-navbar__btn det-navbar__btn--ghost">
                    <!-- #ifdef MP-WEIXIN -->
                    <text class="ic text-[20px]">{{ glyph('info') }}</text>
                    <!-- #endif -->
                    <!-- #ifndef MP-WEIXIN -->
                    <svg data-ic="info" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5">
                        <path d="M12 8h.01"></path>
                        <path d="M11 12h1v4h1"></path>
                        <circle cx="12" cy="12" r="9"></circle>
                    </svg>
                    <!-- #endif -->
                </view>
            </slot>
        </view>
    </view>
</template>

<script lang="ts" setup>
import { glyph } from '@/components/icon/glyphs';
import { navigateToAuto } from '@/utils/navigation';

const props = withDefaults(defineProps<{
    title: string;
    /** 无上一页可回退时（H5 刷新/深链直达）reLaunch 的目标页 */
    fallbackUrl?: string;
}>(), {
    fallbackUrl: '/pages/features/features'
});

const emit = defineEmits<{ back: [] }>();

const handleBack = () => {
    emit('back');
    // H5 直接刷新/深链进入时页面栈只有当前页，navigateBack 走 history.back()
    // 且 fail 回调不可靠，必须显式判断栈深；无上一页时跳到 fallback（默认是
    // tabBar 页，navigateToAuto 自动走 switchTab 保活）。
    if (getCurrentPages().length > 1) {
        uni.navigateBack();
    } else {
        navigateToAuto(props.fallbackUrl);
    }
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