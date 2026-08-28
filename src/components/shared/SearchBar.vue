<template>
    <view class="relative h-10 w-full sm:h-11">
        <input
            type="text"
            :placeholder="placeholder"
            class="h-10 w-full rounded-[20px] border border-[#e1e4eb] bg-[#f5f6fa] pl-10 pr-9 text-sm font-semibold text-[#24262b] shadow-[inset_0_1px_0_#ffffff] outline-none placeholder:text-[#9da2ad] focus:border-[#357df4] focus:bg-white focus:shadow-[0_0_0_4px_rgba(53,125,244,0.12)] sm:h-11 sm:rounded-[22px] sm:pl-11 sm:pr-10"
            :value="modelValue"
            @input="onInput"
        />
        <view class="absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[#8d929c] sm:left-4 sm:h-5 sm:w-5">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="h-full w-full">
                <circle cx="11" cy="11" r="8"></circle>
                <path d="m21 21-4.35-4.35"></path>
            </svg>
        </view>
        <view
            v-if="modelValue"
            class="absolute right-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 cursor-pointer text-[#90997f] sm:right-4 sm:h-5 sm:w-5"
            @click="emit('update:modelValue', '')"
        >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="h-full w-full">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
        </view>
    </view>
</template>

<script lang="ts" setup>
interface Props {
    /** 搜索词（v-model） */
    modelValue: string;
    placeholder?: string;
}

withDefaults(defineProps<Props>(), {
    placeholder: '',
});

const emit = defineEmits<{
    'update:modelValue': [value: string];
}>();

const onInput = (e: any) => {
    emit('update:modelValue', e.detail?.value ?? e.target?.value ?? '');
};
</script>
