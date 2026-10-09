<template>
    <scroll-view
        ref="scrollerRef"
        scroll-y
        class="virtual-list__scroller"
        :class="scrollerClass"
        :style="scrollerStyle"
        :scroll-top="scrollTopProp"
        @scroll="onScroll"
    >
        <!--
            单列定高虚拟化：spacer 撑出完整列表高度（滚动条与全量一致），
            内层绝对定位只渲染窗口内的行。行高由 prop 固定，调用方必须保证
            每行内容高度恒定（与 VirtualGrid 的定高前提相同）。
            根元素用 scroll-view（而非 view+overflow）以兼容小程序滚动容器。
        -->
        <view class="virtual-list__wrap" :style="wrapStyle">
            <view class="virtual-list__inner" :style="innerStyle">
                <!--
                    v-for 与 :key（数据 key）直接写在 <slot> 上，与 VirtualGrid 完全同构：
                    每个数据 key 对应一个稳定行组件，在 overscan 边界挂载一次、组件数据不变，
                    滚动时由 grid 布局移动其位置、到边界再卸载。行内图片 eager，挂载即加载，
                    overscan 保证进入视口前已取到（多为缓存命中）。
                    旧版在 slot 外再包一层 <view> 并把 v-for 放 view 上，导致两难：
                    数据 key 时框架移动 view、其内部按位置命名的插槽 d-0、d-1… 在 setData
                    过渡帧重名（More than one slot named "d-N"）；改用位置 key 则每个槽位
                    每次滚动都换数据，EncryptedSprite watch id 先清空成骨架再取图 → 闪烁。
                    inner 是单列 grid（见 innerStyle），grid item 默认 stretch 到固定行高，
                    不再需要行 view。
                -->
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
import { computed, getCurrentInstance, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { computeVirtualWindow } from '@/utils/virtualWindow';
import { raf, cancelRaf } from '@/utils/raf';

interface Props {
    /** 完整数据（过滤后的全量，不是分页切片） */
    items: readonly T[];
    /** 固定行高（px） */
    itemHeight: number;
    /** 取稳定 key，用于窗口行的 :key；缺省用下标。 */
    itemKey?: (item: T, index: number) => string | number;
    /** 容器高度（CSS，默认 100%） */
    height?: string;
    /** 视口外多渲染的行数 */
    overscan?: number;
    /** 滚动容器附加 class */
    scrollerClass?: string;
}

const props = withDefaults(defineProps<Props>(), {
    itemKey: undefined,
    height: '100%',
    overscan: 6,
    scrollerClass: '',
});

const scrollerRef = ref<unknown>(null);
const scrollTop = ref(0);

// 视口高度：首帧用系统窗口高度估算，挂载 / 数据变化后用实测覆盖
const sysWindow =
    typeof uni !== 'undefined' && uni.getSystemInfoSync
        ? uni.getSystemInfoSync().windowHeight
        : 0;
const viewportHeight = ref(sysWindow || 600);

const virtualWindow = computed(() =>
    computeVirtualWindow({
        scrollTop: scrollTop.value,
        viewportHeight: viewportHeight.value,
        total: props.items.length,
        columns: 1,
        cardHeight: props.itemHeight,
        rowGap: 0,
        overscan: props.overscan,
    }),
);

const keyOf = (item: T, index: number) => (props.itemKey ? props.itemKey(item, index) : index);

const windowEntries = computed(() => {
    const win = virtualWindow.value;
    const out: { item: T; index: number; key: string | number }[] = [];
    for (let i = win.firstIndex; i <= win.lastIndex; i += 1) {
        const item = props.items[i];
        if (item === undefined) continue;
        out.push({ item, index: i, key: keyOf(item, i) });
    }
    return out;
});

const scrollerStyle = computed(() => ({ height: props.height }));
const wrapStyle = computed(() => ({
    height: `${virtualWindow.value.spacerHeight}px`,
    position: 'relative' as const,
}));
const innerStyle = computed(() => ({
    position: 'absolute' as const,
    top: `${virtualWindow.value.offsetTop}px`,
    left: '0',
    right: '0',
    // 单列 grid：keyed slot 是直接 grid item，stretch 到 itemHeight 行高。
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr)',
    gridAutoRows: `${props.itemHeight}px`,
}));

