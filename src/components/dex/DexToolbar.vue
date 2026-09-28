<template>
    <view class="px-3 pt-2 sm:px-5 sm:pt-3">
        <view class="mx-auto max-w-[1400px] overflow-hidden rounded-[24px] border border-[#e5e7ee] bg-white p-2.5 shadow-[0_14px_34px_rgba(48,55,72,0.08)] sm:rounded-[28px] sm:p-3">
            <view class="flex items-center gap-2 sm:gap-3">
                <view class="min-w-0 flex-1">
                    <SearchBar
                        :model-value="search"
                        :placeholder="t('dex.searchPlaceholder')"
                        @update:model-value="emit('update:search', $event)"
                    />
                </view>

                <button
                    class="icon-tool-button icon-tool-button--favorite panel-button"
                    :class="favoritesActive ? 'icon-tool-button--favorite-active' : ''"
                    @click="emit('toggle-favorites')"
                >
                    <!-- #ifdef MP-WEIXIN -->
                    <text class="ic text-[21px]">{{ glyph(favoritesActive ? 'star-fill' : 'star') }}</text>
                    <!-- #endif -->
                    <!-- #ifndef MP-WEIXIN -->
                    <svg viewBox="0 0 24 24" :fill="favoritesActive ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="icon-tool-button__svg icon-tool-button__svg--star">
                        <polygon points="12 2.8 14.9 8.7 21.4 9.65 16.7 14.25 17.8 20.75 12 17.68 6.2 20.75 7.3 14.25 2.6 9.65 9.1 8.7 12 2.8"></polygon>
                    </svg>
                    <!-- #endif -->
                </button>

                <button class="icon-tool-button panel-button" @click="emit('update:collapsed', !collapsed)">
                    <!-- #ifdef MP-WEIXIN -->
                    <text v-if="collapsed" class="ic text-[20px]">{{ glyph('chevron-down') }}</text>
                    <text v-else class="ic text-[20px]">{{ glyph('chevron-up') }}</text>
                    <!-- #endif -->
                    <!-- #ifndef MP-WEIXIN -->
                    <svg v-if="collapsed" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" data-ic="chevron-down" class="icon-tool-button__svg icon-tool-button__svg--arrow">
                        <path d="m6 9 6 6 6-6"></path>
                    </svg>
                    <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" data-ic="chevron-up" class="icon-tool-button__svg icon-tool-button__svg--arrow">
                        <path d="m6 15 6-6 6 6"></path>
                    </svg>
                    <!-- #endif -->
                </button>
            </view>

            <view v-if="!collapsed" class="mt-2 grid grid-cols-[1fr_1fr_1.18fr] gap-2 sm:mt-3 sm:grid-cols-[140px_140px_180px]">
                <view class="stat-tile">
                    <text class="stat-tile__label">{{ t('dex.sampleCount') }}</text>
                    <text class="stat-tile__value">{{ sampleCount }}</text>
                </view>
                <view class="stat-tile">
                    <text class="stat-tile__label">{{ t('dex.favoriteCount') }}</text>
                    <text class="stat-tile__value">{{ favoriteCount }}</text>
                </view>
                <view class="filter-stack">
                    <button
                        class="filter-stack__button"
                        :class="generationPanelOpen ? 'filter-stack__button--active-green' : ''"
                        @click="emit('toggle-generation')"
                    >
                        <!-- #ifdef MP-WEIXIN -->
                        <text class="ic text-[14px]">{{ glyph('clock') }}</text>
                        <!-- #endif -->
                        <!-- #ifndef MP-WEIXIN -->
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" data-ic="clock" class="filter-stack__icon">
                            <circle cx="12" cy="12" r="9"></circle>
                            <path d="M12 7v5l3.2 2"></path>
                        </svg>
                        <!-- #endif -->
                        <text class="filter-stack__text">{{ generationLabel }}</text>
                        <view v-if="generationActive" class="pill-dot"></view>
                    </button>

                    <button
                        class="filter-stack__button"
                        :class="typeFilterOpen ? 'filter-stack__button--active-red' : ''"
                        @click="emit('toggle-type-filter')"
                    >
                        <!-- #ifdef MP-WEIXIN -->
                        <text class="ic text-[14px]">{{ glyph('filter') }}</text>
                        <!-- #endif -->
                        <!-- #ifndef MP-WEIXIN -->
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" data-ic="filter" class="filter-stack__icon">
                            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
                        </svg>
                        <!-- #endif -->
                        <text class="filter-stack__text">{{ t('dex.typeFilter') }}</text>
                        <view v-if="typeFilterActive" class="pill-dot"></view>
                    </button>
                </view>
            </view>
        </view>
    </view>
