<template>
    <view>
        <view
            class="generation-drawer fixed right-0 top-0 z-[999] h-full w-[280px] bg-white shadow-[-24px_0_60px_rgba(48,55,72,0.18)] transition-transform duration-300 ease-out"
            :class="visible ? 'translate-x-0' : 'translate-x-full'"
            :style="{ paddingTop: 'var(--status-bar-height)' }"
        >
            <view class="generation-drawer__header">
                <button
                    class="generation-back"
                    :aria-label="t('dex.drawer.back')"
                    @click="close"
                >
                    <!-- #ifdef MP-WEIXIN -->
                    <text class="ic text-[18px]" aria-hidden="true">{{ glyph('chevron-left') }}</text>
                    <!-- #endif -->
                    <!-- #ifndef MP-WEIXIN -->
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" data-ic="chevron-left" aria-hidden="true" class="h-[18px] w-[18px]">
                        <path d="m15 18-6-6 6-6"></path>
                    </svg>
                    <!-- #endif -->
                </button>
                <text class="generation-drawer__title">{{ t('dex.drawer.generationTitle') }}</text>
            </view>

            <scroll-view scroll-y class="generation-drawer__body">
                <view class="generation-list">
                    <view
                        v-for="gen in GENERATIONS"
                        :key="gen.value"
                        class="generation-item"
                        :class="selected === gen.value ? 'generation-item--active' : ''"
                        @click="select(gen.value)"
                    >
                        <view class="flex items-center gap-3">
                            <view class="generation-item__mark">
                                <text class="font-serif text-sm font-black">{{ gen.label }}</text>
                            </view>
                            <view>
                                <text class="block text-sm font-black text-[#24262b]">{{ gen.name }}</text>
                                <text class="block font-mono text-[11px] font-bold text-[#89947e]">{{ formatGenerationRange(gen) }}</text>
                            </view>
                        </view>
                        <!-- #ifdef MP-WEIXIN -->
                        <text v-if="selected === gen.value" class="ic text-[20px] text-[#83a84c]">{{ glyph('check') }}</text>
                        <!-- #endif -->
                        <!-- #ifndef MP-WEIXIN -->
                        <svg v-if="selected === gen.value" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" data-ic="check" class="h-5 w-5 text-[#83a84c]">
                            <path d="m9 18 6-6-6-6"></path>
                        </svg>
                        <!-- #endif -->
                    </view>
                </view>
            </scroll-view>

            <view class="generation-drawer__footer">
                <PanelActions
                    :secondary-text="t('dex.drawer.allGens')"
                    :primary-text="t('dex.filter.done')"
                    @secondary="clearGeneration"
                    @primary="close"
                />
            </view>
        </view>

        <view
            v-if="visible"
            class="generation-mask fixed inset-0 z-[998]"
            @click="close"
            @touchmove.stop.prevent
        ></view>
    </view>
</template>

<script lang="ts" setup>
import { glyph } from '@/components/icon/glyphs';
import PanelActions from '@/components/shared/PanelActions.vue';
import { useI18n } from 'vue-i18n';
import { GENERATIONS, formatGenerationRange } from '@/constants/generations';

const { t } = useI18n();

interface Props {
    /** 抽屉是否展开（v-model:visible） */
    visible: boolean;
    /** 当前选中世代 value，null 表示未筛选（v-model:selected） */
    selected: string | null;
}

const props = defineProps<Props>();

const emit = defineEmits<{
    'update:visible': [value: boolean];
    'update:selected': [value: string | null];
}>();

const close = () => emit('update:visible', false);

/** 「全部世代」：清除世代筛选，抽屉保持打开（与筛选面板重置行为一致） */
const clearGeneration = () => emit('update:selected', null);

/** 再次点击已选世代则取消筛选 */
const select = (value: string) => {
    emit('update:selected', props.selected === value ? null : value);
};
</script>

<style lang="scss" scoped>
.generation-drawer {
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    /* 底部让出 TabBar（距底 16 + 高 64 = 80）+ 安全区，使 footer 停在 TabBar 上方 */
    padding-bottom: calc(80px + env(safe-area-inset-bottom));
    border-left: 1px solid #e5e7ee;
    border-radius: 28px 0 0 28px;
}

.generation-drawer__header {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    gap: 12px;
    padding: 14px 16px;
    border-bottom: 1px solid #eef0f5;
    background: linear-gradient(135deg, rgba(247, 250, 255, 0.94), rgba(255, 255, 255, 0.78));
}

.generation-back {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    width: 38px;
    height: 38px;
    padding: 0;
    border: 1px solid #e5e7ee;
    border-radius: 999px;
    color: #6f7480;
    background: #f5f6fa;
    transition: transform 0.18s ease, background 0.18s ease;
}

.generation-back:active {
    transform: scale(0.94);
    background: #eef0f5;
}

.generation-back:focus-visible {
    outline: 3px solid rgba(53, 125, 244, 0.72);
    outline-offset: 2px;
}

.generation-drawer__title {
    min-width: 0;
    color: #24262b;
    font-size: 18px;
    font-weight: 900;
    letter-spacing: -0.02em;
}

.generation-drawer__body {
    flex: 1 1 0%;
    min-height: 0;
}

.generation-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 16px;
}

.generation-drawer__footer {
    flex-shrink: 0;
    padding: 12px 16px 14px;
    border-top: 1px solid #eef0f5;
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.78), rgba(248, 250, 254, 0.98));
}

.generation-mask {
    background: rgba(30, 39, 54, 0.22);
    backdrop-filter: blur(3px);
    animation: generation-mask-in 0.2s ease both;
}

.generation-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 12px;
    border: 1px solid #e5e7ee;
    border-radius: 22px;
    background: #f5f6fa;
    box-shadow: inset 0 1px 0 #ffffff, 0 10px 22px rgba(48, 55, 72, 0.06);
    transition: transform 0.2s ease, background 0.2s ease, border-color 0.2s ease;
}

.generation-item:active {
    transform: scale(0.98);
}

.generation-item--active {
    border-color: rgba(53, 125, 244, 0.32);
    background: linear-gradient(135deg, #eef4ff, #fff7dc);
}

.generation-item__mark {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 42px;
    height: 42px;
    border-radius: 16px;
    color: #6f7480;
    background: #eef0f5;
    box-shadow: inset 0 0 0 1px #ffffff;
}

.generation-item--active .generation-item__mark {
    color: #fff;
    background: linear-gradient(135deg, #73b7ff, #357df4);
}

.generation-back::after {
    border: none !important;
}

@keyframes generation-mask-in {
    from { opacity: 0; }
    to { opacity: 1; }
}

@media (prefers-reduced-motion: reduce) {
    .generation-drawer,
    .generation-mask {
        animation-duration: 0.01ms;
        transition-duration: 0.01ms;
    }
}
</style>
