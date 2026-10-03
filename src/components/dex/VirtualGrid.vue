<template>
  <scroll-view
    ref="scrollerRef"
    scroll-y
    class="virtual-grid__scroller"
    :class="scrollerClass"
    :scroll-top="scrollTopProp"
    @scroll="onScroll"
    @touchstart="emit('touchstart', $event)"
    @touchmove="emit('touchmove', $event)"
    @touchend="emit('touchend', $event)"
  >
    <view class="virtual-grid__wrap" :style="wrapStyle">
      <!--
        spacer 撑出完整列表高度（滚动条因此与全量一致）；内层 grid 绝对定位，
        只包含窗口内的项，靠 top 偏移到正确位置。
        降级模式（拿不到几何）下 spacer 不设高、grid 静态定位，等价于全量渲染。
      -->
      <view
        ref="gridRef"
        class="virtual-grid__grid"
        :class="gridClass"
        :style="gridStyle"
      >
        <slot
          v-for="entry in windowEntries"
          :key="entry.key"
          :item="entry.item"
          :index="entry.index"
        />
      </view>
    </view>
  </scroll-view>
</template>

<script lang="ts" setup generic="T">
/**
 * 定高虚拟网格（跨端）
 *
 * 只渲染视口附近的行。1025 条实测 DOM 节点从 3083 降到 35（-99%），
 * 同时 Vue 组件实例与 `EncryptedSprite` 的 IntersectionObserver 数量同比例下降 ——
 * 后者是 `content-visibility: auto` 解决不了的（它跳过绘制但保留全部实例）。
 *
 * ## 根元素是 scroll-view（不是 view + overflow）
 * 普通 `<view>` 在小程序里没有 scroll 事件（`bindscroll` 为 scroll-view 专属），
 * 用它做滚动容器会让 scrollTop 恒为 0、窗口不更新。因此根元素统一用
 * `<scroll-view scroll-y>`，H5 与小程序同一套模板（与 `VirtualList.vue` 一致）。
 * 调用方必须让本组件有确定高度（flex-1 min-h-0 父容器 + h-full，参见 index.vue）。
 *
 * ## 几何来自 computed style，不复制断点
 * 列数与 rowGap 直接读解析后的 grid-template-columns，卡高用首个渲染子元素实测。
 * 因此 Tailwind 那套 `sm:` / `2xl:` 响应式断点只在模板里写一次
 * （CLAUDE.md 规则 3：同一份数据不要有第二处定义）。
 * H5 用 DOM 实测；小程序无 DOM，用 `uni.createSelectorQuery` 实测，首帧先用
 * 系统窗口信息估算（否则小程序首帧拿不到几何会降级全量渲染）。
 *
 * ## 前提：卡片定高
 * 实测卡高在每个断点内恒定（98px @ mobile / 106px @ ≥640px）。
 * **若 `PokemonCard` 改成多行标题或可变高度，这个前提就破了**，需要改成逐项测量。
 *
 * ## 降级
 * 连系统窗口信息都拿不到（node 测试环境等）时渲染全量。
 */
