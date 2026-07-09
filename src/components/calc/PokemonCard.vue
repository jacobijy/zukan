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
                <text class="calc-row__title">宝可梦</text>
                <view class="flex items-center gap-2 mt-1">
                    <text class="calc-pkm-name">{{ pokemon?.name ?? placeholderText }}</text>
                    <view v-if="pokemon" class="flex gap-1">
                        <text v-for="t in pokemon.types" :key="t" class="calc-type-badge" :style="{ background: getTypeColor(t) }">{{ getTypeLabel(t) }}</text>
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
            <text class="text-[#9da2ad] text-[12px] font-semibold">选择宝可梦后显示能力值</text>
        </view>

        <!-- 特性 + 能力等级 -->
        <view class="calc-row-line">
            <view class="calc-inline-item" @click="$emit('select-ability')">
                <text class="calc-inline-label">特性</text>
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
import { calcStat } from '@/pages/calc/calc-engine';
import { getTypeColor, getTypeLabel } from '@/utils/helpers';

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


/** 从 stats 数组中取某个属性的种族值 */
const getBaseStat = (stats: { name: string; value: number }[], key: string): number => {
    const m: Record<string, string> = { HP: 'HP', 攻击: 'atk', 防御: 'def', 特攻: 'spa', 特防: 'spd', 速度: 'spe' };
    const target = m[key];
    const found = stats.find(s => {
        const sKey = s.name === 'HP' || s.name.includes('HP') ? 'HP' :
            s.name === '攻击' ? 'atk' : s.name === '防御' ? 'def' :
            s.name === '特攻' ? 'spa' : s.name === '特防' ? 'spd' :
            s.name === '速度' ? 'spe' : '';
        return sKey === target;
    });
    return found?.value ?? 50;
};

const statsList = computed(() => {
    if (!props.pokemon) return [];
    const labels = ['HP', '攻击', '防御', '特攻', '特防', '速度'];
    const keys = ['HP', 'atk', 'def', 'spa', 'spd', 'spe'];
    return labels.map((label, i) => ({
        label,
        value: calcStat(getBaseStat(props.pokemon!.stats, keys[i]), props.level, i === 0),
    }));
});
</script>