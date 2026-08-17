<template>
    <view class="flex flex-col gap-2">
        <view
            class="lang-item"
            :class="{ 'lang-item--active': modelValue === AUTO }"
            @click="select(AUTO)"
        >
            <view class="flex items-center gap-3">
                <view class="lang-item__mark">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5">
                        <circle cx="12" cy="12" r="9"></circle>
                        <path d="M3 12h18"></path>
                        <path d="M12 3a14 14 0 0 1 0 18a14 14 0 0 1 0-18z"></path>
                    </svg>
                </view>
                <view>
                    <text class="block text-sm font-black text-[#24262b]">{{ t('language.followSystem') }}</text>
                    <text v-if="autoSubtitle" class="block font-mono text-[11px] font-bold text-[#89947e]">{{ autoSubtitle }}</text>
                </view>
            </view>
            <svg
                v-if="modelValue === AUTO"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="3"
                stroke-linecap="round"
                stroke-linejoin="round"
                class="h-5 w-5 text-[#83a84c]"
            >
                <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
        </view>

        <view
            v-for="opt in options"
            :key="opt.id"
            class="lang-item"
            :class="{
                'lang-item--active': modelValue === opt.id,
                'lang-item--loading': loading && modelValue === opt.id,
            }"
            @click="select(opt.id)"
        >
            <view class="flex items-center gap-3">
                <view class="lang-item__mark">
                    <text class="text-xs font-black uppercase">{{ opt.id.slice(0, 2) }}</text>
                </view>
                <view>
                    <text class="block text-sm font-black text-[#24262b]">{{ opt.label }}</text>
                    <text class="block font-mono text-[11px] font-bold text-[#89947e]">{{ opt.id }}</text>
                </view>
            </view>
            <svg
                v-if="modelValue === opt.id && !loading"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="3"
                stroke-linecap="round"
                stroke-linejoin="round"
                class="h-5 w-5 text-[#83a84c]"
            >
                <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            <view v-else-if="loading && modelValue === opt.id" class="lang-spinner"></view>
        </view>
    </view>
</template>

<script lang="ts" setup>
import { useI18n } from 'vue-i18n';
import { AUTO_LANG, type LanguageOption, type UiLanguageOption } from '@/services/i18n/languages';

const { t } = useI18n();

const AUTO = AUTO_LANG;

interface Props {
    /** 当前设置值（'auto' 或某个 option.id） */
    modelValue: string;
    /** 具体语言选项（不含「跟随系统」） */
    options: readonly (LanguageOption | UiLanguageOption)[];
    /** 「跟随系统」行展示的解析结果副标题 */
    autoSubtitle?: string;
    /** 当前选中项是否加载中（内容语言切换时） */
    loading?: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{
    'update:modelValue': [value: string];
}>();

function select(id: string) {
    if (id === props.modelValue) return;
    emit('update:modelValue', id);
}
</script>

<style lang="scss" scoped>
.lang-item {
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

.lang-item:active {
    transform: scale(0.98);
}

.lang-item--active {
    border-color: rgba(53, 125, 244, 0.32);
    background: linear-gradient(135deg, #eef4ff, #fff7dc);
}

.lang-item--loading {
    opacity: 0.7;
}

.lang-item__mark {
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

.lang-item--active .lang-item__mark {
    color: #fff;
    background: linear-gradient(135deg, #73b7ff, #357df4);
}

.lang-spinner {
    width: 18px;
    height: 18px;
    border: 2.5px solid #e5e7ee;
    border-top-color: #357df4;
    border-radius: 50%;
    animation: lang-spin 0.7s linear infinite;
}

@keyframes lang-spin {
    to {
        transform: rotate(360deg);
    }
}
</style>
