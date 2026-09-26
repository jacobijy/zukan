<template>
    <view class="flex w-full rounded-full bg-[#e9ebf1] p-1">
        <view
            v-for="opt in options"
            :key="opt.value"
            class="flex h-8 flex-1 items-center justify-center rounded-full text-xs font-extrabold tracking-[-0.01em] transition-all duration-200 active:scale-95"
            :class="
                modelValue === opt.value
                    ? 'bg-white text-[#24262b] shadow-[0_2px_8px_rgba(40,46,66,0.12)]'
                    : 'text-[#8d929c]'
            "
            @click="select(opt.value)"
        >
            <text>{{ opt.label }}</text>
        </view>
    </view>
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { BattleFormat } from '@/services/meta';

defineProps<{ modelValue: BattleFormat }>();
const emit = defineEmits<{ 'update:modelValue': [value: BattleFormat] }>();

const { t } = useI18n();

const options = computed(() => [
    { value: 'singles' as BattleFormat, label: t('meta.formatSingles') },
    { value: 'doubles' as BattleFormat, label: t('meta.formatDoubles') },
]);

const select = (value: BattleFormat) => {
    if (value !== undefined) emit('update:modelValue', value);
};
</script>
