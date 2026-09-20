<template>
  <!-- 已知属性：官方属性贴纸图标；未知 slug 回落文字版 TypeBadge（其自带中性兜底） -->
  <view
    v-if="iconSrc"
    class="type-badge-icon"
    :class="`type-badge-icon--${size}`"
    role="img"
    :aria-label="label"
  >
    <image
      :src="iconSrc"
      mode="aspectFit"
      class="type-badge-icon__img"
      aria-hidden="true"
    />
  </view>
  <TypeBadge v-else :type="type" size="md" />
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import { getTypeMeta, typeIconPath } from '@/constants/pokemonTypes';
import type { TypeIconSize } from '@/constants/pokemonTypes';
import { useI18nStore } from '@/store/i18n';
import TypeBadge from '@/components/pokemon/TypeBadge.vue';

interface Props {
  /** 属性 slug：'fire' / 'grass' / ... */
  type: string;
  /** 图标档：s 紧凑行内、m 默认、l 大尺寸 */
  size?: TypeIconSize;
}

const props = withDefaults(defineProps<Props>(), {
  size: 'm',
});

const i18nStore = useI18nStore();

const iconSrc = computed(() => typeIconPath(props.type, props.size));

// 无障碍名随内容语言；未就绪 / 未知回落硬编码名
const label = computed(() => i18nStore.typeName(props.type) ?? getTypeMeta(props.type).name);
</script>

<style scoped>
/* 白底圆形徽章：属性贴纸落在白圆盘上，overflow 裁掉贴纸自带投影与透明角，
   在浅灰卡片上靠细环 + 轻阴影与底色分离。 */
.type-badge-icon {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  padding: 0;
  line-height: 1;
  background: #fff;
  border: 1px solid #e9ebf1;
  border-radius: 50%;
  box-shadow: 0 2px 6px rgba(20, 23, 40, 0.08);
  overflow: hidden;
}

.type-badge-icon__img {
  width: 75%;
  height: 75%;
}

/* 圆盘直径与内部图标（75%）：与 move-card 分类图标 / 数值列的高度对齐 */
.type-badge-icon--s {
  width: 24px;
  height: 24px;
}

.type-badge-icon--m {
  width: 32px;
  height: 32px;
}

.type-badge-icon--l {
  width: 44px;
  height: 44px;
}
</style>
