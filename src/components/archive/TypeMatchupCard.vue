<template>
    <view class="glass-panel px-5 py-4">
        <!-- 攻击视角：该属性招式打各防御属性 -->
        <text class="section-label block !px-0 !pb-2">{{ t('archive.matchupAttack') }}</text>
        <view v-for="g in attackGroups" :key="`a-${g.key}`" class="flex items-start gap-2 py-1">
            <text class="mt-0.5 w-14 flex-shrink-0 text-[11px] font-black tracking-[0.08em]" :class="toneClass[g.tone]">{{ g.label }}</text>
            <view class="flex flex-1 flex-wrap gap-1.5">
                <TypeBadge v-for="slug in g.slugs" :key="slug" :type="slug" size="sm" variant="pill" />
                <text v-if="g.slugs.length === 0" class="text-[12px] font-bold text-[#b4b8c0]">—</text>
            </view>
        </view>

        <view class="my-3 h-px bg-[#eef0f5]"></view>

        <!-- 防御视角：该属性宝可梦受到各攻击属性 -->
        <text class="section-label block !px-0 !pb-2">{{ t('archive.matchupDefense') }}</text>
        <view v-for="g in defenseGroups" :key="`d-${g.key}`" class="flex items-start gap-2 py-1">
            <text class="mt-0.5 w-14 flex-shrink-0 text-[11px] font-black tracking-[0.08em]" :class="toneClass[g.tone]">{{ g.label }}</text>
            <view class="flex flex-1 flex-wrap gap-1.5">
                <TypeBadge v-for="slug in g.slugs" :key="slug" :type="slug" size="sm" variant="pill" />
                <text v-if="g.slugs.length === 0" class="text-[12px] font-bold text-[#b4b8c0]">—</text>
            </view>
        </view>
    </view>
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import TypeBadge from '@/components/pokemon/TypeBadge.vue';
import { attackMatchups, defenseMatchups } from '@/services/pokemon/typeMatchup';

const props = defineProps<{
    /** 属性 slug：'fire' / 'water' / ... */
    type: string;
}>();

const { t } = useI18n();

const attack = computed(() => attackMatchups(props.type));
const defense = computed(() => defenseMatchups(props.type));

const toneClass = {
    weak: 'text-[#e0532c]',
    resist: 'text-[#357df4]',
    immune: 'text-[#8d929c]',
} as const;

const attackGroups = computed(() => [
    { key: 'weak', tone: 'weak' as const, label: t('archive.matchupWeakTo'), slugs: attack.value.weak },
    { key: 'resist', tone: 'resist' as const, label: t('archive.matchupResist'), slugs: attack.value.resist },
    { key: 'immune', tone: 'immune' as const, label: t('archive.matchupImmune'), slugs: attack.value.immune },
]);

const defenseGroups = computed(() => [
    { key: 'weak', tone: 'weak' as const, label: t('archive.matchupWeakFrom'), slugs: defense.value.weak },
    { key: 'resist', tone: 'resist' as const, label: t('archive.matchupResistFrom'), slugs: defense.value.resist },
    { key: 'immune', tone: 'immune' as const, label: t('archive.matchupImmuneFrom'), slugs: defense.value.immune },
]);
</script>
