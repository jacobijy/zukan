<template>
    <view class="archive-row" @click="emit('select')">
        <view class="archive-row__main">
            <text class="archive-row__title">{{ name }}</text>
        </view>
        <text v-if="count > 0" class="archive-row__meta">{{ t('archive.pokemonCount', { n: count }) }}</text>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" class="archive-row__chevron">
            <path d="m9 18 6-6-6-6"></path>
        </svg>
    </view>
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useI18nStore } from '@/store/i18n';

const props = withDefaults(
    defineProps<{
        abilityId: number;
        /** 拥有该特性的宝可梦数；0 不显示 */
        count?: number;
    }>(),
    { count: 0 },
);

const emit = defineEmits<{ select: [] }>();

const { t } = useI18n();
const i18nStore = useI18nStore();

const name = computed(() => i18nStore.abilityName(props.abilityId) ?? `ability-${props.abilityId}`);
</script>
