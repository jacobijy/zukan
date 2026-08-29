<template>
    <view
        ref="wrapperRef"
        class="item-tile"
        :class="[tileClass, { 'item-tile--loading': loading && !blobUrl }]"
    >
        <image v-if="blobUrl" :src="blobUrl" class="item-tile__img" :class="imgClass" mode="aspectFit" />
        <!-- 无资源 / 加载失败：中性包裹 glyph（与成品同槽，不跳变） -->
        <svg
            v-else-if="!loading"
            class="item-tile__glyph"
            :class="glyphClass"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
        >
            <path
                d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"
            ></path>
            <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
            <line x1="12" y1="22.08" x2="12" y2="12"></line>
        </svg>
        <!-- 加载中：空槽，槽面自身走 shimmer（见 .item-tile--loading） -->
    </view>
</template>

<script lang="ts" setup>
/**
 * 道具图标加载器 —— 走加密资源通道。
 *
 * 图标不是本地静态图，而是和宝可梦立绘同一条管线：服务器上
 * `encrypted-assets/items/<id>.bin`（ZKDX 密文，明文为 30×30 透明 PNG），经
 * `itemImage` 引擎下载 / 解密 / 缓存（限流 / 引用计数 / LRU / 离屏取消 /
 * 跨刷新密文缓存与 sprite 一致），懒加载 / 引用配对复用 `useEncryptedImage`。
 *
 * 三态同构：根节点始终是同一个圆角「托盘」tile（边框 / 阴影 / 尺寸不变），
 * 加载态在槽面走 shimmer、成品把彩色原画内缩放进槽、404 用中性 glyph ——
 * 不会出现加载完色块突然消失的跳变，也给透明底的小原画一个承托，避免在白行上发飘。
 * 服务器无该道具资源（404）时回落中性 glyph。
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

// 槽 / 原画 / glyph 的尺寸随断点一起换；原画比槽小一圈，落在凹槽内不贴边
const tileClass = computed(() =>
    props.size === 'lg' ? 'h-28 w-28 rounded-[26px]' : 'h-10 w-10 rounded-[13px]',
);
const imgClass = computed(() => (props.size === 'lg' ? 'h-20 w-20' : 'h-7 w-7'));
const glyphClass = computed(() => (props.size === 'lg' ? 'h-12 w-12' : 'h-5 w-5'));
</script>

<style scoped>
.item-tile {
    position: relative;
    display: flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    border: 1px solid rgba(36, 38, 43, 0.06);
    background: linear-gradient(180deg, #ffffff 0%, #f2f4f8 100%);
    box-shadow:
        inset 0 1px 0 rgba(255, 255, 255, 0.9),
        0 1px 2px rgba(63, 70, 86, 0.05);
}

/* 加载态：槽面走 shimmer；边框 / 阴影 / 尺寸与成品一致，只换填充，不跳变 */
.item-tile--loading {
    background: linear-gradient(90deg, #eef1f6 25%, #e1e5ee 50%, #eef1f6 75%);
    background-size: 200% 100%;
    animation: item-tile-shimmer 1.4s ease-in-out infinite;
}

.item-tile__glyph {
    color: #b6bac4;
}

@keyframes item-tile-shimmer {
    0% {
        background-position: 200% 0;
    }
    100% {
        background-position: -200% 0;
    }
}
</style>
