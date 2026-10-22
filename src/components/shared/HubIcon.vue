<template>
    <!-- #ifdef MP-WEIXIN -->
    <text class="ic text-[24px]">{{ glyph(name) }}</text>
    <!-- #endif -->
    <!-- #ifndef MP-WEIXIN -->
    <!--
      资料/功能两个入口页的主题图标：宝可梦世界物件（24 栅格、2.2 线宽、圆角端点）。
      唯一数据源就在这里——H5 渲染内联 svg，build-icons 静态扫描 data-ic 生成字体，
      MP 端走 glyph()。改名/换图形只改本文件，子页面共用的通用字形不受影响。
    -->
    <svg
      v-if="name === 'data-dex'"
      data-ic="data-dex"
      viewBox="0 0 24 24" fill="none" stroke="currentColor"
      stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="h-6 w-6"
    >
      <!-- 图鉴设备：横版翻盖掌机，上半屏幕 + 下半十字键与圆钮 -->
      <rect x="3" y="6" width="18" height="12" rx="2.6" />
      <path d="M4.2 11h15.6" />
      <path d="M6.6 8.3h6.5M6.6 9.7h3.8" />
      <path d="M6.2 14.3h2.6M7.5 13v2.6" />
      <circle cx="17" cy="14.2" r="1.3" />
    </svg>

    <svg
      v-else-if="name === 'data-type'"
      data-ic="data-type"
      viewBox="0 0 24 24" fill="none" stroke="currentColor"
      stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="h-6 w-6"
    >
      <!-- 属性：双环沿斜向交叠（水平双环会被读成眼镜），表示单/双属性叠加 -->
      <circle cx="9.8" cy="9.8" r="5" />
      <circle cx="14.2" cy="14.2" r="5" />
    </svg>

    <svg
      v-else-if="name === 'data-move'"
      data-ic="data-move"
      viewBox="0 0 24 24" fill="none" stroke="currentColor"
      stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="h-6 w-6"
    >
      <!-- 招式：八角冲击星爆（漫画 POW），区别于四角 sparkle 闪光 -->
      <path d="M12 4 14.95 10.78 20 12l-5.05 1.22L12 20l-2.95-6.78L4 12l5.05-1.22z" />
    </svg>

    <svg
      v-else-if="name === 'data-ability'"
      data-ic="data-ability"
      viewBox="0 0 24 24" fill="none" stroke="currentColor"
      stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="h-6 w-6"
    >
      <!-- 特性：双螺旋（与生俱来的资质），两档横档 -->
      <path d="M8 4c7 3 7 6 4 8s-3 6 4 8" />
      <path d="M16 4c-7 3-7 6-4 8s3 6-4 8" />
      <path d="M10 7.9h4M10 16.1h4" />
    </svg>

    <svg
      v-else-if="name === 'data-item'"
      data-ic="data-item"
      viewBox="0 0 24 24" fill="none" stroke="currentColor"
      stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="h-6 w-6"
    >
      <!-- 道具：伤药喷雾罐，喷嘴 + 罐体 + 标签线 -->
      <rect x="9.5" y="3" width="5" height="2.3" rx="0.7" />
      <rect x="10.6" y="5.3" width="2.8" height="1.8" rx="0.5" />
      <rect x="6" y="7.1" width="12" height="13.9" rx="2.6" />
      <path d="M9.5 12.5h5M9.5 15.3h5" />
    </svg>

    <svg
      v-else-if="name === 'data-meta'"
      data-ic="data-meta"
      viewBox="0 0 24 24" fill="none" stroke="currentColor"
      stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="h-6 w-6"
    >
      <!-- 对战资料：冠军奖杯，杯耳 + 高柄 + 单梯形基座 -->
      <path d="M8 4h8v4.6a4 4 0 0 1-8 0z" />
      <path d="M8 6.2H5.7a2.3 2.3 0 0 0 2.3 3.4" />
      <path d="M16 6.2h2.3a2.3 2.3 0 0 1-2.3 3.4" />
      <path d="M12 12.6v2.6" />
      <path d="M10.2 15.2h3.6l1 3.8H9.2z" />
    </svg>

    <svg
      v-else-if="name === 'hub-damage'"
      data-ic="hub-damage"
      viewBox="0 0 24 24" fill="none" stroke="currentColor"
      stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="h-6 w-6"
    >
      <!-- 伤害计算：精灵球即靶心，环 + 赤道线 + 实心钮，四向刻度 -->
      <circle cx="12" cy="12" r="7.4" />
      <path d="M5 12h14" />
      <circle cx="12" cy="12" r="1.7" fill="currentColor" stroke="none" />
      <path d="M12 2.8v2.3M12 18.9v2.3M2.8 12h2.3M18.9 12h2.3" />
    </svg>

    <svg
      v-else-if="name === 'hub-stat'"
      data-ic="hub-stat"
      viewBox="0 0 24 24" fill="none" stroke="currentColor"
      stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="h-6 w-6"
    >
      <!-- 能力值：六维雷达，外/内两层六边形 + 数据中心点 -->
      <path d="M12 3.6 19.2 7.8v8.4L12 20.4l-7.2-4.2V7.8z" />
      <path d="M12 7.9l3.6 2.05v4.1L12 16.1l-3.6-2.05v-4.1z" />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
    </svg>

    <svg
      v-else-if="name === 'hub-battle'"
      data-ic="hub-battle"
      viewBox="0 0 24 24" fill="none" stroke="currentColor"
      stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="h-6 w-6"
    >
      <!-- 对战模拟：双球斜对角对峙，对角线中央一颗碰撞火花 -->
      <circle cx="7.5" cy="15" r="3.2" />
      <path d="M4.3 15h6.4" />
      <circle cx="7.5" cy="15" r="0.85" fill="currentColor" stroke="none" />
      <circle cx="16.5" cy="9" r="3.2" />
      <path d="M13.3 9h6.4" />
      <circle cx="16.5" cy="9" r="0.85" fill="currentColor" stroke="none" />
      <path
        d="M12 10 12.8 11.2 14 12l-1.2.8L12 14l-.8-1.2L10 12l1.2-.8z"
        fill="currentColor" stroke="none"
      />
    </svg>

    <svg
      v-else-if="name === 'hub-team'"
      data-ic="hub-team"
      viewBox="0 0 24 24" fill="none" stroke="currentColor"
      stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="h-6 w-6"
    >
      <!-- 我的队伍：三颗精灵球正三角编队（独立个体聚类，避免二上一下成脸） -->
      <circle cx="12" cy="7.5" r="3" />
      <path d="M9 7.5h6" />
      <circle cx="12" cy="7.5" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="7.5" cy="15" r="3" />
      <path d="M4.5 15h6" />
      <circle cx="7.5" cy="15" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="16.5" cy="15" r="3" />
      <path d="M13.5 15h6" />
      <circle cx="16.5" cy="15" r="0.9" fill="currentColor" stroke="none" />
    </svg>

    <svg
      v-else-if="name === 'hub-template'"
      data-ic="hub-template"
      viewBox="0 0 24 24" fill="none" stroke="currentColor"
      stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="h-6 w-6"
    >
      <!-- 云端模板：云轮廓内两行文档线（云同步的配信卡片） -->
      <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
      <path d="M10.8 13.6h4.2M10.8 16h2.8" />
    </svg>

    <svg
      v-else
      data-ic="hub-stats"
      viewBox="0 0 24 24" fill="none" stroke="currentColor"
      stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="h-6 w-6"
    >
      <!-- 数据统计：三根递增柱，最高柱顶一颗精灵球 -->
      <path d="M5 20v-6M11 20v-10M17 20V7" />
      <path d="M3.6 20h17" />
      <circle cx="17" cy="3.6" r="2.6" />
      <path d="M14.4 3.6h5.2" />
      <circle cx="17" cy="3.6" r="0.7" fill="currentColor" stroke="none" />
    </svg>
    <!-- #endif -->
</template>

<script lang="ts">
/** 资料/功能入口页主题图标名（一组宝可梦世界物件） */
export type HubIconName =
    | 'data-dex'
    | 'data-type'
    | 'data-move'
    | 'data-ability'
    | 'data-item'
    | 'data-meta'
    | 'hub-damage'
    | 'hub-stat'
    | 'hub-battle'
    | 'hub-team'
    | 'hub-template'
    | 'hub-stats';
</script>

<script lang="ts" setup>
import { glyph } from '@/components/icon/glyphs';

defineProps<{
    name: HubIconName;
}>();
</script>
