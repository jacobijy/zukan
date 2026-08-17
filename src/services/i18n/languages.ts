/**
 * 支持的语言清单与偏好检测。
 *
 * 语言拆成两套独立设置：
 * - **UI 语言**（`zukan_ui_language`）：界面静态文案。当前只完整提供简中/英文
 *   两套，但列表可扩展——后续加语言只需补 `UiLocale`、`UI_LANGUAGES` 与对应文案。
 * - **内容语言**（`zukan_content_language`）：宝可梦游戏数据（物种/招式/特性等
 *   名称与描述），identifier 与服务端 `languages.csv` / bundle 目录名严格一致
 *   （见 assets/fb/i18n/<lang>/）。
 *
 * 两者默认均为 `'auto'`，按系统语言解析；用户可各自独立切换。
 */

export interface LanguageOption {
    /** bundle 目录名，如 "zh-hans" */
    id: string;
    /** 展示名（该语言自称） */
    label: string;
}

/**
 * 服务端实际打包的 14 种内容语言。
 * 覆盖率说明（影响回落策略，见 store/i18n.ts）：
 * - en / ja / ja-hrkt / ko / zh-hans / zh-hant / fr / de / es / es-419 / it：名称组完整
 * - ja-roma：仅物种名，其余表为空
 * - cs / pt-br：名称组整体为空，必须回落英文
 */
export const LANGUAGES: readonly LanguageOption[] = [
    { id: 'zh-hans', label: '简体中文' },
    { id: 'zh-hant', label: '繁體中文' },
    { id: 'en', label: 'English' },
    { id: 'ja', label: '日本語' },
    { id: 'ja-hrkt', label: 'にほんご（かな）' },
    { id: 'ja-roma', label: 'Nihongo（Rōmaji）' },
    { id: 'ko', label: '한국어' },
    { id: 'fr', label: 'Français' },
    { id: 'de', label: 'Deutsch' },
    { id: 'es', label: 'Español' },
    { id: 'es-419', label: 'Español (Latinoamérica)' },
    { id: 'it', label: 'Italiano' },
    { id: 'pt-br', label: 'Português (Brasil)' },
    { id: 'cs', label: 'Čeština' },
];

const LANG_IDS = new Set(LANGUAGES.map((l) => l.id));

/** 回落基线语言：名称组在所有语言中最完整 */
export const FALLBACK_LANGUAGE = 'en';

/** 跟随系统的设置值 */
export const AUTO_LANG = 'auto';

// ── UI 语言 ──

/** UI 文案当前完整提供的 locale；新增语言时在此扩展并补 messages。 */
export type UiLocale = 'zh-Hans' | 'en';

export interface UiLanguageOption {
    id: UiLocale;
    label: string;
}

export const UI_LANGUAGES = [
    { id: 'zh-Hans', label: '简体中文' },
    { id: 'en', label: 'English' },
] as const satisfies readonly UiLanguageOption[];

const UI_LOCALE_IDS = new Set<string>(UI_LANGUAGES.map((l) => l.id));

/** bundle 语言 id → UI 文案 locale：所有 zh-* 用简中，其余用英文。 */
export function toUiLocale(lang: string): UiLocale {
    return lang.startsWith('zh') ? 'zh-Hans' : 'en';
}

const UI_STORAGE_KEY = 'zukan_ui_language';
const CONTENT_STORAGE_KEY = 'zukan_content_language';

/** UI 语言设置：`'auto'` 跟随系统，或显式 locale */
export type UiLangSetting = typeof AUTO_LANG | UiLocale;
/** 内容语言设置：`'auto'` 跟随系统，或显式 bundle 语言 id */
export type ContentLangSetting = typeof AUTO_LANG | string;

function readStorage(key: string): string | null {
    try {
        const v = uni.getStorageSync(key) as unknown;
        return typeof v === 'string' ? v : null;
    } catch {
        return null;
    }
}

