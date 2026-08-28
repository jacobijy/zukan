<template>
    <view ref="wrapperRef" class="inline-flex items-center justify-center">
        <image v-if="blobUrl" :src="blobUrl" class="object-contain" :class="sizeClass" mode="aspectFit" />
        <!-- 加载中：骨架盒 -->
        <view v-else-if="loading" :class="[sizeClass, 'item-skeleton rounded-2xl']"></view>
        <!-- 无资源 / 加载失败：中性占位盒 -->
        <view
            v-else
            class="flex items-center justify-center rounded-2xl bg-[#eef0f5] text-[#b4b8c0]"
            :class="sizeClass"
        >
            <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                :class="iconClass"
            >
                <path
                    d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"
                ></path>
                <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                <line x1="12" y1="22.08" x2="12" y2="12"></line>
            </svg>
        </view>
    </view>
</template>

<script lang="ts" setup>
/**
 * 道具图标加载器 —— 走加密资源通道。
 *
 * 图标不是本地静态图，而是和宝可梦立绘同一条管线：服务器上
 * `encrypted-assets/items/<id>.bin`（ZKDX 密文，明文为 30×30 PNG），经
 * `itemImage` 引擎下载 / 解密 / 缓存（限流 / 引用计数 / LRU / 离屏取消 /
 * 跨刷新密文缓存与 sprite 完全一致），懒加载 / 引用配对复用
 * `useEncryptedImage`。服务器无该道具资源（404）时回落中性占位盒。
 */
import { computed } from 'vue';
import { useEncryptedImage } from '@/composables/useEncryptedImage';

const props = withDefaults(
    defineProps<{
        /** PokeAPI item id */
        id: number;
        size?: 'sm' | 'lg';
        /** 关掉懒加载、挂载即下载（详情页主图这类必然可见的场景） */
        eager?: boolean;
    }>(),
    { size: 'sm', eager: false },
);

const { blobUrl, loading, wrapperRef } = useEncryptedImage({
    kind: 'item',
    id: () => props.id,
    eager: () => props.eager,
    logTag: 'ItemIcon',
});

const sizeClass = computed(() =>
    props.size === 'lg' ? 'h-24 w-24 sm:h-28 sm:w-28' : 'h-10 w-10',
);
const iconClass = computed(() => (props.size === 'lg' ? 'h-12 w-12' : 'h-5 w-5'));
</script>

<style scoped>
.item-skeleton {
    background: linear-gradient(90deg, #f0f0f0 25%, #e4e6ec 50%, #f0f0f0 75%);
    background-size: 200% 100%;
    animation: item-shimmer 1.5s ease-in-out infinite;
}

@keyframes item-shimmer {
    0% {
        background-position: 200% 0;
    }
    100% {
        background-position: -200% 0;
    }
}
</style>
