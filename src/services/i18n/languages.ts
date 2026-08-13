/**
 * 支持的语言清单与偏好检测。
 *
 * identifier 与服务端 `languages.csv` / bundle 目录名严格一致
 * （见 assets/fb/i18n/<lang>/）。顺序即 UI 语言选择器的展示顺序。
 */

export interface LanguageOption {
    /** bundle 目录名，如 "zh-hans" */
    id: string;
    /** 展示名（该语言自称） */
    label: string;
}

/**
 * 服务端实际打包的 14 种语言。
 * 覆盖率说明（影响回落策略，见 i18n/index.ts）：
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

const STORAGE_KEY = 'zukan_language';

/**
 * 把系统/浏览器语言标签归一到我们的 identifier。
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

/** 读取用户显式选择的语言（未设置返回 null） */
export function getStoredLanguage(): string | null {
    try {
        const v = uni.getStorageSync(STORAGE_KEY) as unknown;
        if (typeof v === 'string' && LANG_IDS.has(v)) return v;
        return null;
    } catch {
        return null;
    }
}

/** 持久化用户语言选择 */
export function setStoredLanguage(id: string): void {
    try {
        uni.setStorageSync(STORAGE_KEY, id);
    } catch (err) {
        console.warn('[i18n] 写入语言偏好失败', err);
    }
}

/**
 * 检测系统语言。优先走 uni 的 app/系统语言设置，回退浏览器 navigator。
 * 失败兜底简体中文（app 首要面向中文用户）。
 */
function detectSystemLanguage(): string {
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

/**
 * 当前应使用的语言：用户显式选择 > 系统语言 > 默认。
 */
export function getPreferredLanguage(): string {
    return getStoredLanguage() ?? detectSystemLanguage();
}
