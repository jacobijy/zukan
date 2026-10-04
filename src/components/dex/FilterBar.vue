<template>
  <view class="filter-layer fixed inset-0 z-[998] pointer-events-none">
    <view
      v-if="visible"
      class="filter-mask absolute inset-0 pointer-events-auto"
      @click="closeFilterPanel"
      @touchmove.stop.prevent
    ></view>

    <view
      class="filter-panel fixed z-[1] pointer-events-auto"
      :class="{ 'filter-panel--visible': visible }"
      :style="{ top: 'calc(var(--navbar-total-height) + 8px)' }"
    >
      <view class="filter-panel__header">
        <text class="filter-panel__title">{{ t('dex.typeFilter') }}</text>
        <text v-if="selectedTypes.length" class="filter-selection-count">
          {{ t('dex.filter.selectedCount', { count: selectedTypes.length }) }}
        </text>
      </view>

      <scroll-view scroll-y class="filter-panel__content">
        <view class="filter-card">
          <view class="filter-types">
            <button
              v-for="type in allTypes"
              :key="type"
              class="filter-type"
              :class="{ 'filter-type--selected': selectedTypes.includes(type) }"
              :aria-pressed="selectedTypes.includes(type)"
              @click="toggleTypeFilter(type)"
            >
              <TypeBadge :type="type" size="xl" variant="pill" />
            </button>
          </view>
        </view>
      </scroll-view>

      <view class="filter-panel__footer">
        <PanelActions
          :secondary-text="t('common.reset')"
          :primary-text="t('dex.filter.done')"
          @secondary="resetFilters"
          @primary="closeFilterPanel"
        />
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ALL_TYPE_SLUGS } from '@/constants/pokemonTypes'
import TypeBadge from '@/components/pokemon/TypeBadge.vue'
import PanelActions from '@/components/shared/PanelActions.vue'

interface Props {
  visible: boolean;
}

defineProps<Props>()

const emit = defineEmits<{
  filterChange: [types: string[]];
  filterToggle: [visible: boolean];
}>()

const { t } = useI18n()

const allTypes = ref<string[]>(ALL_TYPE_SLUGS)
const selectedTypes = ref<string[]>([])

const emitFilterChange = () => {
  emit('filterChange', [...selectedTypes.value])
}

const toggleTypeFilter = (type: string) => {
  selectedTypes.value = selectedTypes.value.includes(type)
    ? selectedTypes.value.filter(selected => selected !== type)
    : [...selectedTypes.value, type]
  emitFilterChange()
}

const resetFilters = () => {
  selectedTypes.value = []
  emitFilterChange()
}

const closeFilterPanel = () => {
  emit('filterToggle', false)
}
</script>

<style lang="scss" scoped>
$ios-blue: #007aff;
$ios-bg: #f2f2f7;
$ios-separator: rgba(60, 60, 67, 0.13);

.filter-layer {
  color: #1c1c1e;
  -webkit-tap-highlight-color: transparent;
}

.filter-mask {
  background: rgba(0, 0, 0, 0.25);
  animation: filter-mask-in 0.2s ease both;
}

.filter-panel {
  left: 10px;
  right: 10px;
  display: flex;
  flex-direction: column;
  max-height: calc(100vh - var(--navbar-total-height) - 24px - env(safe-area-inset-bottom));
  max-height: calc(100dvh - var(--navbar-total-height) - 24px - env(safe-area-inset-bottom));
  overflow: hidden;
  overscroll-behavior: contain;
  border-radius: 20px;
  background: $ios-bg;
  box-shadow: 0 18px 48px rgba(0, 0, 0, 0.18);
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'PingFang SC', 'Helvetica Neue', Helvetica, sans-serif;
  opacity: 0;
  transform: translateY(-8px) scale(0.985);
  transform-origin: top center;
  visibility: hidden;
  transition: opacity 0.2s ease, transform 0.24s ease, visibility 0.24s;
}

.filter-panel--visible {
  opacity: 1;
  transform: translateY(0) scale(1);
  visibility: visible;
}

/* ── 头部：标题居中，无关闭钮 ── */
.filter-panel__header {
  position: relative;
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  min-height: 52px;
  padding: 12px 16px;
  border-bottom: 0.5px solid $ios-separator;
  background: #ffffff;
}

.filter-panel__title {
  color: #1c1c1e;
  font-size: 17px;
  font-weight: 600;
  letter-spacing: -0.02em;
}

.filter-selection-count {
  position: absolute;
  right: 16px;
  color: $ios-blue;
  font-size: 14px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

/* ── 内容：白卡片内的属性标签 ── */
.filter-panel__content {
  flex: 1 1 0%;
  height: 0;
  min-height: 0;
  padding: 14px;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
}

.filter-card {
  padding: 14px;
  border-radius: 12px;
  background: #ffffff;
}

/* ── 属性标签：按钮彻底重置，徽章严格居中 ── */
.filter-types {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 11px 10px;
}

.filter-type {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-width: 0;
  height: auto;
  padding: 0;
  margin: 0;
  border: 0;
  border-radius: 999px;
  background: transparent;
  line-height: 1;
  font-size: 0;
  transition: transform 0.16s ease, box-shadow 0.16s ease;
  touch-action: manipulation;
}

/* 徽章填满格子：18 个等宽对齐，避免右侧参差留空 */
.filter-type :deep(.type-badge) {
  width: 100%;
}

.filter-type--selected {
  box-shadow:
    0 0 0 2px $ios-blue,
    0 0 0 4.5px rgba(0, 122, 255, 0.15);
  transform: scale(1.04);
}

.filter-type:active {
  transform: scale(0.95);
}

.filter-type--selected:active {
  transform: scale(1);
}

/* ── 底部操作 ── */
.filter-panel__footer {
  flex-shrink: 0;
  padding: 12px 14px calc(14px + env(safe-area-inset-bottom));
  border-top: 0.5px solid $ios-separator;
  background: $ios-bg;
}

/* uni-app 将 <button> 编译为 <uni-button>，默认边框挂在其 ::after 上，
   必须用 class 选择器（元素选择器 button 命中不了） */
.filter-type::after {
  border: none !important;
}

.filter-type:focus-visible {
  outline: 2px solid rgba(0, 122, 255, 0.7);
  outline-offset: 2px;
}

@keyframes filter-mask-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

@media (prefers-reduced-motion: reduce) {
  .filter-mask,
  .filter-panel,
  .filter-panel button {
    animation-duration: 0.01ms;
    transition-duration: 0.01ms;
  }
}

@media (min-width: 640px) {
  .filter-panel {
    left: 12px;
    right: 12px;
    max-width: 680px;
    margin: 0 auto;
    border-radius: 22px;
  }

  .filter-types {
    grid-template-columns: repeat(6, minmax(0, 1fr));
    gap: 12px 10px;
  }
}
</style>
