<template>
    <view class="result-card">
        <view class="flex items-center justify-between">
            <text class="result-card__label">预计伤害</text>
            <text class="result-card__value">{{ result ? `${result.minDamage} — ${result.maxDamage}` : '—' }}</text>
        </view>
        <view v-if="result" class="result-card__bar-wrap">
            <view class="result-card__bar">
                <view class="result-card__bar-fill" :style="{ width: `${Math.min(result.percentHP, 100)}%` }"></view>
            </view>
            <text class="result-card__bar-text">{{ result.percentHP }}%</text>
        </view>
        <view v-if="result" class="result-card__meta">
            <text class="result-card__meta-item" :class="result.typeEffectiveness > 1 ? 'text-[#e74c3c]' : 'text-[#9da2ad]'">
                {{ result.effectivenessLabel ?? '克制 —' }}
            </text>
            <text class="result-card__meta-item font-black" :class="result.hkoLabel === 'OHKO' ? 'text-[#e74c3c]' : 'text-[#9da2ad]'">
                {{ result.hkoLabel ?? '击杀 —' }}
            </text>
        </view>
    </view>
</template>

<script lang="ts" setup>
import type { CalcResult } from '@/pages/calc/calc-engine';

defineProps<{
    result: CalcResult | null;
}>();
</script>

<style lang="scss" scoped>
.result-card {
    border: 1px solid #e5e7ee;
    border-radius: 20px;
    background: #ffffff;
    box-shadow: 0 10px 24px rgba(48, 55, 72, 0.06);
    padding: 14px;
}

.result-card__label {
    font-size: 12px;
    font-weight: 800;
    color: #8d929c;
    letter-spacing: 0.08em;
}

.result-card__value {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 26px;
    font-weight: 900;
    color: #24262b;
    letter-spacing: -0.04em;
}

.result-card__bar-wrap {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 10px;
}

.result-card__bar {
    flex: 1;
    height: 8px;
    border-radius: 999px;
    background: #e5e7ee;
    overflow: hidden;
}

.result-card__bar-fill {
    height: 100%;
    border-radius: inherit;
    background: linear-gradient(90deg, #73b7ff, #357df4);
    transition: width 0.3s ease;
}

.result-card__bar-text {
    font-size: 12px;
    font-weight: 800;
    font-family: ui-monospace;
    color: #6f7682;
    min-width: 36px;
    text-align: right;
}

.result-card__meta {
    display: flex;
    gap: 14px;
    margin-top: 8px;
}

.result-card__meta-item {
    font-size: 12px;
    font-weight: 700;
    color: #6f7682;
}
</style>