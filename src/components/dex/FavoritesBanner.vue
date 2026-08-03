<template>
    <view class="mx-3 mt-3 rounded-[24px] border border-[#efd274] bg-[linear-gradient(135deg,#ffe7a8,#f4c849)] px-4 py-3 shadow-[0_15px_32px_rgba(148,94,14,0.16)] sm:mx-5">
        <view class="mx-auto flex max-w-[1400px] items-center justify-between gap-3">
            <view class="flex items-center gap-2">
                <view class="flex h-9 w-9 items-center justify-center rounded-full bg-white text-[#d99b00] shadow-[inset_0_1px_0_#ffffff]">
                    <svg viewBox="0 0 24 24" fill="currentColor" class="h-5 w-5">
                        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
                    </svg>
                </view>
                <view>
                    <text class="block text-sm font-black text-[#4c3506]">收藏标本架</text>
                    <text class="block text-xs font-semibold text-[#8a6a17]">当前显示 {{ count }} 只</text>
                </view>
            </view>
            <button class="panel-button rounded-full bg-white px-4 py-2 text-xs font-black text-[#4c3506] shadow-[inset_0_1px_0_#ffffff,0_8px_18px_rgba(111,82,9,0.12)] active:scale-95" @click="emit('show-all')">查看全部</button>
        </view>
    </view>
</template>

<script lang="ts" setup>
defineProps<{ count: number }>();

const emit = defineEmits<{ 'show-all': [] }>();
</script>

<style lang="scss" scoped>
.panel-button::after {
    border: none !important;
}
</style>
