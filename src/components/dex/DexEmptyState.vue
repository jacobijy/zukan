<template>
    <!-- 加载中 -->
    <view v-if="variant === 'loading'" class="mx-auto flex max-w-[1400px] flex-col items-center justify-center py-20 text-[#8d929c]">
        <view class="field-loader mb-4"></view>
        <text class="text-sm font-black tracking-[0.18em]">{{ t('dex.empty.loading') }}</text>
    </view>

    <!-- 收藏夹为空 -->
    <view v-else-if="variant === 'favorites-empty'" class="empty-card mx-auto max-w-[560px] px-8 py-14 text-center">
        <view class="mx-auto mb-5 flex h-24 w-24 items-center justify-center rounded-[32px] bg-[#fff1b8] text-[#c58a17] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.72),0_18px_34px_rgba(114,83,27,0.15)]">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" class="h-12 w-12">
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
            </svg>
        </view>
        <text class="block text-xl font-black tracking-[-0.03em] text-[#24262b]">{{ t('dex.empty.favTitle') }}</text>
        <text class="mt-2 block text-sm font-medium leading-6 text-[#8d929c]">{{ t('dex.empty.favDesc') }}</text>
        <button class="panel-button mt-6 rounded-full bg-[#24262b] px-6 py-3 text-sm font-black text-white shadow-[0_14px_30px_rgba(48,55,72,0.22)] active:scale-95" @click="emit('action')">{{ t('dex.empty.favAction') }}</button>
    </view>

    <!-- 筛选无结果 -->
    <view v-else class="empty-card mx-auto max-w-[560px] px-8 py-14 text-center">
        <text class="block text-xl font-black tracking-[-0.03em] text-[#24262b]">{{ t('dex.empty.noMatchTitle') }}</text>
        <text class="mt-2 block text-sm font-medium leading-6 text-[#8d929c]">{{ t('dex.empty.noMatchDesc') }}</text>
        <button class="panel-button mt-6 rounded-full bg-[#357df4] px-6 py-3 text-sm font-black text-white shadow-[0_14px_30px_rgba(53,125,244,0.22)] active:scale-95" @click="emit('action')">{{ t('dex.empty.clearAction') }}</button>
    </view>
</template>

<script lang="ts" setup>
import { useI18n } from 'vue-i18n';
const { t } = useI18n();
defineProps<{
    variant: 'loading' | 'favorites-empty' | 'no-match';
}>();

/** loading 态没有按钮，不会触发 */
const emit = defineEmits<{ action: [] }>();
</script>

<style lang="scss" scoped>
.empty-card {
    border: 1px solid #e5e7ee;
    border-radius: 34px;
    background: #ffffff;
    box-shadow: 0 24px 70px rgba(48, 55, 72, 0.12);
}

.panel-button::after {
    border: none !important;
}
</style>
