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

                    <!-- 虚拟列表：glass-panel 衬底 + 裁剪圆角，VirtualList 自身是滚动容器 -->
                    <view v-else class="glass-panel h-full overflow-hidden">
                        <VirtualList :items="items" :item-height="ROW_HEIGHT" :item-key="itemKey" class="h-full">
                            <template #default="slotProps">
                                <slot :item="slotProps.item" :index="slotProps.index"></slot>
                            </template>
                        </VirtualList>
                    </view>
                </view>
            </view>
        </view>
    </view>
</template>

<script lang="ts" setup generic="T">
import DetailNavbar from '@/components/shared/DetailNavbar.vue';
import VirtualList from '@/components/dex/VirtualList.vue';

/** 虚拟列表固定行高；与 global.css `.archive-row` 高度一致（定高虚拟化前提） */
const ROW_HEIGHT = 68;

defineProps<{
    title: string;
    /** DetailNavbar 栈深为 1 时的 reLaunch 兜底页 */
    fallbackUrl: string;
    loading: boolean;
    empty: boolean;
    emptyTitle: string;
    emptyDesc?: string;
    /** 完整数据（过滤后的全量） */
    items: readonly T[];
    itemKey?: (item: T, index: number) => string | number;
}>();
</script>
