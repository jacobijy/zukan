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

<style lang="scss" scoped>
.calc-card {
    border: 1px solid #e5e7ee;
    border-radius: 20px;
    background: #ffffff;
    box-shadow: 0 10px 24px rgba(48, 55, 72, 0.06);
    overflow: hidden;
}

.calc-head {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;
    border-bottom: 1px solid #eef0f5;
    background: #fafbfd;
}

.calc-head__icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    border-radius: 8px;
    color: #ffffff;
}

.calc-head__icon--green {
    background: linear-gradient(135deg, #68cc67, #34b85a);
}

.calc-head__icon--blue {
    background: linear-gradient(135deg, #73b7ff, #357df4);
}

.calc-head__title {
    font-size: 13px;
    font-weight: 800;
    letter-spacing: 0.04em;
    color: #3b3f48;
}

.calc-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    min-height: 44px;
    padding: 10px 14px;
}

.calc-row__title {
    font-size: 14px;
    font-weight: 600;
    color: #24262b;
    flex-shrink: 0;
}

.calc-row__main {
    display: flex;
    flex-direction: column;
    gap: 1px;
    min-width: 0;
    flex: 1;
}

.calc-pkm-name {
    font-size: 15px;
    font-weight: 800;
    color: #24262b;
}

/* 等级步进器 */
.calc-stepper {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
}

.calc-stepper__btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    border-radius: 8px;
    border: 1px solid #e1e4eb;
    background: #f5f6fa;
    color: #6f7682;
    font-size: 15px;
    font-weight: 700;
}

.calc-stepper__value--wrap {
    display: flex;
    flex-direction: column;
    align-items: center;
    min-width: 32px;
    gap: 0;
}

.calc-stepper__label {
    font-size: 9px;
    font-weight: 700;
    color: #9da2ad;
    line-height: 1;
}

.calc-stepper__value {
    min-width: 26px;
    text-align: center;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 14px;
    font-weight: 800;
    color: #24262b;
}

/* 能力值行 */
.calc-stats-row {
    display: flex;
    gap: 2px;
    padding: 6px 12px 8px;
    border-top: 1px solid #f1f2f6;
}

.calc-stats-row--empty {
    justify-content: center;
    min-height: 36px;
    align-items: center;
    padding: 6px 14px;
}

.calc-stat-item {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
}

.calc-stat-label {
    font-size: 10px;
    font-weight: 700;
    color: #9da2ad;
}

.calc-stat-value {
    font-size: 13px;
    font-weight: 800;
    color: #24262b;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

/* 特性 + 能力等级行 */
.calc-row-line {
    display: flex;
    align-items: center;
    padding: 8px 14px;
    border-top: 1px solid #f1f2f6;
    gap: 0;
}

.calc-inline-item {
    display: flex;
    align-items: center;
    gap: 6px;
    flex: 1;
    min-width: 0;
    justify-content: center;
}

.calc-inline-divider {
    width: 1px;
    height: 20px;
    background: #eef0f5;
    flex-shrink: 0;
}

.calc-inline-label {
    font-size: 11px;
    font-weight: 700;
    color: #9da2ad;
    flex-shrink: 0;
}

.calc-inline-value {
    font-size: 12px;
    font-weight: 700;
    color: #9da2ad;
}

.calc-inline-value--set {
    color: #357df4;
}

/* 能力等级小步进器 */
.calc-stage-mini {
    display: flex;
    align-items: center;
    gap: 4px;
}

.calc-stage-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border-radius: 6px;
    border: 1px solid #e1e4eb;
    background: #f5f6fa;
    color: #6f7682;
    font-size: 14px;
    font-weight: 700;
}

.calc-stage-val {
    min-width: 24px;
    text-align: center;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 13px;
    font-weight: 800;
    color: #24262b;
}
</style>