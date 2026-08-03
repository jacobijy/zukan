<template>
    <view class="px-3 pt-2 sm:px-5 sm:pt-3">
        <view class="mx-auto max-w-[1400px] overflow-hidden rounded-[24px] border border-[#e5e7ee] bg-white p-2.5 shadow-[0_14px_34px_rgba(48,55,72,0.08)] sm:rounded-[28px] sm:p-3">
            <view class="flex items-center gap-2 sm:gap-3">
                <view class="relative h-10 min-w-0 flex-1 sm:h-11">
                    <input
                        type="text"
                        placeholder="搜索名称、编号或属性..."
                        class="h-10 w-full rounded-[20px] border border-[#e1e4eb] bg-[#f5f6fa] pl-10 pr-9 text-sm font-semibold text-[#24262b] shadow-[inset_0_1px_0_#ffffff] outline-none placeholder:text-[#9da2ad] focus:border-[#357df4] focus:bg-white focus:shadow-[0_0_0_4px_rgba(53,125,244,0.12)] sm:h-11 sm:rounded-[22px] sm:pl-11 sm:pr-10"
                        :value="search"
                        @input="onSearchInput"
                    />
                    <view class="absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[#8d929c] sm:left-4 sm:h-5 sm:w-5">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="h-full w-full">
                            <circle cx="11" cy="11" r="8"></circle>
                            <path d="m21 21-4.35-4.35"></path>
                        </svg>
                    </view>
                    <view v-if="search" class="absolute right-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 cursor-pointer text-[#90997f] sm:right-4 sm:h-5 sm:w-5" @click="clearSearch">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="h-full w-full">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </view>
                </view>

                <button
                    class="icon-tool-button icon-tool-button--favorite panel-button"
                    :class="favoritesActive ? 'icon-tool-button--favorite-active' : ''"
                    @click="emit('toggle-favorites')"
                >
                    <svg viewBox="0 0 24 24" :fill="favoritesActive ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="icon-tool-button__svg icon-tool-button__svg--star">
                        <polygon points="12 2.8 14.9 8.7 21.4 9.65 16.7 14.25 17.8 20.75 12 17.68 6.2 20.75 7.3 14.25 2.6 9.65 9.1 8.7 12 2.8"></polygon>
                    </svg>
                </button>

                <button class="icon-tool-button panel-button" @click="emit('update:collapsed', !collapsed)">
                    <svg v-if="collapsed" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" class="icon-tool-button__svg icon-tool-button__svg--arrow">
                        <path d="M7 10.5 12 15.5 17 10.5"></path>
                    </svg>
                    <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" class="icon-tool-button__svg icon-tool-button__svg--arrow">
                        <path d="M7 13.5 12 8.5 17 13.5"></path>
                    </svg>
                </button>
            </view>

            <view v-if="!collapsed" class="mt-2 grid grid-cols-[1fr_1fr_1.18fr] gap-2 sm:mt-3 sm:grid-cols-[140px_140px_180px]">
                <view class="stat-tile">
                    <text class="stat-tile__label">当前样本</text>
                    <text class="stat-tile__value">{{ sampleCount }}</text>
                </view>
                <view class="stat-tile">
                    <text class="stat-tile__label">已收藏</text>
                    <text class="stat-tile__value">{{ favoriteCount }}</text>
                </view>
                <view class="filter-stack">
                    <button
                        class="filter-stack__button"
                        :class="generationPanelOpen ? 'filter-stack__button--active-green' : ''"
                        @click="emit('toggle-generation')"
                    >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" class="filter-stack__icon">
                            <circle cx="12" cy="12" r="10"></circle>
                            <polyline points="12 6 12 12 16 14"></polyline>
                        </svg>
                        <text class="filter-stack__text">{{ generationLabel }}</text>
                        <view v-if="generationActive" class="pill-dot"></view>
                    </button>

                    <button
                        class="filter-stack__button"
                        :class="typeFilterOpen ? 'filter-stack__button--active-red' : ''"
                        @click="emit('toggle-type-filter')"
                    >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" class="filter-stack__icon">
                            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
                        </svg>
                        <text class="filter-stack__text">属性筛选</text>
                        <view v-if="typeFilterActive" class="pill-dot"></view>
                    </button>
                </view>
            </view>
        </view>
    </view>
</template>

<script lang="ts" setup>
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

const onSearchInput = (e: any) => {
    emit('update:search', e.detail?.value ?? e.target?.value ?? '');
};

const clearSearch = () => emit('update:search', '');
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
