<template>
    <view class="archive-section px-4 py-4">
        <view class="mb-3 flex items-center justify-between gap-2">
            <text class="text-base font-black tracking-[-0.02em] text-[#24262b]">{{ title }}</text>
            <text class="text-[10px] font-black tracking-[0.14em] text-[#8d929c]">USAGE</text>
        </view>

        <view v-if="rows.length" class="grid gap-3">
            <view v-for="(row, i) in rows" :key="i" class="flex items-center gap-2.5">
                <!-- 道具行：对战自带明文图标（内部 404 回落 bag glyph） -->
                <BattleItemIcon v-if="kind === 'item' && row.iconName" :name="row.iconName" />
                <!-- 道具无明文图标时回落 bag 磁贴；特性/性格无专属图标，不展示重复磁贴 -->
                <view v-else-if="kind === 'item'" class="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[10px]" :class="glyph.tile">
                    <!-- #ifdef MP-WEIXIN -->
                    <text class="ic text-[16px] text-white">{{ iconGlyph('bag') }}</text>
                    <!-- #endif -->
                    <!-- #ifndef MP-WEIXIN -->
                    <svg data-ic="bag" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4 text-white">
                        <path d="M6 7h12l1 13H5L6 7z"></path><path d="M9 7a3 3 0 0 1 6 0"></path>
                    </svg>
                    <!-- #endif -->
                </view>

                <!-- 招式：名称 / 属性徽章 / 分类 排成一排，垂直居中；h-8 保留原 tile 撑开的行高 -->
                <view v-if="kind === 'move'" class="flex h-8 min-w-0 flex-1 items-center gap-2">
                    <text class="min-w-0 truncate text-[13px] font-bold leading-8 text-[#24262b]">{{ row.name }}</text>
                    <TypeBadge v-if="row.typeSlug" :type="row.typeSlug" size="sm" variant="pill" />
                    <text v-if="row.category" class="flex-shrink-0 text-[10px] font-bold leading-8 text-[#9aa0ab]">{{ row.category }}</text>
                </view>

                <!-- 其它分区：名称在上，detail 在下；min-h-8 保持道具磁贴行的行高 -->
                <view v-else class="flex min-h-8 min-w-0 flex-1 flex-col justify-center">
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
import { glyph as iconGlyph } from '@/components/icon/glyphs';
import BattleItemIcon from '@/components/meta/BattleItemIcon.vue';
import TypeBadge from '@/components/pokemon/TypeBadge.vue';
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
