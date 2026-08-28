<template>
  <view ref="wrapperRef" class="sprite-wrapper">
    <image
      v-if="blobUrl"
      :src="blobUrl"
      mode="aspectFit"
      :class="imgClass"
    />
    <!-- 真失败（含 404 无立绘）：回落默认图，不裂图 -->
    <image
      v-else-if="failed"
      src="/static/default.png"
      mode="aspectFit"
      :class="imgClass"
    />
    <view v-else-if="loading" :class="['skeleton', skeletonClass]"></view>
  </view>
</template>

<script setup lang="ts">
/**
 * 加密 sprite（宝可梦立绘）加载器。
 *
 * 缓存 / 解密 / Blob URL 生命周期与视口调度全部在共享层：
 * - 引擎（限流 / 引用计数 / LRU / 三层缓存）：`services/resources/spriteCache.ts`
 *   （泛化实现见 `imageCache.ts`）
 * - 懒加载 / 离屏取消 / 引用配对：`composables/useEncryptedImage.ts`
 *
 * 本组件只负责把状态渲染成图片 / 骨架 / 默认图。道具图标用同一 composable 的
 * item 种类，见 `archive/ItemIcon.vue`。
 */
import { useEncryptedImage } from '@/composables/useEncryptedImage';

interface Props {
  pokemonId: number
  variant?: string   // home / shiny / artwork / back / dream 等；对应 assets/public/pokemon/{id}/{variant}.{png,svg}
  imgClass?: string
  skeletonClass?: string
  /** 关掉懒加载，挂载即开始下载（详情页主图这类必然可见的场景用） */
  eager?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'home',
  imgClass: '',
  skeletonClass: '',
  eager: false,
})

const { blobUrl, loading, failed, wrapperRef } = useEncryptedImage({
  kind: 'pokemon',
  id: () => props.pokemonId,
  variant: () => props.variant,
  eager: () => props.eager,
  logTag: 'EncryptedSprite',
})
</script>

<style scoped>
.sprite-wrapper {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.skeleton {
  background: linear-gradient(
    90deg,
    #f0f0f0 25%,
    #e0e0e0 50%,
    #f0f0f0 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s ease-in-out infinite;
  border-radius: 8px;
}

@keyframes shimmer {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}
</style>
