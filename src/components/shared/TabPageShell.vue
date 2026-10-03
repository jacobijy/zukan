<template>
    <view
        class="min-h-screen page-bg"
        :style="{
            paddingTop: 'var(--navbar-total-height)',
            paddingBottom: '104px'
        }"
    >
        <NavBar :title="title" />

        <view class="relative z-10 px-4 py-4 sm:px-5">
            <view class="mx-auto max-w-[720px]">
                <slot />
            </view>
        </view>

        <TabBar v-model="currentTab" @change="onTabChange" />
    </view>
</template>

<script lang="ts" setup>
import NavBar from '@/components/NavBar.vue';
import TabBar from '@/components/TabBar.vue';
import { useHideNativeTabBar } from '@/composables/useHideNativeTabBar';
import { computed } from 'vue';

// 壳被 features/data/mine 三个 tab 页直接使用：在此隐藏原生 tabBar，
// 统一改用自定义胶囊（保活仍由原生 tabBar 机制提供）
useHideNativeTabBar();

const props = defineProps<{
    title: string;
    tabIndex: number;
}>();

const emit = defineEmits<{
    'tab-change': [index: number];
}>();

const currentTab = computed(() => props.tabIndex);

const onTabChange = (index: number) => {
    emit('tab-change', index);
};
</script>