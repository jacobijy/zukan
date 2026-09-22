<template>
    <view class="result-card">
        <view class="flex items-center justify-between">
            <text class="result-card__label">{{ t('calc.result.damage') }}</text>
            <text class="result-card__value">{{ result ? `${result.minDamage} — ${result.maxDamage}` : '—' }}</text>
        </view>
        <view v-if="result" class="result-card__bar-wrap">
            <view class="result-card__bar">
                <!-- 浮动段：左缘=最小伤害%，宽度=区间宽（点段兜底 2% 保证可见） -->
                <view
                    class="result-card__bar-range"
                    :style="{ left: `${result.minPercent}%`, width: `${barWidth}%` }"
                ></view>
            </view>
            <text class="result-card__bar-text">{{ result.minPercent }}–{{ result.maxPercent }}%</text>
        </view>

        <view v-if="result" class="result-card__meta">
            <text
                class="result-card__meta-item"
                :class="result.typeEffectiveness > 1 ? 'text-[#e74c3c]' : 'text-[#9da2ad]'"
            >
                {{ result.effectivenessLabel ?? t('calc.result.effectivenessFallback') }}
            </text>
            <text
                class="result-card__meta-item font-black"
                :class="result.hkoLabel === 'OHKO' ? 'text-[#e74c3c]' : 'text-[#9da2ad]'"
            >
                {{ result.hkoLabel ?? t('calc.result.killFallback') }}
            </text>
        </view>

        <!-- 击杀概率：一击 / 两击 -->
        <view v-if="result" class="result-card__ko">
            <view class="result-card__ko-item">
                <text class="result-card__ko-label">{{ t('calc.result.ohko') }}</text>
                <text class="result-card__ko-val" :class="result.ohkoPercent > 0 ? 'text-[#e74c3c]' : ''">
                    {{ result.ohkoPercent }}%
                </text>
            </view>
            <view class="result-card__ko-item">
                <text class="result-card__ko-label">{{ t('calc.result.twohko') }}</text>
                <text class="result-card__ko-val" :class="result.twoHitPercent > 0 ? 'text-[#e74c3c]' : ''">
                    {{ result.twoHitPercent }}%
                </text>
            </view>
        </view>
    </view>
</template>

<script lang="ts" setup>
import { useI18n } from 'vue-i18n';
import type { CalcResult } from '@/pages/calc/calc-engine';
import { computed } from 'vue';

const { t } = useI18n();

const props = defineProps<{
    result: CalcResult | null;
}>();

// 区间条宽度：max-min，至少 2%（min=max 的点段也要可见）；无伤害时为 0
const barWidth = computed(() => {
    const r = props.result;
    if (!r || r.maxPercent === 0) return 0;
    return Math.max(r.maxPercent - r.minPercent, 2);
});
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
    color: #9da2ad;
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
    position: relative;
    flex: 1;
    height: 8px;
    border-radius: 999px;
    background: #eef0f5;
    overflow: hidden;
}

/* 浮动区间段：渐变蓝，相对轨道定位 */
.result-card__bar-range {
    position: absolute;
    top: 0;
    bottom: 0;
    border-radius: 999px;
    background: linear-gradient(90deg, #73b7ff, #357df4);
}

.result-card__bar-text {
    font-size: 12px;
    font-weight: 800;
    font-family: ui-monospace;
    color: #6f7682;
    min-width: 52px;
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

/* 击杀概率行：两块等宽小卡 */
.result-card__ko {
    display: flex;
    gap: 10px;
    margin-top: 10px;
}

.result-card__ko-item {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    background: #f7f8fc;
    border: 1px solid #eceef4;
    border-radius: 12px;
}

.result-card__ko-label {
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.06em;
    color: #9da2ad;
}

.result-card__ko-val {
    font-size: 15px;
    font-weight: 900;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    color: #9da2ad;
}
</style>
