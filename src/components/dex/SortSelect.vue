<template>
  <view class="sort-select">
    <button
      class="sort-select__trigger"
      :class="{ 'sort-select__trigger--custom': modelValue !== 'id' }"
      :aria-expanded="open"
      @click.stop="open = !open"
    >
      <text class="sort-select__label">{{ currentLabel }}</text>
      <!-- #ifdef MP-WEIXIN -->
      <text class="ic sort-select__chevron" :class="{ 'is-open': open }" aria-hidden="true">{{ glyph('chevron-down') }}</text>
      <!-- #endif -->
      <!-- #ifndef MP-WEIXIN -->
      <svg
        viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6"
        stroke-linecap="round" stroke-linejoin="round" data-ic="chevron-down"
        aria-hidden="true" class="sort-select__chevron" :class="{ 'is-open': open }"
      >
        <path d="m6 9 6 6 6-6"></path>
      </svg>
      <!-- #endif -->
    </button>

    <template v-if="open">
      <!-- 透明遮罩：点外部收起 -->
      <view class="sort-select__veil" @click="close"></view>
      <view class="sort-select__menu">
        <view
          v-for="option in options"
          :key="option.value"
          class="sort-select__row"
          :class="{ 'sort-select__row--selected': option.value === modelValue }"
          @click="choose(option.value)"
        >
          <text class="sort-select__row-label">{{ option.label }}</text>
          <!-- #ifdef MP-WEIXIN -->
          <text v-if="option.value === modelValue" class="ic sort-select__check" aria-hidden="true">{{ glyph('check') }}</text>
          <!-- #endif -->
          <!-- #ifndef MP-WEIXIN -->
          <svg
            v-if="option.value === modelValue" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="2.8" stroke-linecap="round"
            stroke-linejoin="round" data-ic="check" aria-hidden="true"
            class="sort-select__check"
          >
            <path d="m5 12.5 4.5 4.5L19 7.5"></path>
          </svg>
          <!-- #endif -->
        </view>
      </view>
    </template>
  </view>
</template>

<script lang="ts" setup>
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { glyph } from '@/components/icon/glyphs';
import type { DexSortKey } from '@/utils/dexFilter';

interface Option { value: DexSortKey; label: string }

interface Props {
  /** 当前排序键（v-model） */
  modelValue: DexSortKey;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  'update:modelValue': [value: DexSortKey];
}>();

const { t } = useI18n();

const open = ref(false);

const options = computed<Option[]>(() => [
  { value: 'id', label: t('dex.filter.sort.id') },
  { value: 'hp', label: t('dex.filter.sort.hp') },
  { value: 'attack', label: t('dex.filter.sort.attack') },
  { value: 'defense', label: t('dex.filter.sort.defense') },
  { value: 'spAttack', label: t('dex.filter.sort.spAttack') },
  { value: 'spDefense', label: t('dex.filter.sort.spDefense') },
]);

const currentLabel = computed(
  () => options.value.find((o) => o.value === props.modelValue)?.label ?? options.value[0].label,
);

const close = () => { open.value = false; };

const choose = (value: DexSortKey) => {
  emit('update:modelValue', value);
  open.value = false;
};
</script>

<style lang="scss" scoped>
.sort-select {
  position: relative;
  display: inline-flex;
}

/* ── 排序片 ── */
/* ── 工具栏排序按钮：透明底，与收藏 / 折叠图标钮同高 ── */
.sort-select__trigger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 3px;
  height: 40px;
  margin: 0;
  padding: 0 5px;
  border: 0;
  border-radius: 12px;
  background: transparent;
  color: #6f7480;
  font-size: 13px;
  font-weight: 700;
  line-height: 1;
  transition: background 0.15s ease, color 0.15s ease;
  touch-action: manipulation;
}

/* 非默认排序时变蓝，提示当前是自定义排序 */
.sort-select__trigger--custom {
  color: #007aff;
}

.sort-select__trigger:active {
  background: rgba(60, 60, 67, 0.08);
}

.sort-select__label {
  line-height: 1;
}

.sort-select__chevron {
  width: 12px;
  height: 12px;
  font-size: 12px;
  transition: transform 0.18s ease;
}

.sort-select__chevron.is-open {
  transform: rotate(180deg);
}

/* ── 下拉菜单 ── */
.sort-select__veil {
  position: fixed;
  inset: 0;
  z-index: 40;
}

.sort-select__menu {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  z-index: 41;
  width: 140px;
  padding: 4px 0;
  border-radius: 14px;
  background: #ffffff;
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.2);
}

.sort-select__row {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 40px;
  padding: 0 14px;
  color: #1c1c1e;
  font-size: 14px;
  font-weight: 500;
  touch-action: manipulation;
}

.sort-select__row + .sort-select__row::before {
  content: '';
  position: absolute;
  top: 0;
  left: 14px;
  right: 0;
  height: 0.5px;
  background: rgba(60, 60, 67, 0.14);
}

.sort-select__row--selected {
  color: #007aff;
}

.sort-select__row:active {
  background: #f5f6fa;
}

.sort-select__row-label {
  line-height: 1;
}

.sort-select__check {
  flex-shrink: 0;
  width: 15px;
  height: 15px;
  font-size: 15px;
}

.sort-select__trigger::after {
  border: none !important;
}
</style>