function writeStorage(key: string, value: string): void {
    try {
        uni.setStorageSync(key, value);
    } catch (err) {
        console.warn(`[i18n] 写入语言偏好失败 (${key})`, err);
    }
}

// ── 持久化读写 ──

/** 读取 UI 语言设置（未设置返回 `'auto'`）；非法值回落 auto。 */
export function getStoredUiLang(): UiLangSetting {
    const v = readStorage(UI_STORAGE_KEY);
    if (v === AUTO_LANG) return AUTO_LANG;
    if (v && UI_LOCALE_IDS.has(v)) return v as UiLocale;
    return AUTO_LANG;
}

/** 持久化 UI 语言设置 */
export function setStoredUiLang(setting: UiLangSetting): void {
    writeStorage(UI_STORAGE_KEY, setting);
}

/** 读取内容语言设置（未设置返回 `'auto'`）；非法值回落 auto。 */
export function getStoredContentLang(): ContentLangSetting {
    const v = readStorage(CONTENT_STORAGE_KEY);
    if (v === AUTO_LANG) return AUTO_LANG;
    if (v && LANG_IDS.has(v)) return v;
    return AUTO_LANG;
}

/** 持久化内容语言设置 */
export function setStoredContentLang(setting: ContentLangSetting): void {
    writeStorage(CONTENT_STORAGE_KEY, setting);
}

// ── 系统检测 ──

/**
 * 把系统/浏览器语言标签归一到内容语言 identifier。
 * 未匹配返回 null（由调用方决定默认值）。
 */
function normalizeTag(tag: string): string | null {
    const t = tag.toLowerCase().replace('_', '-');
    if (LANG_IDS.has(t)) return t;

    // 中文变体
    if (t.startsWith('zh')) {
        if (t.includes('hant') || t.includes('tw') || t.includes('hk') || t.includes('mo')) {
            return 'zh-hant';
        }
        return 'zh-hans';
    }
    // 日语变体：优先假名表记（游戏内默认），否则 ja
    if (t.startsWith('ja')) return 'ja-hrkt';
    const base = t.split('-')[0];
    if (LANG_IDS.has(base)) return base;
    // es-419 / pt-br 等地区变体由 base 命中 es/pt；pt → pt-br（服务端只有 pt-br）
    if (base === 'pt') return 'pt-br';
    if (base === 'es') return 'es';
    return null;
}

/**
 * 检测系统语言。优先走 uni 的 app/系统语言设置，回退浏览器 navigator。
 * 失败兜底简体中文（app 首要面向中文用户）。
 */
export function detectSystemLanguage(): string {
    const tags: string[] = [];
    try {
        const info = uni.getSystemInfoSync();
        // @ts-expect-error 各端字段名不一：app/MP 多为 language，H5 也可能在 locale
        const sysLang = info.language ?? info.locale;
        if (sysLang) tags.push(sysLang);
    } catch {
        // ignore
    }
    if (typeof navigator !== 'undefined' && navigator.language) {
        tags.push(navigator.language);
    }
    for (const tag of tags) {
        const id = normalizeTag(tag);
        if (id) return id;
    }
    return 'zh-hans';
}

// ── 解析：设置值 → 实际语言 ──

/**
 * 把 UI 设置解析成实际 locale：`'auto'` 按系统语言映射，否则用显式值。
 */
export function resolveUiLocale(setting: UiLangSetting = getStoredUiLang()): UiLocale {
    if (setting !== AUTO_LANG && UI_LOCALE_IDS.has(setting)) return setting;
    return toUiLocale(detectSystemLanguage());
}

/**
 * 把内容设置解析成实际 bundle 语言 id：`'auto'` 按系统语言，否则用显式值。
 */
export function resolveContentLang(setting: ContentLangSetting = getStoredContentLang()): string {
    if (setting !== AUTO_LANG && LANG_IDS.has(setting)) return setting;
    return detectSystemLanguage();
}
