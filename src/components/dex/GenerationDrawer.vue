<template>
    <view>
        <view
            class="generation-drawer fixed right-0 top-0 z-[999] h-full w-[280px] border-l border-[#e5e7ee] bg-white shadow-[-24px_0_60px_rgba(48,55,72,0.18)] transition-transform duration-300 ease-out"
            :class="visible ? 'translate-x-0' : 'translate-x-full'"
            :style="{ paddingTop: 'var(--status-bar-height)' }"
        >
            <view class="p-5">
                <view class="mb-5 flex items-start justify-between gap-3">
                    <view>
                        <text class="block text-2xl font-black tracking-[-0.05em] text-[#24262b]">{{ t('dex.drawer.generationTitle') }}</text>
                        <text class="mt-1 block text-xs font-bold uppercase tracking-[0.18em] text-[#89947e]">Generation drawer</text>
                    </view>
                    <button class="panel-button flex h-9 w-9 items-center justify-center rounded-full bg-[#f5f6fa] text-[#8d929c] shadow-[0_10px_22px_rgba(48,55,72,0.08)] active:scale-95" @click="close">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </view>

                <view class="flex flex-col gap-2 overflow-y-auto pr-1" style="height: calc(100vh - 120px);">
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
                        <svg v-if="selected === gen.value" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5 text-[#83a84c]">
                            <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                    </view>
                </view>
            </view>
        </view>

        <view
            v-if="visible"
            class="fixed inset-0 z-[998] bg-[#24262b]/28 transition-opacity duration-300"
            @click="close"
        ></view>
    </view>
</template>

<script lang="ts" setup>
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

/** 再次点击已选世代则取消筛选 */
const select = (value: string) => {
    emit('update:selected', props.selected === value ? null : value);
};
</script>

<style lang="scss" scoped>
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

.panel-button::after {
    border: none !important;
}
</style>
