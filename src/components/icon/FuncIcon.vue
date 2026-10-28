<template>
    <!--
      功能性彩色图标（2026-10 实心彩套）：图标自身带主色、白色做细节，
      单色 ttf 字体表达不了，与 HubIcon 一样走「144×144 @4 PNG + <image>」，
      H5 / 小程序两端同一渲染、无条件编译分支。
      组件只出图不带底色——浅彩磁贴底由槽位容器（InfoCard / CalcCard）承担。
    -->
    <!-- 尺寸走 scoped 类而非 tailwind 任意值：组件可能晚于 dev server 首次
         Tailwind 扫描出现，任意值类偶发不生成会导致图片宽高为 0。 -->
    <image :src="rasterSrc" mode="aspectFit" class="func-icon" :class="size === 'sm' ? 'func-icon--sm' : 'func-icon--md'" />
</template>

<script lang="ts">
/** 功能性彩色图标名（实心彩套，源 SVG 在 scripts/icons/func/） */
export type FuncIconName =
    // 宝可梦详情信息卡
    | 'height'
    | 'weight'
    | 'details'
    | 'ability'
    // 招式详情
    | 'power'
    | 'accuracy'
    | 'up'
    // 计算器 / 编辑器卡片头
    | 'battle'
    | 'defense'
    | 'move'
    | 'pokemon'
    | 'stats';

/** 功能图标的彩素位图（/static 在 H5 与小程序均按绝对路径访问）。 */
const RASTER_ICONS: Record<FuncIconName, string> = {
    height: '/static/img/func-icons/height.png',
    weight: '/static/img/func-icons/weight.png',
    details: '/static/img/func-icons/details.png',
    ability: '/static/img/func-icons/ability.png',
    power: '/static/img/func-icons/power.png',
    accuracy: '/static/img/func-icons/accuracy.png',
    up: '/static/img/func-icons/up.png',
    battle: '/static/img/func-icons/battle.png',
    defense: '/static/img/func-icons/defense.png',
    move: '/static/img/func-icons/move.png',
    pokemon: '/static/img/func-icons/pokemon.png',
    stats: '/static/img/func-icons/stats.png',
};
</script>

<script lang="ts" setup>
import { computed } from 'vue';

const props = withDefaults(
    defineProps<{
        name: FuncIconName;
        /** md=42px 信息卡槽（30px 图）；sm=26px 卡片头槽（20px 图） */
        size?: 'sm' | 'md';
    }>(),
    { size: 'md' },
);

const rasterSrc = computed(() => RASTER_ICONS[props.name]);
</script>

<style scoped>
/* md=42px 信息卡槽（约 71%）；sm=26px 卡片头槽（约 77%） */
.func-icon--md {
    width: 30px;
    height: 30px;
}

.func-icon--sm {
    width: 20px;
    height: 20px;
}
</style>
