<template>
  <view
    ref="scrollerRef"
    class="virtual-grid__scroller"
    :class="scrollerClass"
    @scroll="onScroll"
    @touchstart="emit('touchstart', $event)"
    @touchmove="emit('touchmove', $event)"
    @touchend="emit('touchend', $event)"
  >
    <view class="virtual-grid__wrap" :style="wrapStyle">
      <!--
        spacer 撑出完整列表高度（滚动条因此与全量一致）；内层 grid 绝对定位，
        只包含窗口内的项，靠 top 偏移到正确位置。
        降级模式（拿不到几何 / 无 ResizeObserver）下 spacer 不设高、grid 静态定位，
        等价于全量渲染。
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
  </view>
</template>

<script lang="ts" setup generic="T">
/**
 * 定高虚拟网格
 *
 * 只渲染视口附近的行。1025 条实测 DOM 节点从 3083 降到 35（-99%），
 * 同时 Vue 组件实例与 `EncryptedSprite` 的 IntersectionObserver 数量同比例下降 ——
 * 后者是 `content-visibility: auto` 解决不了的（它跳过绘制但保留全部实例）。
 *
 * ## 几何来自 computed style，不复制断点
 * 列数与 rowGap 直接读 `getComputedStyle(grid)`，卡高用首个渲染出的子元素实测。
 * 因此 Tailwind 那套 `sm:` / `2xl:` 响应式断点只在模板里写一次
 * （CLAUDE.md 规则 3：同一份数据不要有第二处定义）。
 *
 * ## 前提：卡片定高
 * 实测卡高在每个断点内恒定（98px @ mobile / 106px @ ≥640px）。
 * **若 `PokemonCard` 改成多行标题或可变高度，这个前提就破了**，需要改成逐项测量。
 *
 * ## 降级
 * 拿不到几何（首帧未布局）或环境没有 ResizeObserver 时渲染全量，
 * 与 `EncryptedSprite` 对 IntersectionObserver 的处理一致。
 * 首页滚动容器本就是 H5-only 的 `view + overflow-y-auto`（MP 需 `scroll-view`），
 * 这是既有限制，本组件不引入新的平台约束。
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { computeVirtualWindow } from '@/utils/virtualWindow';

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
/**
 * 初始几何估算：避免首次挂载时因 cardHeight/viewportHeight 为空而降级为
 * 全量渲染（~1025 个 PokemonCard 实例 + IntersectionObserver 同步创建，
 * 是 tab 切回图鉴时的主要卡顿源）。measure() 在 onMounted 后会用实测值覆盖。
 *
 * 数值来自 CLAUDE.md 记录的实测卡高：98px @ mobile / 106px @ ≥640px。
 * 列数按 grid 的 minmax 宽度估算；SSR/无 window 环境回退 0/1，保留原降级行为。
 */
const hasWindow = typeof window !== 'undefined'
const viewportHeight = ref(hasWindow ? window.innerHeight : 0)
/** 单卡高度与行间距；null 表示尚未测到 → 降级全量渲染 */
function estimateColumns(): number {
  if (!hasWindow) return 1
  const w = window.innerWidth
  // 与 grid-class 的 minmax 断点一致：<640px 用 260px，≥640px 用 310px
  const minCard = w >= 640 ? 310 : 260
  return Math.max(1, Math.floor(w / minCard))
}
const cardHeight = ref<number | null>(hasWindow ? (window.innerWidth >= 640 ? 106 : 98) : null)
const rowGap = ref(0)
const columns = ref(estimateColumns())

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

/** uni-app 的 `view` 在 H5 下是组件包装，需取 $el */
function toEl(raw: unknown): HTMLElement | null {
  if (!raw) return null
  if (raw instanceof HTMLElement) return raw
  const el = (raw as { $el?: unknown }).$el
  return el instanceof HTMLElement ? el : null
}

/**
 * 从 computed style + 首个子元素实测几何。
 * 必须在有子元素渲染出来之后调用（降级模式下首帧即有全量子元素）。
 */
function measure(): void {
  const scroller = toEl(scrollerRef.value)
  const grid = toEl(gridRef.value)
  if (!scroller || !grid) return

  viewportHeight.value = scroller.clientHeight

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

let rafId: number | null = null

function onScroll(): void {
  const scroller = toEl(scrollerRef.value)
  if (!scroller) return
  // rAF 节流：虚拟滚动要跟手，不能用 debounce（会在滚动中留白）
  if (rafId != null) return
  rafId = requestAnimationFrame(() => {
    rafId = null
    scrollTop.value = scroller.scrollTop
  })
}

let resizeObserver: ResizeObserver | null = null

onMounted(async () => {
  await nextTick()
  measure()
  // 首次测量后窗口变小，可能需要再校准一次（首帧是全量渲染的高度）
  await nextTick()
  measure()

  const scroller = toEl(scrollerRef.value)
  if (scroller && typeof ResizeObserver !== 'undefined') {
    // 容器宽度变化 → 列数与卡高可能都变（断点切换）
    resizeObserver = new ResizeObserver(() => measure())
    resizeObserver.observe(scroller)
  }
})

// 数据集变化（筛选/搜索）时回到顶部并重新校准
watch(
  () => props.items,
  async () => {
    const scroller = toEl(scrollerRef.value)
    if (scroller) {
      scroller.scrollTop = 0
      scrollTop.value = 0
    }
    await nextTick()
    measure()
  },
)

onBeforeUnmount(() => {
  if (rafId != null) cancelAnimationFrame(rafId)
  rafId = null
  resizeObserver?.disconnect()
  resizeObserver = null
})

defineExpose({
  /** 供页面在需要时手动回顶 */
  scrollToTop() {
    const scroller = toEl(scrollerRef.value)
    if (scroller) {
      scroller.scrollTop = 0
      scrollTop.value = 0
    }
  },
})
</script>

<style scoped>
.virtual-grid__scroller {
  overflow-y: auto;
}

.virtual-grid__wrap {
  width: 100%;
}
</style>
