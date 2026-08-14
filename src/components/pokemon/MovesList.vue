<template>
  <view class="flex flex-col gap-3 mb-3">
    <view
      v-for="group in groups"
      :key="group.key"
      class="archive-section p-4"
    >
      <view class="section-header" @click="toggleExpand(group.key)">
        <view class="flex items-center gap-2">
          <text class="text-lg font-black tracking-[-0.03em] text-[#24262b]">{{ group.label }}</text>
          <text class="section-count">{{ group.moves.length }}</text>
        </view>
        <view class="section-chevron" :class="isExpanded(group.key) ? 'section-chevron--open' : ''">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </view>
      </view>

      <template v-if="isExpanded(group.key)">
        <view v-if="group.moves.length === 0" class="section-empty mt-3">
          {{ t('moves.empty', { label: group.label }) }}
        </view>
        <view v-else class="mt-3 flex flex-col gap-2">
          <MoveCard
            v-for="(move, index) in group.moves"
            :key="index"
            :move="move"
            :show-level="group.key === 'level-up'"
          />
        </view>
      </template>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import MoveCard from '@/components/pokemon/MoveCard.vue'

const { t } = useI18n()

type LearnMethod = MoveRecord['learnMethod']

interface Group {
  key: LearnMethod
  label: string
  moves: MoveRecord[]
}

interface Props {
  moves: MoveRecord[]
}

const props = defineProps<Props>()

const GROUP_KEYS: LearnMethod[] = ['level-up', 'machine', 'egg', 'tutor']
const groupLabel = (key: LearnMethod): string => {
  switch (key) {
    case 'level-up': return t('moves.group.levelUp')
    case 'machine': return t('moves.group.machine')
    case 'egg': return t('moves.group.egg')
    case 'tutor': return t('moves.group.tutor')
  }
}

/** 默认展开状态：升级学习开，其余闭 */
const DEFAULT_EXPANDED: Partial<Record<LearnMethod, boolean>> = {
  'level-up': true,
}

const expanded = ref<Partial<Record<LearnMethod, boolean>>>({ ...DEFAULT_EXPANDED })

// 换宝可梦 / 换形态时回到默认展开状态
watch(
  () => props.moves,
  () => {
    expanded.value = { ...DEFAULT_EXPANDED }
  }
)

const groups = computed<Group[]>(() =>
  GROUP_KEYS.map(key => ({
    key,
    label: groupLabel(key),
    moves: (props.moves ?? []).filter(m => m.learnMethod === key),
  }))
)

const isExpanded = (key: LearnMethod) => !!expanded.value[key]

const toggleExpand = (key: LearnMethod) => {
  expanded.value = { ...expanded.value, [key]: !expanded.value[key] }
}
</script>

<style scoped>
.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  cursor: pointer;
  user-select: none;
}

.section-count {
  padding: 4px 10px;
  color: #6f7682;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 12px;
  font-weight: 900;
  background: #f5f6fa;
  border: 1px solid #e1e4eb;
  border-radius: 999px;
}

.section-chevron {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  color: #8d929c;
  background: #f5f6fa;
  border: 1px solid #e1e4eb;
  border-radius: 999px;
  transition: transform 0.2s ease, color 0.2s ease;
}

.section-chevron--open {
  color: #4a5060;
  transform: rotate(180deg);
}

.section-empty {
  padding: 14px 12px;
  color: #8d929c;
  font-size: 13px;
  font-weight: 800;
  text-align: center;
  background: #f5f6fa;
  border: 1px dashed #e1e4eb;
  border-radius: 18px;
}
</style>
