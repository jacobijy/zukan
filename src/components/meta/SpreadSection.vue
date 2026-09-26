<template>
    <view class="archive-section px-4 py-4">
        <view class="mb-3 flex items-center justify-between gap-2">
            <text class="text-base font-black tracking-[-0.02em] text-[#24262b]">{{ title }}</text>
            <text class="text-[10px] font-black tracking-[0.14em] text-[#8d929c]">SPREAD</text>
        </view>

        <view v-if="rows.length" class="grid gap-3">
            <view v-for="(row, i) in rows" :key="i" class="flex items-center gap-2.5">
                <text class="w-36 flex-shrink-0 font-mono text-[12px] font-extrabold tabular-nums text-[#4a5060]">{{ formatSpread(row) }}</text>

                <view class="h-1.5 flex-1 overflow-hidden rounded-full bg-[#eef0f5]">
                    <view class="h-full rounded-full bg-gradient-to-r from-[#f5a05c] to-[#e07a2a]" :style="{ width: `${row.barWidth}%` }"></view>
                </view>

                <text class="w-11 flex-shrink-0 text-right font-mono text-[12px] font-extrabold tabular-nums text-[#24262b]">{{ row.pct }}%</text>
            </view>
        </view>

        <text v-else class="block py-2 text-center text-xs font-bold text-[#b6bac3]">{{ t('meta.pokemonEmpty') }}</text>
    </view>
</template>

<script lang="ts" setup>
import { useI18n } from 'vue-i18n';
import type { SpreadRowVM } from '@/services/meta';

defineProps<{
    title: string;
    rows: SpreadRowVM[];
}>();

const { t } = useI18n();

// 紧凑 SP 读数：省略 0 值，如 `HP1 ATK32 SPE32`；全 0 记为 BALANCED
function formatSpread(r: SpreadRowVM): string {
    const parts: Array<[string, number]> = [
        ['HP', r.hp], ['ATK', r.atk], ['DEF', r.def],
        ['SPA', r.spa], ['SPD', r.spd], ['SPE', r.spe],
    ];
    const text = parts.filter(([, v]) => v > 0).map(([k, v]) => `${k}${v}`).join(' ');
    return text || 'BALANCED';
}
</script>
