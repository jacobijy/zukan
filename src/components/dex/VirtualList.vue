<template>
    <scroll-view
        ref="scrollerRef"
        scroll-y
        class="virtual-list__scroller"
        :class="scrollerClass"
        :style="scrollerStyle"
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
                <view
                    v-for="entry in windowEntries"
                    :key="entry.key"
                    class="virtual-list__row"
                    :style="{ height: `${itemHeight}px` }"
                >
                    <slot :item="entry.item" :index="entry.index" />
                </view>
            </view>
        </view>
    </scroll-view>
</template>

<script lang="ts" setup generic="T">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { computeVirtualWindow } from '@/utils/virtualWindow';

interface Props {
    /** 完整数据（过滤后的全量，不是分页切片） */
    items: readonly T[];
    /** 固定行高（px） */
    itemHeight: number;
    /** 取稳定 key；缺省用下标 */
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

// 视口高度：优先用系统窗口高度估算（H5/小程序均可），挂载后 H5 用实测覆盖
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
}));

/** uni scroll-view 的滚动事件跨端一致：e.detail.scrollTop */
function onScroll(e: { detail?: { scrollTop?: number } }): void {
    const top = e.detail?.scrollTop;
    if (typeof top === 'number') scrollTop.value = top;
}

/** H5 下 uni 组件包装需取 $el；小程序端无 DOM，退回系统窗口高度 */
function toEl(raw: unknown): HTMLElement | null {
    if (!raw) return null;
    if (raw instanceof HTMLElement) return raw;
    const el = (raw as { $el?: unknown }).$el;
    return el instanceof HTMLElement ? el : null;
}

let resizeObserver: ResizeObserver | null = null;

onMounted(() => {
    const el = toEl(scrollerRef.value);
    if (!el) return;
    if (el.clientHeight > 0) viewportHeight.value = el.clientHeight;
    if (typeof ResizeObserver !== 'undefined') {
        resizeObserver = new ResizeObserver(() => {
            if (el.clientHeight > 0) viewportHeight.value = el.clientHeight;
        });
        resizeObserver.observe(el);
    }
});

// 数据集变化（搜索/筛选）时回顶
watch(
    () => props.items,
    () => {
        scrollTop.value = 0;
    },
);

onBeforeUnmount(() => {
    resizeObserver?.disconnect();
    resizeObserver = null;
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

.virtual-list__row {
    width: 100%;
    box-sizing: border-box;
}
</style>
