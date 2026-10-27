<template>
    <!--
      游戏内容（RASTER_ICONS）：两端统一走位图 <image>——白屏彩素像素画，
      源 144×144 PNG（36 CSSpx 的 @4 母版；@4x 1:1、@2x 2:1 分频，
      @3x 由 144 缩小到 108）放 src/static/img/hub-icons/。
      彩色像素无法走单色 ttf 字体，故不经 data-ic/glyph 体系。
    -->
    <image v-if="rasterSrc" :src="rasterSrc" mode="aspectFit" class="h-9 w-9" />
    <!-- #ifdef MP-WEIXIN -->
    <text v-else class="ic text-[36px]">{{ glyph(name) }}</text>
    <!-- #endif -->
    <!-- #ifndef MP-WEIXIN -->
    <!-- 元功能（4 枚）：平滑白色实心单色图标，H5 内联 svg；build-icons 扫 data-ic 生成字体供 MP 用。 -->
    <svg
      v-else-if="name === 'mine-settings'"
      data-ic="mine-settings"
      viewBox="0 0 24 24" fill="currentColor" stroke="none" class="h-9 w-9"
    >
      <!-- 设置：EQ 三滑块（三根竖轨 + 错位圆钮），避开齿轮 16px 死结 -->
      <rect x="7.4" y="4" width="1.7" height="16" rx="0.85" />
      <rect x="11.15" y="4" width="1.7" height="16" rx="0.85" />
      <rect x="14.9" y="4" width="1.7" height="16" rx="0.85" />
      <circle cx="8.25" cy="8.6" r="2.2" />
      <circle cx="12" cy="15.4" r="2.2" />
      <circle cx="15.75" cy="11.2" r="2.2" />
    </svg>

    <svg
      v-else-if="name === 'mine-history'"
      data-ic="mine-history"
      viewBox="0 0 24 24" fill="currentColor" stroke="none" class="h-9 w-9"
    >
      <!-- 浏览历史：一串渐小的脚印=训练家走过的痕迹 -->
      <circle cx="9.8" cy="14.7" r="3.4" />
      <circle cx="6.5" cy="9.8" r="1.25" />
      <circle cx="9.8" cy="8.5" r="1.4" />
      <circle cx="13.1" cy="9.8" r="1.25" />
      <circle cx="17.3" cy="17.5" r="1.5" />
      <circle cx="20.1" cy="20.3" r="0.85" />
    </svg>

    <svg
      v-else-if="name === 'mine-devtools'"
      data-ic="mine-devtools"
      viewBox="0 0 24 24" fill="currentColor" stroke="none" class="h-9 w-9"
    >
      <!-- 开发者工具：实心终端卡 + 负形 </> -->
      <path
        fill-rule="evenodd"
        d="M6.6 3.8h10.8a2.8 2.8 0 0 1 2.8 2.8v10.8a2.8 2.8 0 0 1-2.8 2.8H6.6a2.8 2.8 0 0 1-2.8-2.8V6.6a2.8 2.8 0 0 1 2.8-2.8z
          M9.5 8.7 6.9 12l2.6 3.3 0.01-1.85L8.2 12l1.31-1.45z
          M14.5 8.7 17.1 12l-2.6 3.3-0.01-1.85L15.8 12l-1.31-1.45z
          M13.4 7.6 10.6 16.4h1.5l2.8-8.8z"
      />
    </svg>

    <svg
      v-else
      data-ic="hub-stats"
      viewBox="0 0 24 24" fill="currentColor" stroke="none" class="h-9 w-9"
    >
      <!-- 数据统计：平滑趋势折线 + 基线 + 末端点（与能力值的像素竖条刻意分属两种语言） -->
      <path d="M3.6 18.6 9 13.2l3.6 2.7 7-7.6-1.6-1.5-5.4 5.9L9 10 2.4 16.6z" />
      <rect x="3.4" y="19.6" width="17.2" height="1.8" rx="0.9" />
      <circle cx="19.6" cy="6.4" r="1.7" />
    </svg>
    <!-- #endif -->
</template>

<script lang="ts">
/** 资料/功能入口页主题图标名 */
export type HubIconName =
    // 游戏内容：白屏彩素位图（RASTER_ICONS）
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
    | 'mine-fav'
    // 元功能：平滑单色（内联 svg / 字体）
    | 'hub-stats'
    | 'mine-settings'
    | 'mine-history'
    | 'mine-devtools';

/** 游戏内容条目的彩素位图（/static 在 H5 与小程序均按绝对路径访问）。 */
const RASTER_ICONS: Partial<Record<HubIconName, string>> = {
    'data-dex': '/static/img/hub-icons/dex.png',
    'data-type': '/static/img/hub-icons/type.png',
    'data-move': '/static/img/hub-icons/move.png',
    'data-ability': '/static/img/hub-icons/ability.png',
    'data-item': '/static/img/hub-icons/item.png',
    'data-meta': '/static/img/hub-icons/meta.png',
    'hub-damage': '/static/img/hub-icons/damage.png',
    'hub-stat': '/static/img/hub-icons/stat.png',
    'hub-battle': '/static/img/hub-icons/battle.png',
    'hub-team': '/static/img/hub-icons/team.png',
    'hub-template': '/static/img/hub-icons/template.png',
    'mine-fav': '/static/img/hub-icons/fav.png',
};
</script>

<script lang="ts" setup>
import { computed } from 'vue';
import { glyph } from '@/components/icon/glyphs';

const props = defineProps<{
    name: HubIconName;
}>();

const rasterSrc = computed(() => RASTER_ICONS[props.name] ?? '');
</script>
