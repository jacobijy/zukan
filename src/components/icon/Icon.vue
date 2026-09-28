<template>
    <!-- #ifdef MP-WEIXIN -->
    <text
        class="ic"
        :class="[sizeClass, colorClass]"
        :style="sizeStyle"
    >{{ char }}</text>
    <!-- #endif -->
    <!-- #ifndef MP-WEIXIN -->
    <slot />
    <!-- #endif -->
</template>

<script setup lang="ts">
/**
 * 跨平台图标。
 *
 * 微信小程序的 WXML 不支持 `<svg>`（会被当成未注册组件静默不渲染），mp 端改用
 * `zukan-icons.ttf` 字体字形；H5 / App 走具名 slot 里的内联 svg，视觉与改造前一致。
 *
 * 字形来源：`scripts/build-icons.mjs` 扫描源码中带 `data-ic="<name>"` 的内联 svg
 * 自动生成 ttf 与 `glyphs.ts`。所以 **mp 的字形是静态几何的快照**，两条限制：
 *
 * - 带 `:fill` / `:stroke` 这类运行时切换属性的 svg 无法直接进字体 ——
 *   每个状态各造一个静态字形（如 `star` / `star-fill`），组件用 `filled` 解析；
 * - 数据驱动路径（`v-for` / `:d`）同样无法转字形，须在
 *   `src/components/icon/extra/` 补静态 svg（`build-icons` 一并收录）。
 *
 * 颜色天然继承 `color`（字体的 stroke=currentColor 由 CSS 决定），
 * 所以父级的 `text-[#xxx]` / `text-white` 直接生效，组件只需处理尺寸。
 *
 * @example
 * <Icon name="chevron-right" :size="16" class="text-[#c4c7cf]">
 *     <svg data-ic="chevron-right" viewBox="0 0 24 24" …>…</svg>
 * </Icon>
 *
 * @example 动态填充（收藏星）
 * <Icon :name="fav ? 'star-fill' : 'star'" :size="20" :filled="fav">
 *     <svg :fill="fav ? 'currentColor' : 'none'" …>…</svg>
 * </Icon>
 */
import { computed, useSlots } from 'vue';
import { glyph } from './glyphs';

const props = withDefaults(
    defineProps<{
        /** 字形名，与 data-ic 一致（多状态时给 `-fill` 后缀） */
        name: string;
        /**
         * 图标边长 px。缺省时按 `size` 取默认 16，再回落 class 里的显式尺寸。
         */
        size?: number;
        /**
         * 是否实心。组件据此把 `name` 解析成 `<name>-fill`（存在时）。
         * H5 端由内联 svg 自身的 `:fill` 决定，此属性只影响 mp。
         */
        filled?: boolean;
        /**
         * 显式 px 尺寸（优先于 size）。用于响应式等不便用 Tailwind 类的场景。
         */
        pixel?: number;
    }>(),
    { size: undefined, filled: false, pixel: undefined },
);

// 默认 16px：项目里 109 处图标 90% 是 h-4/w-4
const FALLBACK_PX = 16;

const slots = useSlots();

/** 实心态优先取 `-fill` 字形（字体里存在才用，否则保持线框） */
const resolvedName = computed(() => {
    if (props.filled && glyph(`${props.name}-fill`)) return `${props.name}-fill`;
    return props.name;
});

const char = computed(() => glyph(resolvedName.value));

/** 从非 mp slot 的 svg 上读 h-N / w-N / h-[Npx]，换算成字体字号 */
function readSlotSize(): number | null {
    const html = slots.default?.();
    if (!html) return null;
    const s = html.join('');
    const m =
        s.match(/\b(?:h|w)-\[(\d+(?:\.\d+)?)px\]/) ||
        s.match(/\b(?:h|w)-([0-9.]+)\b/);
    if (!m) return null;
    const v = m[1];
    if (v.endsWith('px')) return parseFloat(v);
    // Tailwind 间距刻度：0.25rem × N，rem = 16px
    return Math.round(parseFloat(v) * 16);
}

const px = computed(() => {
    if (props.pixel) return props.pixel;
    if (props.size) return props.size;
    return readSlotSize() ?? FALLBACK_PX;
});

const sizeClass = computed(() => (props.size ? `text-[${props.size}px]` : ''));
const sizeStyle = computed(() =>
    props.pixel ? { fontSize: `${props.pixel}px` } : undefined,
);
const colorClass = '';
</script>
