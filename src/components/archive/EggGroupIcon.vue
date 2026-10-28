<template>
    <!--
      蛋组图标（蛋组列表行 / 详情头部）。
      与 HubIcon/FuncIcon 同位图通道：144×144 @4 PNG 放 static/img/egg-group-icons/，
      /static 绝对路径在 H5 与小程序均按 <image> 渲染，无条件编译分支。

      当前 15 个蛋组共用 placeholder.png（3D 蛋栏目图，与 hub-icons/egg.png 同源，
      母版为设计稿 1254px 降采样到 144）；后续补各蛋组正式彩图时，往目录加
      <slug>.png 并在 ICON_PATHS 加映射即可，调用方与槽位样式都不用动。只做一个尺寸。
    -->
    <view class="egg-tile">
        <image :src="iconSrc" mode="aspectFit" class="egg-tile__img" />
    </view>
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import { getEggGroupMeta } from '@/constants/eggGroups';

const props = defineProps<{
    /** PokeAPI 蛋组 id（1..15）；正式图标补齐前一律回落占位图 */
    id: number;
}>();

/** 各蛋组正式彩图（按 slug 命名）；未收录的蛋组回落 placeholder。 */
const ICON_PATHS: Partial<Record<string, string>> = {
    // 例：monster: '/static/img/egg-group-icons/monster.png',
};

const PLACEHOLDER = '/static/img/egg-group-icons/placeholder.png';

const iconSrc = computed(() => {
    const slug = getEggGroupMeta(props.id)?.slug;
    return (slug && ICON_PATHS[slug]) || PLACEHOLDER;
});
</script>

<style scoped>
/* 40px 槽，与 ItemIcon sm 同规格；浅紫磁贴底（同 list-row__icon--violet 渐变） */
.egg-tile {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border-radius: 13px;
    background: linear-gradient(135deg, #f0eaff 0%, #ddd1fe 58%, #c5b4fa 100%);
    box-shadow: inset 0 1px 0 #ffffff;
}

.egg-tile__img {
    width: 32px;
    height: 32px;
}
</style>
