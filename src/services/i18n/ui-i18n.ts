/**
 * vue-i18n 单例 —— 只管界面静态文案（标题/按钮/空态/toast）。
 *
 * 游戏数据名称（物种/招式/特性）走 Pinia i18n store + 加密 bundle，不在此列。
 * 语言来源与切换由 `services/i18n/languages` 与 Pinia store 统一管理：
 * store.setLanguage() 在持久化偏好后调用 syncUiLocale()，让两套 i18n 同步切换。
 *
 * 当前只完整提供简中（zh-Hans）与英文（en）；其余语言回落英文。
 */
import { createI18n } from 'vue-i18n';
import { uiMessages, type UiMessageSchema } from './ui-messages';
import { getPreferredLanguage, getStoredLanguage } from './languages';

/** bundle 语言 id → UI 文案 locale：所有 zh-* 用简中，其余用英文。 */
export function toUiLocale(lang: string): 'zh-Hans' | 'en' {
    return lang.startsWith('zh') ? 'zh-Hans' : 'en';
}

function initialLocale(): 'zh-Hans' | 'en' {
    return toUiLocale(getStoredLanguage() ?? getPreferredLanguage());
}

export const i18n = createI18n<[UiMessageSchema], 'zh-Hans' | 'en'>({
    legacy: false,
    globalInjection: true,
    locale: initialLocale(),
    fallbackLocale: 'en',
    messages: uiMessages,
});

/** 供 Pinia store 在语言切换时同步 vue-i18n 的活动 locale。 */
export function syncUiLocale(lang: string): void {
    // legacy:false 下 global.locale 是 Ref；经泛型收窄后 TS 推断为字面量联合，
    // 经 unknown 绕开后按 Ref 赋值。
    (i18n.global.locale as unknown as { value: string }).value = toUiLocale(lang);
}
