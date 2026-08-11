<template>
  <view ref="wrapperRef" class="sprite-wrapper">
    <image
      v-if="blobUrl"
      :src="blobUrl"
      mode="aspectFit"
      :class="imgClass"
    />
    <view v-else-if="loading" :class="['skeleton', skeletonClass]"></view>
  </view>
</template>

<script setup lang="ts">
/**
 * 加密 sprite 加载器
 *
 * 缓存 / 解密 / Blob URL 生命周期全部委托给 `services/resources/spriteCache`
 * （模块级共享 + 引用计数）。此前这套逻辑写在本文件的 `<script setup>` 顶层，
 * 编译后落在 `setup()` 内部 ⇒ 每实例一份空缓存、命中率为 0、Blob URL 永不撤销。
 *
 * ## 懒加载
 * 默认只在元素进入视口附近才开始下载解密。首屏可见约 6 张卡，而一页有 20 张 ——
 * 实测首屏 sprite 合计约 2.5 MB，急加载会把不可见的那部分也一起解了。
 * 不支持 IntersectionObserver 的环境（含小程序）自动退化为立即加载。
 */
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { acquireSprite, releaseSprite } from '@/services/resources/spriteCache'

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

const blobUrl = ref<string | null>(null)
const loading = ref(true)
const wrapperRef = ref<unknown>(null)

/** 当前已登记引用的目标，用于配对 release（props 变化时要释放旧的那一只） */
let held: { pokemonId: number; variant: string } | null = null
let observer: IntersectionObserver | null = null
/** 组件已卸载：异步回来后不要再写 ref，也要立刻归还引用 */
let disposed = false

function releaseHeld(): void {
  if (!held) return
  releaseSprite(held.pokemonId, held.variant)
  held = null
}

async function load(pokemonId: number, variant: string): Promise<void> {
  loading.value = true
  try {
    const url = await acquireSprite(pokemonId, variant)

    // 等待期间组件被卸载 / props 又变了 —— 立刻归还，避免引用泄漏
    if (disposed || pokemonId !== props.pokemonId || variant !== props.variant) {
      releaseSprite(pokemonId, variant)
      return
    }

    releaseHeld()
    held = { pokemonId, variant }
    blobUrl.value = url
  } catch (err) {
    if (disposed) return
    console.error('[EncryptedSprite] 解密失败:', pokemonId, variant, err)
    blobUrl.value = '/static/default.png'
  } finally {
    if (!disposed) loading.value = false
  }
}

/** 拿到真实 DOM 元素；uni-app 的 `view` 在 H5 下是组件包装，需取 `$el` */
function resolveEl(): HTMLElement | null {
  const raw = wrapperRef.value
  if (!raw) return null
  if (raw instanceof HTMLElement) return raw
  const el = (raw as { $el?: unknown }).$el
  return el instanceof HTMLElement ? el : null
}

function startObserving(): void {
  const el = resolveEl()

  // 小程序 / 老浏览器没有 IntersectionObserver：退化为立即加载
  if (!el || typeof IntersectionObserver === 'undefined') {
    void load(props.pokemonId, props.variant)
    return
  }

  observer = new IntersectionObserver(
    (entries) => {
      if (!entries.some((e) => e.isIntersecting)) return
      // 一次性：开始加载后就不再需要观察
      observer?.disconnect()
      observer = null
      void load(props.pokemonId, props.variant)
    },
    // 提前 200px 起跑，滚动时不至于看到骨架屏
    { rootMargin: '200px' },
  )
  observer.observe(el)
}

onMounted(() => {
  if (props.eager) {
    void load(props.pokemonId, props.variant)
    return
  }
  startObserving()
})

// 列表复用同一组件实例时（key 变化以外的场景）跟着 props 重新加载
watch(
  () => [props.pokemonId, props.variant] as const,
  ([id, variant], [prevId, prevVariant]) => {
    if (id === prevId && variant === prevVariant) return
    blobUrl.value = null
    // 已在观察中的话让新的一轮接管
    observer?.disconnect()
    observer = null
    if (props.eager || typeof IntersectionObserver === 'undefined') {
      void load(id, variant)
    } else {
      startObserving()
    }
  },
)

onUnmounted(() => {
  disposed = true
  observer?.disconnect()
  observer = null
  // 归还引用 —— 缓存条目保留（下次秒开），refs 归零后才允许被 LRU 撤销
  releaseHeld()
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
