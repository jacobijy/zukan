<template>
    <!--
      资料/功能/我的三页的 16 枚入口图标统一走位图 <image>——3D 炫彩多色套，
      单色 ttf 字体表达不了，故全部不经 data-ic/glyph 体系。
      源 144×144 PNG（36 CSSpx 的 @4 母版；@4x 1:1、@2x 2:1 分频，
      @3x 由 144 缩小到 108）放 src/static/img/hub-icons/；
      /static 在 H5 与小程序均按绝对路径访问，两端同一 <image> 渲染。
    -->
    <image :src="rasterSrc" mode="aspectFit" class="h-9 w-9" />
</template>

<script lang="ts">
/** 资料/功能入口页主题图标名（16 枚全部为彩素位图） */
export type HubIconName =
    // 资料
    | 'data-dex'
    | 'data-type'
    | 'data-move'
    | 'data-ability'
    | 'data-item'
    | 'data-egg'
    | 'data-meta'
    // 功能
    | 'hub-damage'
    | 'hub-stat'
    | 'hub-battle'
    | 'hub-team'
    | 'hub-template'
    | 'hub-stats'
    // 我的
    | 'mine-fav'
    | 'mine-settings'
    | 'mine-history'
    | 'mine-devtools';

/** 入口图标的彩素位图（/static 在 H5 与小程序均按绝对路径访问）。 */
const RASTER_ICONS: Record<HubIconName, string> = {
    'data-dex': '/static/img/hub-icons/dex.png',
    'data-type': '/static/img/hub-icons/type.png',
    'data-move': '/static/img/hub-icons/move.png',
    'data-ability': '/static/img/hub-icons/ability.png',
    'data-item': '/static/img/hub-icons/item.png',
    // TODO(egg-icon): 临时复用收藏心形，待 zukan-icon-work 3D v2 流程出蛋组正式图后只换此处
    'data-egg': '/static/img/hub-icons/fav.png',
    'data-meta': '/static/img/hub-icons/meta.png',
    'hub-damage': '/static/img/hub-icons/damage.png',
    'hub-stat': '/static/img/hub-icons/stat.png',
    'hub-battle': '/static/img/hub-icons/battle.png',
    'hub-team': '/static/img/hub-icons/team.png',
    'hub-template': '/static/img/hub-icons/template.png',
    'hub-stats': '/static/img/hub-icons/stats.png',
    'mine-fav': '/static/img/hub-icons/fav.png',
    'mine-settings': '/static/img/hub-icons/settings.png',
    'mine-history': '/static/img/hub-icons/history.png',
    'mine-devtools': '/static/img/hub-icons/devtools.png',
};
</script>

<script lang="ts" setup>
import { computed } from 'vue';

const props = defineProps<{
    name: HubIconName;
}>();

const rasterSrc = computed(() => RASTER_ICONS[props.name]);
</script>
