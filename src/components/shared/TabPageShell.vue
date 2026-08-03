<template>
    <view
        class="min-h-screen page-bg"
        :style="{
            paddingTop: 'calc(var(--status-bar-height) + var(--navbar-content-height))',
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
import { computed } from 'vue';

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