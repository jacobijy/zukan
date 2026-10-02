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

/**
 * 带插值的文案渲染（对 H5 与微信端都正确的兜底）。
 *
 * 背景：uni-app 在 mp/app 构建时把 `vue-i18n` 重定向到自带的 runtime-only 版
 * （`uni-cli-shared/lib/vue-i18n/...runtime.esm-bundler.js`，**无 message-compiler**），
 * 而 runtime 版需要消息预编译——项目消息表（`ui-messages.ts`）是普通字符串对象，
 * 于是微信端 `t('mine.statusDesc', { count })` 无法插值，返回 `{count}` 原文；
 * H5 走 vite alias 配对的完整版（`vue-i18n.mjs`），插值正常。
 *
 * 这里在 `t()` 结果上做**幂等**替换：H5 已插值 → 找不到 `{k}` 原文、原样返回；
 * 微信端保留 `{k}` → 手动替换。两种情况下输出都正确，未来版本对齐后可整体移除。
 * 详见 docs/i18n/i18n-bundle.md「插值兜底」。
 */
export function interp(key: string, params: Record<string, string | number>): string {
    let s = i18n.global.t(key, params);
    for (const [k, v] of Object.entries(params)) {
        s = s.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    }
    return s;
}

/** 供 Pinia store 在 UI 语言切换后同步 vue-i18n 的活动 locale。 */
export function syncUiLocale(locale: UiLocale): void {
    // legacy:false 下 global.locale 是 Ref；经泛型收窄后 TS 推断为字面量联合，
    // 经 unknown 绕开后按 Ref 赋值。
    (i18n.global.locale as unknown as { value: UiLocale }).value = locale;
}
