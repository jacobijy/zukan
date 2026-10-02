<template>
    <view class="archive-row" @click="emit('select')">
        <!-- 徽章本身即「底色 + 属性名」，不再另出名称文字 -->
        <TypeBadge :type="slug" size="xl" variant="pill" />
        <view class="archive-row__main"></view>
        <text class="archive-row__meta">{{ interp('archive.pokemonCount', { n: count }) }}</text>
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
import { useI18n } from 'vue-i18n';
import { interp } from '@/services/i18n/ui-i18n';
import TypeBadge from '@/components/pokemon/TypeBadge.vue';

defineProps<{
    /** 属性 slug：'fire' / 'water' / ... */
    slug: string;
    count: number;
}>();

const emit = defineEmits<{ select: [] }>();

const { t } = useI18n();
</script>
