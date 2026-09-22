<template>
  <view
    class="move-card"
    role="button"
    hover-class="move-card--hover"
    :hover-stay-time="40"
    @click="openDetail"
  >
    <view class="min-w-0 flex-1">
      <text class="block truncate text-sm font-black text-[#24262b]">{{ displayName }}</text>
      <text
        v-if="showLevel && move.level != null"
        class="mt-0.5 block text-[10px] font-black tracking-[0.12em] text-[#8d929c]"
      >Lv.{{ move.level }}</text>
    </view>

    <!--
      分类图标 + 威力命中 + 最右属性图标都是「定宽后缀」，名称 flex 吸收剩余
      宽度；分类图标列因此在各行对齐，不被长短不一的名称顶动。
    -->
    <view class="move-card__category" :aria-label="displayCategory">
      <image
        v-if="categoryBadge"
        :src="categoryBadge"
        mode="aspectFit"
        class="move-card__category-img"
        aria-hidden="true"
      />
      <text v-else class="move-card__category-dash">—</text>
    </view>

    <view class="move-card__stats">
      <view class="move-card__stat">
        <text class="move-card__stat-value">{{ displayPower }}</text>
        <text class="move-card__stat-label">{{ t('moves.power') }}</text>
      </view>
      <view class="move-card__stat-divider"></view>
      <view class="move-card__stat">
        <text class="move-card__stat-value">{{ displayAccuracy }}</text>
        <text class="move-card__stat-label">{{ t('moves.accuracy') }}</text>
      </view>
    </view>

    <!-- 属性图标：定宽收尾，置于最右（与文字徽章时代的原始布局一致） -->
    <TypeBadgeIcon :type="typeSlug" size="m" />
  </view>
</template>

<script setup lang="ts">
import TypeBadgeIcon from '@/components/pokemon/TypeBadgeIcon.vue'
import { getMoveCategoryByPokeapiId, moveCategoryIconPath } from '@/constants/moveCategory'
import { useI18nStore } from '@/store/i18n'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

interface Props {
  move: MoveRecord
  /** 升级学习块显示 "Lv.X · 分类"；其它块只显示分类 */
  showLevel?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  showLevel: false,
})

const i18n = useI18nStore()
const { t } = useI18n()

const typeSlug = computed(() => props.move.type || 'normal')

// 名称按 move.id 响应式查 i18n 表（含英文基线回落）；
// 名称表异步到达 / 切换语言时自动更新，无需重拉招式数据。
const displayName = computed(() => i18n.moveName(props.move.id) ?? t('moves.unknown'))

// ── 分类徽章：PokeAPI damageClassId（1变化 2物理 3特殊）→ waza 分类贴纸 ──
// categoryId 是 PokeAPI id，必须先经 getMoveCategoryByPokeapiId 换成规范 id
// （1物理 2特殊 3变化）再拼图标，否则三类图标会整体错位。规范 id 单一来源见
// constants/moveCategory.ts。未知 id（0）返回 undefined，模板回落破折号。
const categoryBadge = computed<string | undefined>(() => {
  const canonical = getMoveCategoryByPokeapiId(props.move.categoryId)
  return canonical ? moveCategoryIconPath(canonical.id, 'm') : undefined
})

// 分类名响应式查 i18n moveDamageClasses 表（随内容语言切换）
const displayCategory = computed(
  () => (props.move.categoryId && i18n.moveDamageClassName(props.move.categoryId)) || '—',
)
const displayPower = computed(() => props.move.power || '—')
const displayAccuracy = computed(() => props.move.accuracy || '—')

// 点招式卡跳招式详情（资料中心招式页）；id 缺省时不跳
function openDetail() {
  if (!props.move.id) return
  uni.navigateTo({ url: `/pages/archive/move-detail?id=${props.move.id}` })
}
</script>

<style scoped>
.move-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 11px;
  border: 1px solid #e5e7ee;
  border-radius: 18px;
  background: #f5f6fa;
  transition: background 0.15s ease, border-color 0.15s ease;
}

/* 点按反馈（view 的 hover-class） */
.move-card--hover {
  background: #e9edf5;
  border-color: #d7dce8;
}

/* 分类贴纸：waza 图标自带白边与配色，容器只定尺寸、不垫底色、不裁圆角
   （物理星形比圆形更宽，宽度略放，aspectFit 下三类都居中）。 */
.move-card__category {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 32px;
}

.move-card__category-img {
  width: 100%;
  height: 100%;
}

.move-card__category-dash {
  color: #b0b5bf;
  font-size: 15px;
  font-weight: 900;
  line-height: 1;
}

.move-card__stats {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 12px;
  padding: 0 4px;
}

.move-card__stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  min-width: 42px;
}

.move-card__stat-value {
  color: #24262b;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 17px;
  font-weight: 900;
  line-height: 1;
  letter-spacing: -0.02em;
}

.move-card__stat-label {
  color: #8d929c;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.12em;
  line-height: 1;
}

.move-card__stat-divider {
  width: 1px;
  height: 22px;
  background: #e1e4eb;
}
</style>