import { computed, getCurrentInstance, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { computeVirtualWindow } from '@/utils/virtualWindow';
import { raf, cancelRaf } from '@/utils/raf';

interface Props {
  /** 完整数据（不是分页后的切片） */
  items: readonly T[];
  /** 取稳定 key；缺省用下标（列表回收时下标不稳定，建议总是传） */
  itemKey?: (item: T, index: number) => string | number;
  /** 滚动容器附加 class */
  scrollerClass?: string;
  /** grid 容器附加 class（列数/gap 的响应式定义写在这里） */
  gridClass?: string;
  /** 视口外多渲染的行数 */
  overscan?: number;
}

const props = withDefaults(defineProps<Props>(), {
  itemKey: undefined,
  scrollerClass: '',
  gridClass: '',
  overscan: 2,
})

const emit = defineEmits<{
  touchstart: [e: TouchEvent]
  touchmove: [e: TouchEvent]
  touchend: [e: TouchEvent]
}>()

const scrollerRef = ref<unknown>(null)
const gridRef = ref<unknown>(null)

const scrollTop = ref(0)

const hasWindow = typeof window !== 'undefined'
const hasUni = typeof uni !== 'undefined'

/**
 * 系统窗口信息（只取一次）。
 * 小程序 windowHeight 是可用窗口高度（不含系统导航/tabbar），与本 scroll-view
 * 实际高度可能略有出入 —— 只用作首帧估算，measure 后用实测值覆盖。
 */
function readSys(): { width: number; height: number } {
  if (hasUni) {
    try {
      const info = uni.getSystemInfoSync()
      return { width: info.windowWidth || 0, height: info.windowHeight || 0 }
    } catch {
      /* 落到 window / 0 */
    }
  }
  if (hasWindow) return { width: window.innerWidth, height: window.innerHeight }
  return { width: 0, height: 0 }
}
const sys = readSys()

/**
 * 初始几何估算：避免首次挂载时因 cardHeight/viewportHeight 为空而降级为
 * 全量渲染（小程序 ~1025 个 PokemonCard 实例 + observer 同步创建，是进入图鉴
 * 时的主要卡顿源）。measure() 在 onMounted 后会用实测值覆盖。
 *
 * cardHeight 取实测值 98px @ mobile / 106px @ ≥640px；列数按 grid 的 minmax
 * 宽度估算（与 grid-class 的断点一致）。viewportHeight 用系统窗口高度。
 * SSR/无任何窗口信息的 node 环境回退 null/0，保留降级行为。
 */
const viewportHeight = ref(sys.height)
function estimateColumns(w: number): number {
  if (!w) return 1
  // 与 grid-class 的 minmax 断点一致：<640px 用 260px，≥640px 用 310px
  const minCard = w >= 640 ? 310 : 260
  return Math.max(1, Math.floor(w / minCard))
}
/** 单卡高度与行间距；null 表示尚未得到 → 降级全量渲染 */
const cardHeight = ref<number | null>(sys.width > 0 ? (sys.width >= 640 ? 106 : 98) : null)
const rowGap = ref(0)
const columns = ref(estimateColumns(sys.width))

/** 几何就绪才启用虚拟化 */
const active = computed(() => cardHeight.value != null && cardHeight.value > 0 && viewportHeight.value > 0)

const virtualWindow = computed(() => {
  if (!active.value) return null
  return computeVirtualWindow({
    scrollTop: scrollTop.value,
    viewportHeight: viewportHeight.value,
    total: props.items.length,
    columns: columns.value,
    cardHeight: cardHeight.value!,
    rowGap: rowGap.value,
    overscan: props.overscan,
  })
})

const keyOf = (item: T, index: number) => (props.itemKey ? props.itemKey(item, index) : index)

/** 窗口内的项 + 其在完整列表中的真实下标 */
const windowEntries = computed(() => {
  const win = virtualWindow.value
  const source = props.items

  if (!win) {
    // 降级：全量
    return source.map((item, index) => ({ item, index, key: keyOf(item, index) }))
  }

  const out: { item: T; index: number; key: string | number }[] = []
  for (let i = win.firstIndex; i <= win.lastIndex; i += 1) {
    const item = source[i]
    if (item === undefined) continue
    out.push({ item, index: i, key: keyOf(item, i) })
  }
  return out
})

const wrapStyle = computed(() => {
  const win = virtualWindow.value
  if (!win) return {}
  return { height: `${win.spacerHeight}px`, position: 'relative' as const }
})

const gridStyle = computed(() => {
  const win = virtualWindow.value
  if (!win) return {}
  return {
    position: 'absolute' as const,
    top: `${win.offsetTop}px`,
    left: '0',
    right: '0',
  }
})

/** uni-app 的组件在 H5 下是包装，需取 $el */
function toEl(raw: unknown): HTMLElement | null {
  if (!raw) return null
  if (raw instanceof HTMLElement) return raw
  const el = (raw as { $el?: unknown }).$el
  return el instanceof HTMLElement ? el : null
}

/**
 * H5：从 computed style + 首个子元素实测几何。
 * 必须在有子元素渲染出来之后调用（降级模式下首帧即有全量子元素）。
 */
function measureDom(): void {
  const scroller = toEl(scrollerRef.value)
  const grid = toEl(gridRef.value)
  if (!scroller || !grid) return

  // 切 tab 销毁/塌陷时 ResizeObserver 会以 0×0 触发最后一次；若把 viewportHeight
  // 写成 0，active 会翻假 → windowEntries 退回全量渲染，上千张 eager 卡瞬时挂载、
  // 各拉一个 front.bin（只在 H5 复现：小程序走 measureMp，本就有 >0 守卫）。
  // 非正高度一律保留上次有效值，不让离屏/卸载的测量污染几何。
  const viewportH = scroller.clientHeight
  if (viewportH > 0) viewportHeight.value = viewportH

  const cs = getComputedStyle(grid)
  // `repeat(auto-fill, …)` 被解析成具体轨道列表，数量即列数
  const tracks = cs.gridTemplateColumns.trim().split(/\s+/).filter(Boolean)
  if (tracks.length > 0) columns.value = tracks.length

  const gap = Number.parseFloat(cs.rowGap)
  if (Number.isFinite(gap)) rowGap.value = gap

  const firstChild = grid.firstElementChild
  if (firstChild) {
    const h = Math.round(firstChild.getBoundingClientRect().height)
    // 高度为 0 说明还没布局完（或子元素本身不可见），保持上次值
    if (h > 0) cardHeight.value = h
  }
}

// 组件实例须在 setup 同步期捕获：measureMp 经 nextTick 异步执行，
// 那时再调 getCurrentInstance() 会返回 null
const currentInstance = getCurrentInstance()

/**
 * 小程序：无 DOM，用 SelectorQuery 实测 scroll-view / grid / 首个子元素。
 * 选择器作用域经 `.in(proxy)` 限定在本组件（generic 组件被多处复用时尤其需要）。
 */
function measureMp(): void {
  const query = uni.createSelectorQuery().in(currentInstance?.proxy ?? undefined)
  // fields 的第二参 callback 在 uni 类型里必填（微信原生可省略），传 noop
  query.select('.virtual-grid__scroller').fields({ size: true }, () => {})
  query.select('.virtual-grid__grid').fields(
    { computedStyle: ['gridTemplateColumns', 'rowGap'] },
    () => {},
  )
  query.select('.virtual-grid__grid > :first-child').boundingClientRect()
  query.exec((res: unknown[]) => {
    const [scrollerSize, gridStyle, firstRect] = res as [
      { height?: number } | null,
      { gridTemplateColumns?: string; rowGap?: string } | null,
      { height?: number } | null,
    ]

    if (scrollerSize && scrollerSize.height && scrollerSize.height > 0) {
      viewportHeight.value = scrollerSize.height
    }
    const tracks = String(gridStyle?.gridTemplateColumns ?? '')
      .trim()
      .split(/\s+/)
      .filter(Boolean)
    if (tracks.length > 0) columns.value = tracks.length
    const gap = Number.parseFloat(String(gridStyle?.rowGap ?? ''))
    if (Number.isFinite(gap)) rowGap.value = gap
    if (firstRect && firstRect.height && firstRect.height > 0) {
      cardHeight.value = Math.round(firstRect.height)
    }
  })
}

function measure(): void {
  if (hasWindow) measureDom()
  else if (hasUni) measureMp()
}

let rafId: number | null = null
let pendingTop: number | null = null

/** scroll-view 的滚动事件跨端一致：e.detail.scrollTop */
function onScroll(e: { detail?: { scrollTop?: number } }): void {
  const top = e.detail?.scrollTop
  if (typeof top !== 'number') return
  pendingTop = top
  // rAF 节流：虚拟滚动要跟手，不能用 debounce（会在滚动中留白）
  if (rafId != null) return
  rafId = raf(() => {
    rafId = null
    if (pendingTop != null) {
      scrollTop.value = pendingTop
      pendingTop = null
    }
  })
}

/**
 * 受控 scroll-top：小程序不能直接写 DOM scrollTop，靠 `:scroll-top` 驱动。
 * 该属性仅在值变化时才会滚动 —— 先放到非 0、nextTick 再归 0，保证连续回顶
 * （以及上次已停在 0）都生效；1px 抖动用户不可见。
 */
const scrollTopProp = ref(0)
function resetScrollPosition(): void {
  scrollTop.value = 0
  scrollTopProp.value = scrollTopProp.value === 0 ? 1 : 0
  void nextTick(() => {
    scrollTopProp.value = 0
  })
}

let resizeObserver: ResizeObserver | null = null

onMounted(async () => {
  await nextTick()
  measure()
  // 首次测量后窗口变小，可能需要再校准一次（首帧是估算 / 全量渲染的高度）
  await nextTick()
  measure()

  if (hasWindow) {
    const scroller = toEl(scrollerRef.value)
    if (scroller && typeof ResizeObserver !== 'undefined') {
      // 容器宽度变化 → 列数与卡高可能都变（断点切换）
      resizeObserver = new ResizeObserver(() => measure())
      resizeObserver.observe(scroller)
    }
  }
})

// 数据集变化（筛选/搜索）时回到顶部并重新校准
watch(
  () => props.items,
  async () => {
    resetScrollPosition()
    await nextTick()
    measure()
  },
)

onBeforeUnmount(() => {
  if (rafId != null) cancelRaf(rafId)
  rafId = null
  pendingTop = null
  resizeObserver?.disconnect()
  resizeObserver = null
})

defineExpose({
  /** 供页面在需要时手动回顶 */
  scrollToTop() {
    resetScrollPosition()
  },
})
</script>

<style scoped>
.virtual-grid__scroller {
  width: 100%;
}

.virtual-grid__wrap {
  width: 100%;
}
</style>
