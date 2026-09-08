<template>
    <button
        class="shiny-toggle"
        :class="{ 'shiny-toggle--active': modelValue }"
        :aria-pressed="modelValue"
        @click="$emit('update:modelValue', !modelValue)"
    >
        <text>⚡</text>
        <text class="shiny-toggle__label">{{ t('specimen.shiny') }}</text>
    </button>
</template>

<script setup lang="ts">
/**
 * 标本图的「闪光」开关：一枚受控药丸按钮，无内部状态。
 *
 * 闪光态由父组件持有（跨形态保持），本组件只发 `update:modelValue`。
 * 闪光对应的立绘 variant 换算在 `constants/spriteVariants.ts` 的 `heroVariant`，
 * 不在这里 —— 本组件不感知图片。
 */
import { useI18n } from 'vue-i18n';

defineProps<{
    modelValue: boolean;
}>();

defineEmits<{
    'update:modelValue': [v: boolean];
}>();

const { t } = useI18n();
</script>

<style scoped>
.shiny-toggle {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 7px 14px;
    color: #4a5060;
    font-size: 13px;
    font-weight: 700;
    line-height: 1;
    background: #ffffff;
    border: 1px solid #e5e7ee;
    border-radius: 999px;
    box-shadow: 0 4px 10px rgba(48, 55, 72, 0.08);
    transition: transform 0.15s ease, box-shadow 0.15s ease, color 0.15s ease, border-color 0.15s ease, background-color 0.15s ease;
}

.shiny-toggle:active {
    transform: scale(0.94);
}

.shiny-toggle--active {
    color: #a16207;
    border-color: #fcd34d;
    background: #fdf6d8;
}

.shiny-toggle__label {
    font-weight: 800;
}
</style>