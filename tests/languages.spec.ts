/**
 * 语言偏好解析用例（`src/services/i18n/languages.ts`）
 *
 * 守护：
 * 1. 两套独立设置（UI / 内容）默认均为 'auto'，按系统语言解析；
 * 2. 显式值原样返回；
 * 3. 非法存储值回落 auto。
 *
 * storage stub 只按字符串存取（languages.ts 对 getStorageSync 结果做
 * typeof === 'string' 判断）。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const UI_KEY = 'zukan_ui_language';
const CONTENT_KEY = 'zukan_content_language';

let disk: Map<string, string>;
let navigatorLang: string | undefined;

function installUniStub() {
    disk = new Map();
    vi.stubGlobal('uni', {
        setStorageSync(key: string, data: unknown) {
            disk.set(key, String(data));
        },
        getStorageSync(key: string) {
            return disk.has(key) ? disk.get(key) : '';
        },
        removeStorageSync(key: string) {
            disk.delete(key);
        },
        getSystemInfoSync: () => ({ language: undefined }),
    });
    // node 测试环境没有 navigator：按需挂一个可写的 language
    Object.defineProperty(globalThis, 'navigator', {
        value: { language: '' },
        configurable: true,
        writable: true,
    });
    Object.defineProperty(globalThis.navigator, 'language', {
        get: () => navigatorLang,
        configurable: true,
    });
}

/** 重新导入模块拿到干净状态；返回 languages 模块 */
async function fresh() {
    vi.resetModules();
    return import('@/services/i18n/languages');
}

beforeEach(() => {
    installUniStub();
    navigatorLang = undefined;
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('默认与解析', () => {
    it('未存储时两套设置均为 auto', async () => {
        const { getStoredUiLang, getStoredContentLang } = await fresh();
        expect(getStoredUiLang()).toBe('auto');
        expect(getStoredContentLang()).toBe('auto');
    });

    it('auto 按系统语言解析：日语地区变体 → 内容 ja-hrkt、UI en', async () => {
        navigatorLang = 'ja-JP';
        const { resolveUiLocale, resolveContentLang } = await fresh();
        expect(resolveContentLang('auto')).toBe('ja-hrkt');
        expect(resolveUiLocale('auto')).toBe('en');
    });

    it('auto 按系统语言解析：繁中 → 内容 zh-hant、UI zh-Hans', async () => {
        navigatorLang = 'zh-TW';
        const { resolveUiLocale, resolveContentLang } = await fresh();
        expect(resolveContentLang('auto')).toBe('zh-hant');
        expect(resolveUiLocale('auto')).toBe('zh-Hans');
    });

    it('显式值原样返回', async () => {
        const { resolveUiLocale, resolveContentLang, setStoredUiLang, setStoredContentLang, getStoredUiLang, getStoredContentLang } = await fresh();
        setStoredUiLang('en');
        setStoredContentLang('ja');
        expect(getStoredUiLang()).toBe('en');
        expect(getStoredContentLang()).toBe('ja');
        expect(resolveUiLocale()).toBe('en');
        expect(resolveContentLang()).toBe('ja');
    });

    it('非法存储值回落 auto', async () => {
        disk.set(UI_KEY, 'klingon');
        disk.set(CONTENT_KEY, 'martian');
        const { getStoredUiLang, getStoredContentLang } = await fresh();
        expect(getStoredUiLang()).toBe('auto');
        expect(getStoredContentLang()).toBe('auto');
    });
});
