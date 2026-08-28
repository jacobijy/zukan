<template>
    <image
        v-if="src"
        :src="src"
        class="object-contain"
        :class="sizeClass"
        mode="aspectFit"
        @error="onError"
    />
    <!-- 无本地图标 / 加载失败：中性占位盒 -->
    <view v-else class="flex items-center justify-center rounded-2xl bg-[#eef0f5] text-[#b4b8c0]" :class="sizeClass">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" :class="iconClass">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
            <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
            <line x1="12" y1="22.08" x2="12" y2="12"></line>
        </svg>
    </view>
</template>

<script lang="ts" setup>
import { computed, ref, watch } from 'vue';
import { itemIconUrl } from '@/constants/itemIcons';

const props = withDefaults(
    defineProps<{
        /** PokeAPI item id */
        id: number;
        size?: 'sm' | 'lg';
    }>(),
    { size: 'sm' },
);

const failed = ref(false);
watch(
    () => props.id,
    () => {
        failed.value = false;
    },
);

const src = computed(() => (failed.value ? null : itemIconUrl(props.id)));

const sizeClass = computed(() =>
    props.size === 'lg' ? 'h-24 w-24 sm:h-28 sm:w-28' : 'h-10 w-10',
);
const iconClass = computed(() => (props.size === 'lg' ? 'h-12 w-12' : 'h-5 w-5'));

const onError = () => {
    failed.value = true;
};
</script>