</template>

<script lang="ts" setup>
import { glyph } from '@/components/icon/glyphs';
import { useI18n } from 'vue-i18n';
import SearchBar from '@/components/shared/SearchBar.vue';
const { t } = useI18n();

interface Props {
    /** 搜索词（v-model:search） */
    search: string;
    /** 统计区是否收起（v-model:collapsed） */
    collapsed: boolean;
    /** 仅看收藏是否开启 */
    favoritesActive: boolean;
    /** 世代抽屉是否展开 */
    generationPanelOpen: boolean;
    /** 是否已选中某个世代（显示小圆点） */
    generationActive: boolean;
    /** 世代按钮文案 */
    generationLabel: string;
    /** 属性筛选面板是否展开 */
    typeFilterOpen: boolean;
    /** 是否已勾选属性（显示小圆点） */
    typeFilterActive: boolean;
    sampleCount: number;
    favoriteCount: number;
}

defineProps<Props>();

const emit = defineEmits<{
    'update:search': [value: string];
    'update:collapsed': [value: boolean];
    'toggle-favorites': [];
    'toggle-generation': [];
    'toggle-type-filter': [];
}>();

</script>

<style lang="scss" scoped>
.stat-tile {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 12px;
    border: 1px solid #e5e7ee;
    border-radius: 22px;
    background: #f5f6fa;
    box-shadow: inset 0 1px 0 #ffffff, 0 10px 24px rgba(48, 55, 72, 0.06);
}

.stat-tile__label {
    font-size: 10px;
    font-weight: 900;
    letter-spacing: 0.14em;
    color: #9da2ad;
}

.stat-tile__value {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 24px;
    font-weight: 900;
    line-height: 1;
    color: #24262b;
}

.filter-stack {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 0;
}

.filter-stack__button {
    position: relative;
    display: flex;
    align-items: center;
    gap: 7px;
    min-width: 0;
    height: 37px;
    padding: 0 10px;
    border: 1px solid #e1e4eb;
    border-radius: 18px;
    color: #6f7480;
    font-size: 11px;
    font-weight: 900;
    background: #f5f6fa;
    box-shadow: inset 0 1px 0 #ffffff, 0 8px 16px rgba(48, 55, 72, 0.06);
    transition: transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
}

.filter-stack__button:active {
    transform: scale(0.96);
}

.filter-stack__button--active-green {
    color: #fff;
    background: linear-gradient(135deg, #34b85a, #178f42);
    box-shadow: 0 10px 20px rgba(52, 184, 90, 0.18);
}

.filter-stack__button--active-red {
    color: #fff;
    background: linear-gradient(135deg, #ff8a76, #f05245);
    box-shadow: 0 10px 20px rgba(240, 82, 69, 0.18);
}

.filter-stack__icon {
    flex-shrink: 0;
    width: 14px;
    height: 14px;
}

.filter-stack__text {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.icon-tool-button {
    position: relative;
    display: inline-flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 40px;
    padding: 0;
    margin: 0;
    color: #6f7480;
    line-height: 1;
    background: transparent;
    border: 0;
    transition: transform 0.2s ease, color 0.2s ease;
}

.icon-tool-button:active {
    transform: scale(0.9);
}

.icon-tool-button__svg {
    display: block;
    flex-shrink: 0;
    color: currentColor;
}

.icon-tool-button__svg--star {
    width: 21px;
    height: 21px;
}

.icon-tool-button__svg--arrow {
    width: 20px;
    height: 20px;
}

.icon-tool-button--favorite-active {
    color: #e04f47;
}

.panel-button::after {
    border: none !important;
}

.pill-dot {
    width: 7px;
    height: 7px;
    border-radius: 999px;
    background: currentColor;
    box-shadow: 0 0 0 4px rgba(255, 255, 255, 0.55);
}
</style>
