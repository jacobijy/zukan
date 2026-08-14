<template>
    <view class="calc-card">
        <view class="calc-head">
            <view class="calc-head__icon" :class="iconClass">
                <slot name="icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4">
                        <circle cx="12" cy="12" r="8"></circle><circle cx="12" cy="12" r="3"></circle>
                        <path d="M12 4v3M12 17v3M4 12h3M17 12h3"></path>
                    </svg>
                </slot>
            </view>
            <text class="calc-head__title">{{ title }}</text>
        </view>

        <!-- 宝可梦 + 等级 -->
        <view class="calc-row" @click="$emit('select-pokemon')">
            <view class="calc-row__main">
                <text class="calc-row__title">{{ t('calc.side.pokemon') }}</text>
                <view class="flex items-center gap-2 mt-1">
                    <text class="calc-pkm-name">{{ pokemon?.name ?? placeholderText }}</text>
                    <view v-if="pokemon" class="flex gap-1">
                        <TypeBadge v-for="t in pokemon.types" :key="t" :type="t" size="sm" variant="chip" />
                    </view>
                </view>
            </view>
            <view class="calc-stepper">
                <view class="calc-stepper__btn" @click.stop="$emit('adjust-level', -1)">−</view>
                <view class="calc-stepper__value--wrap">
                    <text class="calc-stepper__label">Lv</text>
                    <text class="calc-stepper__value">{{ level }}</text>
                </view>
                <view class="calc-stepper__btn" @click.stop="$emit('adjust-level', 1)">+</view>
            </view>
        </view>

        <!-- 能力值 -->
        <view class="calc-stats-row" v-if="pokemon">
            <view v-for="s in statsList" :key="s.label" class="calc-stat-item">
                <text class="calc-stat-label">{{ s.label }}</text>
                <text class="calc-stat-value">{{ s.value }}</text>
            </view>
        </view>
        <view class="calc-stats-row calc-stats-row--empty" v-else>
            <text class="text-[#9da2ad] text-[12px] font-semibold">{{ t('calc.side.statsHint') }}</text>
        </view>

        <!-- 特性 + 能力等级 -->
        <view class="calc-row-line">
            <view class="calc-inline-item" @click="$emit('select-ability')">
                <text class="calc-inline-label">{{ t('calc.side.ability') }}</text>
                <text class="calc-inline-value" :class="ability !== '无' ? 'calc-inline-value--set' : ''">{{ ability }}</text>
            </view>
            <view class="calc-inline-divider"></view>
            <view class="calc-inline-item">
                <text class="calc-inline-label">{{ stage1Label }}</text>
                <view class="calc-stage-mini">
                    <view class="calc-stage-btn" @click="$emit('dec-stage1')">−</view>
                    <text class="calc-stage-val">{{ stage1Val >= 0 ? '+' : '' }}{{ stage1Val }}</text>
                    <view class="calc-stage-btn" @click="$emit('inc-stage1')">+</view>
                </view>
            </view>
            <view class="calc-inline-divider"></view>
            <view class="calc-inline-item">
                <text class="calc-inline-label">{{ stage2Label }}</text>
                <view class="calc-stage-mini">
                    <view class="calc-stage-btn" @click="$emit('dec-stage2')">−</view>
                    <text class="calc-stage-val">{{ stage2Val >= 0 ? '+' : '' }}{{ stage2Val }}</text>
                    <view class="calc-stage-btn" @click="$emit('inc-stage2')">+</view>
                </view>
            </view>
        </view>
    </view>
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { calcStat, getBaseStat } from '@/pages/calc/calc-engine';
import TypeBadge from '@/components/pokemon/TypeBadge.vue';

const { t } = useI18n();

interface PokemonData {
    name: string;
    types: string[];
    stats: { name: string; value: number }[];
}

const props = defineProps<{
    title: string;
    iconClass: string;
    placeholderText: string;
    pokemon: PokemonData | null;
    level: number;
    ability: string;
    stage1Label: string;
    stage2Label: string;
    stage1Val: number;
    stage2Val: number;
}>();

const emit = defineEmits<{
    'select-pokemon': [];
    'select-ability': [];
    'adjust-level': [delta: number];
    'dec-stage1': [];
    'inc-stage1': [];
    'dec-stage2': [];
    'inc-stage2': [];
}>();

const statsList = computed(() => {
    if (!props.pokemon) return [];
    const labels = [t('stats.hp'), t('stats.attack'), t('stats.defense'), t('stats.spAttack'), t('stats.spDefense'), t('stats.speed')];
    const keys = ['HP', 'atk', 'def', 'spa', 'spd', 'spe'];
    return labels.map((label, i) => ({
        label,
        value: calcStat(getBaseStat(props.pokemon!.stats, keys[i]), props.level, i === 0),
    }));
});
</script>