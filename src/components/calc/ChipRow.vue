<template>
    <view class="calc-chip-row" :class="{ 'calc-chip-row--last': last }">
        <text class="calc-chip-row__label">{{ label }}</text>
        <view class="calc-chip-group">
            <view
                v-for="opt in options"
                :key="opt.id"
                class="calc-chip"
                :class="modelValue === opt.id ? 'calc-chip--active' : ''"
                @click="emit('update:modelValue', modelValue === opt.id ? '' : opt.id)"
            >{{ opt.label }}</view>
            <slot name="extra" />
        </view>
    </view>
</template>

<script lang="ts" setup>
interface ChipOption {
    id: string;
    label: string;
}

defineProps<{
    label: string;
    options: ChipOption[];
    /** 省略时该行只渲染 #extra 槽里的 chip（如 calc 页的「状态」行） */
    modelValue?: string;
    last?: boolean;
}>();

const emit = defineEmits<{
    'update:modelValue': [value: string];
}>();
</script>

<style lang="scss" scoped>
.calc-chip-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    min-height: 40px;
    padding: 0 14px;
}

.calc-chip-row__label {
    font-size: 13px;
    font-weight: 600;
    color: #24262b;
    flex-shrink: 0;
}

.calc-chip-group {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    justify-content: flex-end;
}

.calc-chip {
    padding: 5px 11px;
    border-radius: 999px;
    border: 1px solid #e1e4eb;
    background: #f5f6fa;
    color: #6f7682;
    font-size: 12px;
    font-weight: 700;
}

.calc-chip--active {
    color: #ffffff;
    background: linear-gradient(135deg, #73b7ff, #357df4);
    border-color: transparent;
}
</style>