<template>
    <view>
        <view
            class="lang-drawer fixed right-0 top-0 z-[999] flex h-full w-[320px] flex-col border-l border-[#e5e7ee] bg-white shadow-[-24px_0_60px_rgba(48,55,72,0.18)] transition-transform duration-300 ease-out"
            :class="visible ? 'translate-x-0' : 'translate-x-full'"
            :style="{ paddingTop: 'var(--status-bar-height)' }"
        >
            <view class="px-5 pb-4 pt-5">
                <view class="flex items-start justify-between gap-3">
                    <view>
                        <text class="block text-2xl font-black tracking-[-0.05em] text-[#24262b]">{{ t('language.title') }}</text>
                        <text class="mt-1 block text-xs font-bold uppercase tracking-[0.18em] text-[#89947e]">Language</text>
                    </view>
                    <button
                        class="panel-button flex h-9 w-9 items-center justify-center rounded-full bg-[#f5f6fa] text-[#8d929c] shadow-[0_10px_22px_rgba(48,55,72,0.08)] active:scale-95"
                        @click="close"
                    >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </view>
            </view>

            <scroll-view scroll-y class="flex-1 px-5 pb-6">
                <text class="section-label">{{ t('language.uiSection') }}</text>
                <LanguageOptionList
                    :model-value="i18nStore.uiLang"
                    :options="UI_LANGUAGES"
                    :auto-subtitle="uiAutoHint"
                    @update:model-value="onUiChange"
                />

                <text class="section-label mt-6">{{ t('language.contentSection') }}</text>
                <LanguageOptionList
                    :model-value="i18nStore.contentLang"
                    :options="LANGUAGES"
                    :auto-subtitle="contentAutoHint"
                    :loading="i18nStore.loading"
                    @update:model-value="onContentChange"
                />
            </scroll-view>
        </view>

        <view
            v-if="visible"
            class="fixed inset-0 z-[998] bg-[#24262b]/28 transition-opacity duration-300"
            @click="close"
        ></view>
    </view>
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import LanguageOptionList from '@/components/shared/LanguageOptionList.vue';
import {
    AUTO_LANG,
    LANGUAGES,
    UI_LANGUAGES,
    detectSystemLanguage,
    resolveUiLocale,
    type UiLangSetting,
} from '@/services/i18n/languages';
import { useI18nStore } from '@/store/i18n';

const { t } = useI18n();
const i18nStore = useI18nStore();

interface Props {
    /** 抽屉是否展开（v-model:visible） */
    visible: boolean;
}

defineProps<Props>();

const emit = defineEmits<{
    'update:visible': [value: boolean];
}>();

const close = () => emit('update:visible', false);

/** UI「跟随系统」副标题：系统语言映射到的 UI locale */
const uiAutoHint = computed(() => {
    const locale = resolveUiLocale(AUTO_LANG);
    const label = UI_LANGUAGES.find((l) => l.id === locale)?.label ?? locale;
    return t('language.systemHint', { lang: label });
});

/** 内容「跟随系统」副标题：系统语言对应的内容语言 */
const contentAutoHint = computed(() => {
    const sys = detectSystemLanguage();
    const label = LANGUAGES.find((l) => l.id === sys)?.label ?? sys;
    return t('language.systemHint', { lang: label });
});

function onUiChange(value: string) {
    i18nStore.setUiLang(value as UiLangSetting);
}

async function onContentChange(value: string) {
    if (value === i18nStore.contentLang || i18nStore.loading) return;
    await i18nStore.setContentLang(value);
}
</script>

<style lang="scss" scoped>
.section-label {
    display: block;
    margin-bottom: 10px;
    color: #89947e;
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.16em;
    text-transform: uppercase;
}

.panel-button::after {
    border: none !important;
}
</style>
