<template>
    <view class="settings-page min-h-screen page-bg" :style="{ paddingTop: 'var(--status-bar-height)', paddingBottom: '40px' }">
        <DetailNavbar :title="t('settings.title')" @back="goBack" />

        <scroll-view
            scroll-y
            class="relative z-10 h-[calc(100vh-var(--status-bar-height))] mt-[calc(var(--status-bar-height)+52px)] px-4 pb-6"
        >
            <view class="mx-auto max-w-[720px] flex flex-col gap-3 pt-3">
                <text class="section-label">{{ t('settings.sectionLanguage') }}</text>
                <view class="glass-panel">
                    <ListRow
                        v-for="(row, index) in rows"
                        :key="row.key"
                        :title="row.title"
                        :desc="row.desc"
                        :meta="row.meta"
                        :iconClass="row.iconClass"
                        :last="index === rows.length - 1"
                        showChevron
                        @click="onRowTap(row.key)"
                    >
                        <template #icon>
                            <svg v-if="row.icon === 'globe'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="h-6 w-6">
                                <circle cx="12" cy="12" r="9"></circle>
                                <path d="M3 12h18"></path>
                                <path d="M12 3a14 14 0 0 1 0 18a14 14 0 0 1 0-18z"></path>
                            </svg>
                            <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="h-6 w-6">
                                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
                            </svg>
                        </template>
                    </ListRow>
                </view>
            </view>
        </scroll-view>

        <OptionSheet
            v-model:visible="uiSheetOpen"
            :title="t('language.uiSection')"
            :options="uiOptions"
            :model-value="i18nStore.uiLang"
            @update:model-value="onUiChange"
        />

        <OptionSheet
            v-model:visible="contentSheetOpen"
            :title="t('language.contentSection')"
            :options="contentOptions"
            :model-value="i18nStore.contentLang"
            :loading-id="i18nStore.loading ? i18nStore.contentLang : null"
            @update:model-value="onContentChange"
        />
    </view>
</template>

<script lang="ts" setup>
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import DetailNavbar from '@/components/shared/DetailNavbar.vue';
import ListRow from '@/components/shared/ListRow.vue';
import OptionSheet, { type SheetOption } from '@/components/shared/OptionSheet.vue';
import { SETTING_ROWS, type SettingRowKey } from './settings-options';
import { useI18nStore } from '@/store/i18n';
import {
    AUTO_LANG,
    LANGUAGES,
    UI_LANGUAGES,
    detectSystemLanguage,
    resolveContentLang,
    resolveUiLocale,
    type UiLangSetting,
} from '@/services/i18n/languages';

const { t } = useI18n();
const i18nStore = useI18nStore();

const uiSheetOpen = ref(false);
const contentSheetOpen = ref(false);

// ── 选项：把「跟随系统」作为首项注入 ──

const uiOptions = computed<SheetOption[]>(() => {
    const sysLocale = resolveUiLocale(AUTO_LANG);
    const sysLabel = UI_LANGUAGES.find((l) => l.id === sysLocale)?.label ?? sysLocale;
    return [
        {
            id: AUTO_LANG,
            label: t('language.followSystem'),
            subtitle: t('language.systemHint', { lang: sysLabel }),
        },
        ...UI_LANGUAGES.map((l) => ({ id: l.id, label: l.label })),
    ];
});

const contentOptions = computed<SheetOption[]>(() => {
    const sys = detectSystemLanguage();
    const sysLabel = LANGUAGES.find((l) => l.id === sys)?.label ?? sys;
    return [
        {
            id: AUTO_LANG,
            label: t('language.followSystem'),
            subtitle: t('language.systemHint', { lang: sysLabel }),
        },
        ...LANGUAGES.map((l) => ({ id: l.id, label: l.label })),
    ];
});

// ── 行展示值：解析 'auto' 为实际语言 label ──

const uiMeta = computed(() => {
    const locale = resolveUiLocale(i18nStore.uiLang);
    return UI_LANGUAGES.find((l) => l.id === locale)?.label ?? locale;
});

const contentMeta = computed(() => {
    const lang = resolveContentLang(i18nStore.contentLang);
    return LANGUAGES.find((l) => l.id === lang)?.label ?? t('mine.langFallback');
});

const rows = computed(() => {
    const meta: Record<SettingRowKey, { title: string; desc: string; value: string }> = {
        uiLanguage: {
            title: t('settings.uiLanguage'),
            desc: t('settings.uiLanguageDesc'),
            value: uiMeta.value,
        },
        contentLanguage: {
            title: t('settings.contentLanguage'),
            desc: t('settings.contentLanguageDesc'),
            value: contentMeta.value,
        },
    };
    return SETTING_ROWS.map((row) => ({
        ...row,
        title: meta[row.key].title,
        desc: meta[row.key].desc,
        meta: meta[row.key].value,
    }));
});

function onRowTap(key: SettingRowKey) {
    if (key === 'uiLanguage') uiSheetOpen.value = true;
    else if (key === 'contentLanguage') contentSheetOpen.value = true;
}

function onUiChange(value: string | string[]) {
    i18nStore.setUiLang(value as UiLangSetting);
}

async function onContentChange(value: string | string[]) {
    const id = value as string;
    if (id === i18nStore.contentLang || i18nStore.loading) return;
    await i18nStore.setContentLang(id);
}

const goBack = () => {
    // DetailNavbar 内部已处理 navigateBack
};
</script>