/**
 * uni scroll-view 的滚动事件跨端一致：e.detail.scrollTop。
 * rAF 节流（与 VirtualGrid 一致）：一帧内多个 scroll 事件只取最后一次 scrollTop。
 * 不节流时，新行进边界处连续 scroll 事件携带的中间/回弹 scrollTop 会让窗口首行
 * 索引短暂来回跳，整屏行内容先变成另一条、下一帧纠正（错位回弹「变一下又变回」）。
 */
let rafId: number | null = null;
let pendingTop: number | null = null;
function onScroll(e: { detail?: { scrollTop?: number } }): void {
    const top = e.detail?.scrollTop;
    if (typeof top !== 'number') return;
    pendingTop = top;
    if (rafId != null) return;
    rafId = raf(() => {
        rafId = null;
        if (pendingTop != null) {
            scrollTop.value = pendingTop;
            pendingTop = null;
        }
    });
}

/**
 * 受控 scroll-top：小程序不能直接写 DOM scrollTop，靠 `:scroll-top` 驱动。
 * 该属性仅在值变化时才会滚动 —— 先放到非 0、nextTick 再归 0，保证连续回顶
 * （以及上次已停在 0）都生效；1px 抖动用户不可见。与 VirtualGrid 同一套做法。
 */
const scrollTopProp = ref(0);
function resetScrollPosition(): void {
    scrollTop.value = 0;
    scrollTopProp.value = scrollTopProp.value === 0 ? 1 : 0;
    void nextTick(() => {
        scrollTopProp.value = 0;
    });
}

/** H5 下 uni 组件包装需取 $el；小程序端无 DOM */
function toEl(raw: unknown): HTMLElement | null {
    if (!raw) return null;
    if (raw instanceof HTMLElement) return raw;
    const el = (raw as { $el?: unknown }).$el;
    return el instanceof HTMLElement ? el : null;
}

let resizeObserver: ResizeObserver | null = null;

// 组件实例须在 setup 同步期捕获：measureMp 经 nextTick 异步执行，
// 那时再调 getCurrentInstance() 会返回 null。
const currentInstance = getCurrentInstance();

/**
 * 小程序：无 DOM，用 SelectorQuery 实测 scroll-view 高度。选择器经 `.in(proxy)`
 * 限定本组件（generic 组件被多处复用时尤其需要）。与 VirtualGrid 同一做法。
 * 高度链由调用方保证（确定高度 flex-col → flex-1 min-h-0 → h-full），实测值恒为
 * 钳制后的视口高，只需 >0 守卫，不采信非正高度（卸载/塌陷帧）。
 */
function measureMp(): void {
    const query = uni.createSelectorQuery().in(currentInstance?.proxy ?? undefined);
    query.select('.virtual-list__scroller').fields({ size: true }, () => {});
    query.exec((res: unknown[]) => {
        const size = res?.[0] as { height?: number } | null;
        const h = size?.height;
        if (typeof h === 'number' && h > 0) viewportHeight.value = h;
    });
}

onMounted(async () => {
    const el = toEl(scrollerRef.value);
    if (!el) {
        // 小程序无 DOM：等布局把 scroll-view 高度钳定再实测，nextTick 后再校准一次
        // （首帧是系统窗口估算）。与 VirtualGrid 同一套。
        if (typeof uni !== 'undefined') {
            await nextTick();
            measureMp();
            await nextTick();
            measureMp();
        }
        return;
    }
    if (el.clientHeight > 0) viewportHeight.value = el.clientHeight;
    if (typeof ResizeObserver !== 'undefined') {
        resizeObserver = new ResizeObserver(() => {
            if (el.clientHeight > 0) viewportHeight.value = el.clientHeight;
        });
        resizeObserver.observe(el);
    }
});

// 数据集变化（搜索/筛选/切换赛季赛制）时回顶；小程序下 nextTick 重新实测
watch(
    () => props.items,
    async () => {
        resetScrollPosition();
        if (typeof uni !== 'undefined' && toEl(scrollerRef.value) === null) {
            await nextTick();
            measureMp();
        }
    },
);

onBeforeUnmount(() => {
    if (rafId != null) cancelRaf(rafId);
    rafId = null;
    pendingTop = null;
    resizeObserver?.disconnect();
    resizeObserver = null;
});

defineExpose({
    /** 供页面在需要时手动回顶 */
    scrollToTop() {
        resetScrollPosition();
    },
});
</script>

<style scoped>
.virtual-list__scroller {
    width: 100%;
    overflow-y: auto;
}

.virtual-list__wrap {
    width: 100%;
}
</style>
