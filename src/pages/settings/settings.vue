<template>
    <view class="settings-page min-h-screen page-bg" :style="[pageSafeArea, { paddingBottom: '40px' }]">
        <DetailNavbar :title="t('settings.title')" @back="goBack" />

        <scroll-view
            scroll-y
            class="relative z-10 h-[calc(100vh-var(--navbar-total-height))] mt-[var(--navbar-total-height)] px-4 pb-6"
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
                            <!-- #ifdef MP-WEIXIN -->
                            <text v-if="row.icon === 'globe'" class="ic text-[24px]">{{ glyph('globe') }}</text>
                            <text v-else class="ic text-[24px]">{{ glyph('book') }}</text>
                            <!-- #endif -->
                            <!-- #ifndef MP-WEIXIN -->
                            <svg v-if="row.icon === 'globe'" data-ic="globe" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="h-6 w-6">
                                <circle cx="12" cy="12" r="9"></circle>
                                <path d="M3 12h18"></path>
                                <path d="M12 3a14 14 0 0 1 0 18a14 14 0 0 1 0-18z"></path>
                            </svg>
                            <svg v-else data-ic="book" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="h-6 w-6">
                                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                                <path d="M6.5 3H20v18H6.5A2.5 2.5 0 0 1 4 18.5v-13A2.5 2.5 0 0 1 6.5 3z"></path>
                            </svg>
                            <!-- #endif -->
                        </template>
                    </ListRow>
                </view>

                <template v-if="loggedIn">
                    <text class="section-label mt-3">{{ t('settings.sectionAccount') }}</text>
                    <view class="glass-panel account-panel">
                        <button class="logout-btn" @click="onLogout">{{ t('settings.logout') }}</button>
                    </view>
                </template>
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
import { usePageSafeArea } from '@/composables/usePageSafeArea';
import { useLogout } from '@/composables/useLogout';
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { onShow } from '@dcloudio/uni-app';
import { isAuthenticated } from '@/services/session';
import { interp } from '@/services/i18n/ui-i18n';
import { glyph } from '@/components/icon/glyphs';
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
} from '@/services/i18n/languages'

const pageSafeArea = usePageSafeArea();

const { t } = useI18n();
const i18nStore = useI18nStore();
const { logout } = useLogout();

const uiSheetOpen = ref(false);
const contentSheetOpen = ref(false);

/** 退出登录按钮仅登录后显示；设置页可能在登录态变化后被重新打开。 */
const loggedIn = ref(isAuthenticated());
onShow(() => {
    loggedIn.value = isAuthenticated();
});

// ── 选项：把「跟随系统」作为首项注入 ──

const uiOptions = computed<SheetOption[]>(() => {
    const sysLocale = resolveUiLocale(AUTO_LANG);
    const sysLabel = UI_LANGUAGES.find((l) => l.id === sysLocale)?.label ?? sysLocale;
    return [
        {
            id: AUTO_LANG,
            label: t('language.followSystem'),
            subtitle: interp('language.systemHint', { lang: sysLabel }),
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
            subtitle: interp('language.systemHint', { lang: sysLabel }),
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

function onLogout(): void {
    uni.showModal({
        title: t('mine.logoutTitle'),
        content: t('mine.logoutContent'),
        confirmText: t('settings.logout'),
        cancelText: t('common.cancel'),
        success: (res) => {
            if (!res.confirm) return;
            logout();
            loggedIn.value = false;
            uni.showToast({ title: t('mine.toastLoggedOut'), icon: 'none' });
            uni.navigateBack();
        },
    });
}

const goBack = () => {
    // DetailNavbar 内部已处理 navigateBack
};
</script>

<style lang="scss" scoped>
.account-panel {
    padding: 10px;
}

.logout-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 48px;
    margin: 0;
    padding: 0;
    border: 1.5px solid rgba(224, 79, 71, 0.28);
    border-radius: 14px;
    color: #e04f47;
    font-size: 15px;
    font-weight: 800;
    line-height: 48px;
    background: #fff6f5;

    &::after {
        border: none !important;
    }

    &:active {
        transform: scale(0.99);
    }
}
</style>
