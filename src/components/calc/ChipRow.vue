<template>
    <view class="calc-chip-row" :class="{ 'calc-chip-row--last': last }">
        <text class="calc-chip-row__label">{{ label }}</text>
        <view class="calc-chip-group" :class="{ 'calc-chip-group--nowrap': nowrap }">
            <view
                v-for="opt in options"
                :key="opt.id"
                class="calc-chip"
                :class="isActive(opt.id) ? 'calc-chip--active' : ''"
                @click="toggle(opt.id)"
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

const props = withDefaults(defineProps<{
    label: string;
    options: ChipOption[];
    /** 单选传 string；多选（multiple）传 string[] */
    modelValue?: string | string[];
    multiple?: boolean;
    /** 不换行，横向滚动（选项多或英文环境下用） */
    nowrap?: boolean;
    last?: boolean;
}>(), {
    modelValue: '',
    multiple: false,
    nowrap: false,
    last: false,
});

const emit = defineEmits<{
    'update:modelValue': [value: string | string[]];
}>();

const isActive = (id: string): boolean => {
    if (props.multiple) return Array.isArray(props.modelValue) && props.modelValue.includes(id);
    return props.modelValue === id;
};

const toggle = (id: string) => {
    if (props.multiple) {
        const current = Array.isArray(props.modelValue) ? props.modelValue : [];
        const next = current.includes(id) ? current.filter(x => x !== id) : [...current, id];
        emit('update:modelValue', next);
        return;
    }
    emit('update:modelValue', props.modelValue === id ? '' : id);
};
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

.calc-chip-group--nowrap {
    flex: 1;
    min-width: 0;
    flex-wrap: nowrap;
    overflow-x: auto;
    justify-content: flex-start;
    scrollbar-width: none;
    -ms-overflow-style: none;

    &::-webkit-scrollbar {
        display: none;
    }

    .calc-chip {
        flex-shrink: 0;
    }
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
