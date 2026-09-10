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
 * - 「低清先行 + 404 回落链」的编排：`services/resources/spriteLoader.ts`
 *
 * 默认行为是**渐进式两段加载**：先拉 96×96 的 `front`（约 2 KB）点亮，再换
 * 512×512 的 `home`（约 122 KB）。主 variant 404 时按 `fallbacks` 顺序回落，
 * 全链都没有才落 `/static/default.png`。体积对照与缺口清单见
 * `@/constants/spriteVariants`。
 *
 * 本组件只负责把状态渲染成图片 / 骨架 / 默认图。道具图标用同一 composable 的
 * item 种类，见 `archive/ItemIcon.vue`。
 */
import { computed } from 'vue'
import { useEncryptedImage } from '@/composables/useEncryptedImage'
import { SPRITE_PREVIEW, SPRITE_FALLBACKS, buildSpriteChain } from '@/constants/spriteVariants'

interface Props {
  pokemonId: number
  variant?: string   // home / shiny / artwork / back / dream 等；对应 assets/public/pokemon/{id}/{variant}.{png,svg}
  imgClass?: string
  skeletonClass?: string
  /** 关掉懒加载，挂载即开始下载（详情页主图这类必然可见的场景用） */
  eager?: boolean
  /**
   * 渐进式低清先行。true = 默认 `front`；string = 自定义先行 variant
   * （如闪光目标传 `'shiny'`，避免先闪一下非闪配色）；false 关掉。
   */
  preview?: boolean | string
  /** 主 variant 404 时的回落顺序；传 [] 关掉回落 */
  fallbacks?: readonly string[]
  /**
   * 数据层的 `hasSprite`（PKMB 字段）。明确为 false 时直接显示默认图，
   * 不发那次必然 404 的请求。字段缺席（undefined）按"可能有"处理。
   */
  hasSprite?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'home',
  imgClass: '',
  skeletonClass: '',
  eager: false,
  preview: true,
  fallbacks: () => SPRITE_FALLBACKS,
  // 必须显式 undefined：Boolean prop 缺省时 Vue 会隐式给 false（不是 undefined），
  // 那会被下面 `hasSprite === false` 误判成「数据层确认无图」而跳过下载。
  // EvolutionNode 不传本字段，语义是「未知，照常请求、靠 404 回落」。
  hasSprite: undefined,
})

const chain = computed(() => buildSpriteChain(props.variant, props.fallbacks))

const { blobUrl, loading, failed, wrapperRef } = useEncryptedImage({
  kind: 'pokemon',
  id: () => props.pokemonId,
  variant: () => props.variant,
  eager: () => props.eager,
  preview: () => (typeof props.preview === 'string' ? props.preview : props.preview ? SPRITE_PREVIEW : null),
  chain: () => chain.value,
  skip: () => props.hasSprite === false,
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
