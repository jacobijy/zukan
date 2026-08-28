<template>
  <view class="move-card">
    <view class="min-w-0 flex-1">
      <text class="block truncate text-sm font-black text-[#24262b]">{{ displayName }}</text>
      <text
        v-if="showLevel && move.level != null"
        class="mt-0.5 block text-[10px] font-black tracking-[0.12em] text-[#8d929c]"
      >Lv.{{ move.level }}</text>
    </view>

    <view class="move-card__category" :class="categoryBadgeClass" :aria-label="displayCategory">
      <!-- 物理：实心菱形，象征打击力 -->
      <svg
        v-if="categorySlug === 'physical'"
        viewBox="0 0 24 24"
        fill="currentColor"
        class="h-3.5 w-3.5"
      >
        <path d="M12 3L2 12l10 9 10-9L12 3z" />
      </svg>
      <!-- 特殊：星形闪光 -->
      <svg
        v-else-if="categorySlug === 'special'"
        viewBox="0 0 24 24"
        fill="currentColor"
        class="h-3.5 w-3.5"
      >
        <path d="M12 2l2.5 7h7l-5.5 4 2 7-6-4-6 4 2-7-5.5-4h7z" />
      </svg>
      <!-- 状态：圆环 + 中心点 -->
      <svg
        v-else-if="categorySlug === 'status'"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2.5"
        class="h-3.5 w-3.5"
      >
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="2.5" fill="currentColor" />
      </svg>
      <text v-else class="text-[10px] font-black text-[#8d929c]">—</text>
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
    <TypeBadge :type="typeSlug" size="md" />
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import TypeBadge from '@/components/pokemon/TypeBadge.vue'
import { useI18nStore } from '@/store/i18n'

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

// ── 分类：damageClassId 1=状态 2=物理 3=特殊 → slug + 配色 ──
const CATEGORY_SLUGS: Record<number, 'physical' | 'special' | 'status'> = {
  2: 'physical',
  3: 'special',
  1: 'status',
}

const categorySlug = computed(() => CATEGORY_SLUGS[props.move.categoryId] ?? null)

const categoryBadgeClass = computed(() => {
  switch (categorySlug.value) {
    case 'physical':
      return 'move-card__category--physical'
    case 'special':
      return 'move-card__category--special'
    case 'status':
      return 'move-card__category--status'
    default:
      return 'move-card__category--unknown'
  }
})

// 分类名响应式查 i18n moveDamageClasses 表（随内容语言切换）
const displayCategory = computed(
  () => (props.move.categoryId && i18n.moveDamageClassName(props.move.categoryId)) || '—',
)
const displayPower = computed(() => props.move.power || '—')
const displayAccuracy = computed(() => props.move.accuracy || '—')
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
}

.move-card__category {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 999px;
  color: #ffffff;
  box-shadow: 0 6px 12px rgba(0, 0, 0, 0.1);
}

.move-card__category--physical {
  background: linear-gradient(135deg, #ff8a5c, #e0532c);
}

.move-card__category--special {
  background: linear-gradient(135deg, #7c6df0, #4934c8);
}

.move-card__category--status {
  background: linear-gradient(135deg, #9ba7bd, #5c6577);
}

.move-card__category--unknown {
  background: #eef0f5;
  color: #8d929c;
  box-shadow: none;
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
