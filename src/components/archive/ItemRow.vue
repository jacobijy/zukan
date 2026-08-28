<template>
    <view class="archive-row" @click="emit('select')">
        <ItemIcon :id="itemId" />
        <view class="archive-row__main">
            <text class="archive-row__title">{{ name }}</text>
        </view>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" class="archive-row__chevron">
            <path d="m9 18 6-6-6-6"></path>
        </svg>
    </view>
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import { useI18nStore } from '@/store/i18n';
import ItemIcon from './ItemIcon.vue';

const props = defineProps<{
    itemId: number;
}>();

const emit = defineEmits<{ select: [] }>();

const i18nStore = useI18nStore();

const name = computed(() => i18nStore.itemName(props.itemId) ?? `item-${props.itemId}`);
</script>
