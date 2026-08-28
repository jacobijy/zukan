<template>
    <view class="archive-row" @click="emit('select')">
        <view class="archive-row__main">
            <text class="archive-row__title">{{ name }}</text>
            <view class="archive-row__sub">
                <TypeBadge :type="typeSlug" size="sm" variant="pill" />
                <text class="text-[11px] font-bold text-[#8d929c]">{{ categoryName }}</text>
            </view>
        </view>
        <text class="archive-row__meta">{{ powerText }}</text>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" class="archive-row__chevron">
            <path d="m9 18 6-6-6-6"></path>
        </svg>
    </view>
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import TypeBadge from '@/components/pokemon/TypeBadge.vue';
import { useI18nStore } from '@/store/i18n';
import { typeStrs } from '@/utils/helpers';
import type { MoveListRow } from '@/services/pokemon/archive';

const props = defineProps<{
    move: MoveListRow;
}>();

const emit = defineEmits<{ select: [] }>();

const i18nStore = useI18nStore();

const name = computed(() => i18nStore.moveName(props.move.id) ?? `move-${props.move.id}`);
const typeSlug = computed(() => typeStrs[props.move.typeId] ?? 'normal');
const categoryName = computed(
    () => (props.move.damageClassId && i18nStore.moveDamageClassName(props.move.damageClassId)) || '—',
);
// meta 列：威力数值（状态招为 0 → '—'，分类行已标「状态」）
const powerText = computed(() => (props.move.power > 0 ? String(props.move.power) : '—'));
</script>
