<template>
  <view class="panel-actions">
    <button class="panel-actions__btn panel-actions__btn--ghost" @click="emit('secondary')">
      {{ secondaryText }}
    </button>
    <button class="panel-actions__btn panel-actions__btn--primary" @click="emit('primary')">
      {{ primaryText }}
    </button>
  </view>
</template>

<script lang="ts" setup>
interface Props {
  /** 左侧次按钮文案（重置 / 全部…） */
  secondaryText: string;
  /** 右侧主按钮文案（完成 / 确认） */
  primaryText: string;
}

defineProps<Props>();

const emit = defineEmits<{
  secondary: [];
  primary: [];
}>();
</script>

<style lang="scss" scoped>
.panel-actions {
  display: flex;
  gap: 10px;
}

.panel-actions__btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 48px;
  padding: 0 16px;
  border-radius: 13px;
  font-size: 15px;
  font-weight: 600;
  line-height: 1;
  letter-spacing: -0.01em;
  transition: transform 0.15s ease, opacity 0.15s ease, background 0.15s ease;
  touch-action: manipulation;
}

.panel-actions__btn:active {
  transform: scale(0.98);
}

/* iOS 次按钮：白底 + 发丝描边 */
.panel-actions__btn--ghost {
  flex: 0.85;
  border: 1px solid rgba(60, 60, 67, 0.18);
  color: #1c1c1e;
  background: #ffffff;
}

/* iOS 主按钮：填充蓝、扁平无渐变 */
.panel-actions__btn--primary {
  flex: 1.15;
  border-color: transparent;
  color: #fff;
  background: #007aff;
}

.panel-actions button::after {
  border: none !important;
}
</style>
