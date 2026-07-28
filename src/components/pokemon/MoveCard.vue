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
        <text class="move-card__stat-label">威力</text>
      </view>
      <view class="move-card__stat-divider"></view>
      <view class="move-card__stat">
        <text class="move-card__stat-value">{{ displayAccuracy }}</text>
        <text class="move-card__stat-label">命中</text>
      </view>
    </view>
    <text :class="typeBadgeClass">{{ typeLabel }}</text>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  move: MoveRecord
  /** 升级学习块显示 "Lv.X · 分类"；其它块只显示分类 */
  showLevel?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  showLevel: false,
})

// ── 属性名 slug → 中文名 ──────────────────────────
const TYPE_NAMES: Record<string, string> = {
  normal: '一般',
  fire: '火',
  water: '水',
  electric: '电',
  grass: '草',
  ice: '冰',
  fighting: '格斗',
  poison: '毒',
  ground: '地面',
  flying: '飞行',
  psychic: '超能力',
  bug: '虫',
  rock: '岩石',
  ghost: '幽灵',
  dragon: '龙',
  dark: '恶',
  steel: '钢',
  fairy: '妖精',
}

// ── 属性 badge 渐变（与 detail.vue 一致） ───────────
const TYPE_GRADIENTS: Record<string, string> = {
  normal: 'bg-gradient-to-br from-[#A8A77A] to-[#72714d]',
  fire: 'bg-gradient-to-br from-[#f58b38] to-[#c84b22]',
  water: 'bg-gradient-to-br from-[#5b95f0] to-[#2763c8]',
  electric: 'bg-gradient-to-br from-[#ffd84a] to-[#d99b00] text-[#2f2a12]',
  grass: 'bg-gradient-to-br from-[#83c85a] to-[#3f8f3d]',
  ice: 'bg-gradient-to-br from-[#9adfdc] to-[#50a7aa] text-[#17383a]',
  fighting: 'bg-gradient-to-br from-[#c83a30] to-[#7f211d]',
  poison: 'bg-gradient-to-br from-[#a44ab0] to-[#682672]',
  ground: 'bg-gradient-to-br from-[#e4bf67] to-[#9b7332] text-[#2f2414]',
  flying: 'bg-gradient-to-br from-[#a996f2] to-[#6a55c7]',
  psychic: 'bg-gradient-to-br from-[#ff6794] to-[#c82e63]',
  bug: 'bg-gradient-to-br from-[#a9bd24] to-[#687b11]',
  rock: 'bg-gradient-to-br from-[#bba33d] to-[#756527]',
  ghost: 'bg-gradient-to-br from-[#725799] to-[#3d2b62]',
  dragon: 'bg-gradient-to-br from-[#7042ff] to-[#3519a8]',
  dark: 'bg-gradient-to-br from-[#715847] to-[#35261f]',
  steel: 'bg-gradient-to-br from-[#bfc0d4] to-[#797b96] text-[#242638]',
  fairy: 'bg-gradient-to-br from-[#df8bb6] to-[#a94f7c]',
}

const FALLBACK_GRADIENT = 'bg-gradient-to-br from-[#78906a] to-[#43543a]'

const typeSlug = computed(() => props.move.type || 'normal')
const typeLabel = computed(() => TYPE_NAMES[typeSlug.value] || typeSlug.value)
const typeBadgeClass = computed(
  () => `type-badge ${TYPE_GRADIENTS[typeSlug.value] || FALLBACK_GRADIENT}`
)

// ── 分类：'物理' / '特殊' / '状态' / '—' → slug + 配色 ──
const CATEGORY_SLUGS: Record<string, 'physical' | 'special' | 'status'> = {
  物理: 'physical',
  特殊: 'special',
  状态: 'status',
}

const categorySlug = computed(() => CATEGORY_SLUGS[props.move.category ?? ''] ?? null)

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

const displayName = computed(() => props.move.name || '未知招式')
const displayCategory = computed(() => props.move.category || '—')
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

.type-badge {
  display: inline-block;
  flex-shrink: 0;
  min-width: 44px;
  padding: 4px 8px;
  border-radius: 999px;
  color: #fff;
  font-size: 10px;
  font-weight: 900;
  text-align: center;
  box-shadow: 0 6px 12px rgba(0, 0, 0, 0.12);
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
