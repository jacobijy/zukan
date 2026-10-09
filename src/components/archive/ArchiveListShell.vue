<template>
    <view class="archive-page d-root h-screen page-bg flex flex-col overflow-hidden" :style="pageSafeArea">
        <DetailNavbar :title="title" :fallback-url="fallbackUrl" />

        <!--
            固定 navbar 用 paddingTop 让出位置（数据驱动内联 style，与图鉴 index 一致），
            不写 margin + calc(100vh - …)：根已是 h-screen overflow-hidden 的确定高度，
            剩余空间由 flex-1 自动得到，链条全程「确定高度 flex-col → flex-1 min-h-0」，
            不再依赖会因变量取不到而整条失效的 height calc。
        -->
        <view
            class="d-inner relative z-10 flex min-h-0 flex-1 flex-col"
            :style="{ paddingTop: 'var(--navbar-total-height)' }"
        >
            <view v-if="$slots.tools" class="flex-shrink-0 px-4 pb-2 pt-2">
                <view class="mx-auto w-full max-w-[720px]">
                    <slot name="tools"></slot>
                </view>
            </view>

            <!--
                空态：仅在「非加载且无数据」时替换列表。加载中一律保留下面的列表面板
                （VirtualList 不卸载），改用绝对定位的 loading 遮罩反馈。
                关键：VirtualList 若在加载时被销毁、加载后重建，微信会为新实例重新
                分配同名作用域插槽 id（d-0…d-18），与尚未清理的旧片段撞 id，框架报
                "More than one slot named d-N…"；列表面板常驻、数据原地更新时，窗口
                行数（≈视口/行高）与插槽 id 都稳定，警告不再出现，也没有重挂载闪烁。
                横向居中与两侧间距用 self-center + width/max-width，不进纵向高度链。
            -->
            <view
                v-if="empty"
                class="glass-panel flex min-h-0 w-[calc(100%-2rem)] max-w-[720px] flex-1 flex-col items-center justify-center self-center px-8 py-14 mb-5 text-center"
            >
                <text class="text-xl font-black tracking-[-0.03em] text-[#24262b]">{{ emptyTitle }}</text>
                <text v-if="emptyDesc" class="mt-2 block text-sm font-medium leading-6 text-[#8d929c]">{{ emptyDesc }}</text>
            </view>

            <!-- 列表区域：加载中（含首次空数据）也保持挂载，被下方遮罩盖住 -->
            <view
                v-else
                class="glass-panel d-panel min-h-0 w-[calc(100%-2rem)] max-w-[720px] flex-1 self-center overflow-hidden mb-5"
            >
                <slot name="list"></slot>
            </view>

            <!-- 加载遮罩：盖住 inner（固定 navbar 在其上层、仍可点返回），并阻止加载中再次切换 -->
            <view
                v-if="loading"
                class="absolute inset-0 z-20 flex items-center justify-center"
                :style="{ background: 'rgba(241,242,246,0.72)' }"
            >
                <view class="field-loader"></view>
            </view>
        </view>
    </view>
</template>

<script lang="ts" setup>
import DetailNavbar from '@/components/shared/DetailNavbar.vue';
import { usePageSafeArea } from '@/composables/usePageSafeArea';

// 页面根注入安全区变量（微信靠 wxml 数据驱动）
const pageSafeArea = usePageSafeArea();

defineProps<{
    title: string;
    /** DetailNavbar 栈深为 1 时 reLaunch 的兜底页 */
    fallbackUrl: string;
    loading: boolean;
    empty: boolean;
    emptyTitle: string;
    emptyDesc?: string;
}>();
</script>
