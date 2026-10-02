<template>
    <view class="archive-row" @click="emit('select')">
        <!-- 本行只在 VirtualList 窗口内挂载（虚拟化已裁剪可见性），故 eager：
             挂载即加载，避开 scroll-view 内 IntersectionObserver 相对 viewport 不触发的坑 -->
        <ItemIcon :id="itemId" eager />
        <view class="archive-row__main">
            <text class="archive-row__title">{{ name }}</text>
        </view>
        <!-- #ifdef MP-WEIXIN -->
        <text class="ic archive-row__chevron text-[16px]">{{ glyph('chevron-right') }}</text>
        <!-- #endif -->
        <!-- #ifndef MP-WEIXIN -->
        <svg data-ic="chevron-right" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" class="archive-row__chevron">
            <path d="m9 18 6-6-6-6"></path>
        </svg>
        <!-- #endif -->
    </view>
</template>

<script lang="ts" setup>
import { glyph } from '@/components/icon/glyphs';
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
