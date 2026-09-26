<template>
    <view class="archive-section px-4 py-4">
        <view class="mb-3 flex items-center justify-between gap-2">
            <text class="text-base font-black tracking-[-0.02em] text-[#24262b]">{{ title }}</text>
            <text class="text-[10px] font-black tracking-[0.14em] text-[#8d929c]">USAGE</text>
        </view>

        <view v-if="rows.length" class="grid gap-3">
            <view v-for="row in rows" :key="row.key" class="flex items-center gap-2.5">
                <!-- 道具：加密道具图标 -->
                <ItemIcon v-if="iconKind === 'item'" :id="row.key" />
                <!-- 招式：属性贴纸图标 -->
                <TypeBadgeIcon v-else-if="iconKind === 'move'" :type="row.typeSlug ?? 'normal'" size="s" />
                <!-- 特性：中性盒 + spark glyph -->
                <view v-else class="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-[#9a86f4] to-[#4b32a6]">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="h-3 w-3 text-white">
                        <path d="m12 2 2.6 6.5L21 11l-6.4 2.5L12 20l-2.6-6.5L3 11l6.4-2.5L12 2z"></path>
                    </svg>
                </view>

                <text class="min-w-0 flex-1 truncate text-[13px] font-bold text-[#24262b]">{{ row.name }}</text>

                <view class="rate-bar h-1.5 w-20 overflow-hidden rounded-full bg-[#eef0f5]">
                    <view class="h-full rounded-full bg-gradient-to-r from-[#73b7ff] to-[#357df4]" :style="{ width: `${row.barWidth}%` }"></view>
                </view>

                <text class="w-11 flex-shrink-0 text-right font-mono text-[12px] font-extrabold tabular-nums text-[#24262b]">{{ row.rate }}%</text>
            </view>
        </view>

        <text v-else class="block py-2 text-center text-xs font-bold text-[#b6bac3]">{{ t('meta.pokemonEmpty') }}</text>
    </view>
</template>

<script lang="ts" setup>
import { useI18n } from 'vue-i18n';
import ItemIcon from '@/components/archive/ItemIcon.vue';
import TypeBadgeIcon from '@/components/pokemon/TypeBadgeIcon.vue';
import type { MetaRateRowVM } from '@/services/meta';

defineProps<{
    title: string;
    iconKind: 'ability' | 'item' | 'move';
    rows: MetaRateRowVM[];
}>();

const { t } = useI18n();
</script>
