/**
 * vue-i18n 单例 —— 只管界面静态文案（标题/按钮/空态/toast）。
 *
 * 游戏数据名称（物种/招式/特性）走 Pinia i18n store + 加密 bundle，是另一套独立设置。
 * UI 语言解析与持久化由 `services/i18n/languages` 管理；Pinia store 在用户切换
 * UI 语言后调用 syncUiLocale()，让界面文案即时更新。
 *
 * 当前只完整提供简中（zh-Hans）与英文（en）；其余语言回落英文。
 */
import { createI18n } from 'vue-i18n';
import { uiMessages, type UiMessageSchema } from './ui-messages';
import { resolveUiLocale, type UiLocale } from './languages';

export const i18n = createI18n<[UiMessageSchema], UiLocale>({
    legacy: false,
    globalInjection: true,
    locale: resolveUiLocale(),
    fallbackLocale: 'en',
    messages: uiMessages,
});

/** 供 Pinia store 在 UI 语言切换后同步 vue-i18n 的活动 locale。 */
export function syncUiLocale(locale: UiLocale): void {
    // legacy:false 下 global.locale 是 Ref；经泛型收窄后 TS 推断为字面量联合，
    // 经 unknown 绕开后按 Ref 赋值。
    (i18n.global.locale as unknown as { value: UiLocale }).value = locale;
}
