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
 * ## 懒加载 + 离屏取消
 * 默认只在元素进入视口附近才开始下载解密。首屏可见约 6 张卡，而一屏窗口有 20 张 ——
 * 实测首屏 sprite 合计约 2.5 MB，急加载会把不可见的那部分也一起解了。
 *
 * observer **不是一次性的**：滑出视口且尚未加载完时 abort，让出并发槽位给当前视口
 * （槽位调度见 spriteCache 的「批内 FIFO + 批间 LIFO」）。之前一进 200px 就
 * disconnect 并且不再撤回，快速滑动会把途经的几十行全部排进队列，当前视口反而最后
 * 才下完。重新进视口时再起一轮；成功拿到 url 后才真正停止观察。
 *
 * 不支持 IntersectionObserver 的环境（含小程序）自动退化为立即加载；
 * 没有 AbortController 时退化为不可取消（行为等同改造前）。
 */
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { acquireSprite, releaseSprite, isSpriteAbortError } from '@/services/resources/spriteCache'

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
/** 在途请求的取消句柄；null 表示当前没有在跑 */
let controller: AbortController | null = null

function releaseHeld(): void {
  if (!held) return
  releaseSprite(held.pokemonId, held.variant)
  held = null
}

/** 中止在途下载（滑出视口 / 卸载 / props 变化） */
function abortInflight(): void {
  controller?.abort()
  controller = null
}

async function load(pokemonId: number, variant: string): Promise<void> {
  loading.value = true

  const ac = typeof AbortController === 'function' ? new AbortController() : null
  controller = ac

  try {
    const url = await acquireSprite(pokemonId, variant, { signal: ac?.signal })

    // 等待期间组件被卸载 / props 又变了 —— 立刻归还，避免引用泄漏
    if (disposed || pokemonId !== props.pokemonId || variant !== props.variant) {
      releaseSprite(pokemonId, variant)
      return
    }

    releaseHeld()
    held = { pokemonId, variant }
    blobUrl.value = url
    // 拿到图了，不必再观察
    observer?.disconnect()
    observer = null
  } catch (err) {
    if (disposed) return
    // 主动取消是正常路径（滑出视口）：保持骨架屏，等下次进视口重来
    if (isSpriteAbortError(err)) return
    console.error('[EncryptedSprite] 解密失败:', pokemonId, variant, err)
    blobUrl.value = '/static/default.png'
  } finally {
    if (controller === ac) controller = null
    // 取消后仍要留在 loading 态（骨架屏），只有成功 / 真失败才收起
    if (!disposed && blobUrl.value) loading.value = false
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
      const visible = entries.some((e) => e.isIntersecting)
      if (visible) {
        // 已有图或已在跑就别重复起跑
        if (blobUrl.value || controller) return
        void load(props.pokemonId, props.variant)
      } else {
        // 划走了且还没下完 —— 让出槽位给当前视口
        abortInflight()
      }
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
    abortInflight()
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
  // 在途下载没意义了，中止以腾出槽位给还在屏上的卡片
  abortInflight()
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
