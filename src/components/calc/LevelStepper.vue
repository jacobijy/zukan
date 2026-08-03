<template>
    <view class="calc-stepper">
        <view class="calc-stepper__btn" @click="emit('update:modelValue', clamp(modelValue - 1))">−</view>
        <view class="calc-stepper__value--wrap">
            <text class="calc-stepper__label">{{ label }}</text>
            <text class="calc-stepper__value">{{ modelValue }}</text>
        </view>
        <view class="calc-stepper__btn" @click="emit('update:modelValue', clamp(modelValue + 1))">+</view>
    </view>
</template>

<script lang="ts" setup>
const props = withDefaults(defineProps<{
    modelValue: number;
    min?: number;
    max?: number;
    label?: string;
}>(), {
    min: 1,
    max: 100,
    label: 'Lv',
});

const emit = defineEmits<{
    'update:modelValue': [value: number];
}>();

const clamp = (v: number) => Math.max(props.min, Math.min(props.max, v));
</script>

<style lang="scss" scoped>
.calc-stepper {
    display: flex;
    align-items: center;
    gap: 8px;
}

.calc-stepper__btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    border-radius: 8px;
    border: 1px solid #e1e4eb;
    background: #f5f6fa;
    color: #6f7682;
    font-size: 15px;
    font-weight: 700;
}

.calc-stepper__value--wrap {
    display: flex;
    flex-direction: column;
    align-items: center;
    min-width: 32px;
    gap: 0;
}

.calc-stepper__label {
    font-size: 9px;
    font-weight: 700;
    color: #9da2ad;
    line-height: 1;
}

.calc-stepper__value {
    min-width: 26px;
    text-align: center;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 14px;
    font-weight: 800;
    color: #24262b;
}
</style>