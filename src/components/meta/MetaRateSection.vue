<template>
    <view class="archive-section px-4 py-4">
        <view class="mb-3 flex items-center justify-between gap-2">
            <text class="text-base font-black tracking-[-0.02em] text-[#24262b]">{{ title }}</text>
            <text class="text-[10px] font-black tracking-[0.14em] text-[#8d929c]">USAGE</text>
        </view>

        <view v-if="rows.length" class="grid gap-3">
            <view v-for="(row, i) in rows" :key="i" class="flex items-center gap-2.5">
                <view class="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[10px]" :class="glyph.tile">
                    <!-- 特性：spark -->
                    <svg v-if="kind === 'ability'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4 text-white">
                        <path d="m12 2 2.6 6.5L21 11l-6.4 2.5L12 20l-2.6-6.5L3 11l6.4-2.5L12 2z"></path>
                    </svg>
                    <!-- 道具：bag -->
                    <svg v-else-if="kind === 'item'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4 text-white">
                        <path d="M6 7h12l1 13H5L6 7z"></path><path d="M9 7a3 3 0 0 1 6 0"></path>
                    </svg>
                    <!-- 性格：leaf -->
                    <svg v-else-if="kind === 'nature'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4 text-white">
                        <path d="M11 20A7 7 0 0 1 4 13c0-5 5-9 16-9 0 8-4 16-9 16Z"></path><path d="M4 20c4-5 8-7 11-8"></path>
                    </svg>
                    <!-- 招式：zap -->
                    <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4 text-white">
                        <polygon points="13 2.5 4 14 12 14 11 21.5 20 10 12 10 13 2.5"></polygon>
                    </svg>
                </view>

                <view class="min-w-0 flex-1">
                    <text class="block truncate text-[13px] font-bold text-[#24262b]">{{ row.name }}</text>
                    <text v-if="row.detail" class="mt-0.5 block text-[11px] font-bold text-[#9aa0ab]">{{ row.detail }}</text>
                </view>

                <view class="h-1.5 w-20 flex-shrink-0 overflow-hidden rounded-full bg-[#eef0f5]">
                    <view class="h-full rounded-full" :class="glyph.fill" :style="{ width: `${row.barWidth}%` }"></view>
                </view>

                <text class="w-11 flex-shrink-0 text-right font-mono text-[12px] font-extrabold tabular-nums text-[#24262b]">{{ row.pct }}%</text>
            </view>
        </view>

        <text v-else class="block py-2 text-center text-xs font-bold text-[#b6bac3]">{{ t('meta.pokemonEmpty') }}</text>
    </view>
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { RateRowVM } from '@/services/meta';

const props = defineProps<{
    title: string;
    kind: 'ability' | 'item' | 'move' | 'nature';
    rows: RateRowVM[];
}>();

const { t } = useI18n();

// 各类的 tile 配色与进度条配色
const glyph = computed(() => {
    switch (props.kind) {
        case 'ability':
            return { tile: 'bg-gradient-to-br from-[#9a86f4] to-[#4b32a6]', fill: 'bg-gradient-to-r from-[#a78bf5] to-[#6d44cc]' };
        case 'item':
            return { tile: 'bg-gradient-to-br from-[#f6c969] to-[#d98a23]', fill: 'bg-gradient-to-r from-[#f6c969] to-[#d98a23]' };
        case 'nature':
            return { tile: 'bg-gradient-to-br from-[#5fce7d] to-[#2f9e52]', fill: 'bg-gradient-to-r from-[#5fce7d] to-[#2f9e52]' };
        default:
            return { tile: 'bg-gradient-to-br from-[#63b0ff] to-[#2f6fe6]', fill: 'bg-gradient-to-r from-[#73b7ff] to-[#357df4]' };
    }
});
</script>
