<template>
    <view class="archive-row" @click="emit('select')">
        <view class="archive-row__main">
            <text class="archive-row__title">{{ name }}</text>
            <view class="archive-row__sub">
                <TypeBadge :type="slug" size="sm" variant="pill" />
            </view>
        </view>
        <text class="archive-row__meta">{{ t('archive.pokemonCount', { n: count }) }}</text>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" class="archive-row__chevron">
            <path d="m9 18 6-6-6-6"></path>
        </svg>
    </view>
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import TypeBadge from '@/components/pokemon/TypeBadge.vue';
import { useI18nStore } from '@/store/i18n';
import { getTypeMeta } from '@/constants/pokemonTypes';

const props = defineProps<{
    /** 属性 slug：'fire' / 'water' / ... */
    slug: string;
    count: number;
}>();

const emit = defineEmits<{ select: [] }>();

const { t } = useI18n();
const i18nStore = useI18nStore();

// 全名优先内容语言 i18n，未就绪回落常量中文名
const name = computed(() => i18nStore.typeName(props.slug) ?? getTypeMeta(props.slug).name);
</script>
