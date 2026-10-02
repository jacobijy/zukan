<template>
    <view class="archive-page min-h-screen page-bg flex flex-col" :style="{ paddingTop: 'var(--status-bar-height)' }">
        <DetailNavbar :title="title" :fallback-url="fallbackUrl" />

        <view
            class="relative z-10 flex flex-1 flex-col"
            style="margin-top: calc(var(--status-bar-height) + 52px); height: calc(100vh - var(--status-bar-height) - 52px)"
        >
            <view v-if="$slots.tools" class="flex-shrink-0 px-4 pb-2 pt-2">
                <view class="mx-auto w-full max-w-[720px]">
                    <slot name="tools"></slot>
                </view>
            </view>

            <view class="min-h-0 flex-1 px-4 pb-5">
                <view class="mx-auto h-full w-full max-w-[720px]">
                    <!-- 加载中 -->
                    <view v-if="loading" class="flex h-full items-center justify-center">
                        <view class="field-loader"></view>
                    </view>

                    <!-- 空态（搜索无结果 / 数据为空） -->
                    <view v-else-if="empty" class="glass-panel flex h-full flex-col items-center justify-center px-8 py-14 text-center">
                        <text class="text-xl font-black tracking-[-0.03em] text-[#24262b]">{{ emptyTitle }}</text>
                        <text v-if="emptyDesc" class="mt-2 block text-sm font-medium leading-6 text-[#8d929c]">{{ emptyDesc }}</text>
                    </view>

                    <!--
                        列表区域：调用方把 <VirtualList> 整体放进 #list。
                        刻意不在本壳内嵌 VirtualList + 透传作用域插槽：那会形成
                        页面 → 本壳 → VirtualList 的三级作用域插槽链，uni-app 编译到
                        微信时会在循环里重复展开本壳的同名 <slot>（报 "More than one
                        slot named ..."，且只有第一行能收到内容）。改为单一具名 slot，
                        slot 链收敛成 页面 → VirtualList 两级。
                    -->
                    <view v-else class="glass-panel h-full overflow-hidden">
                        <slot name="list"></slot>
                    </view>
                </view>
            </view>
        </view>
    </view>
</template>

<script lang="ts" setup>
import DetailNavbar from '@/components/shared/DetailNavbar.vue';

defineProps<{
    title: string;
    /** DetailNavbar 栈深为 1 时的 reLaunch 兜底页 */
    fallbackUrl: string;
    loading: boolean;
    empty: boolean;
    emptyTitle: string;
    emptyDesc?: string;
}>();
</script>
