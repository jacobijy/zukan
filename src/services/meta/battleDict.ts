/**
 * 对战数据 i18n 字典：按需加载 + module 级缓存 + 名称查表。
 *
 * 字典文件 `i18n/{pokemon,moves,abilities,items,natures}.json` 统一形状
 * `{ "<键>": { "name": { "<lang>": "<文本>" } } }`（pokemon 以 slug 为键并可能附 form）。
 * 体量较大（moves ~172K），加载结果留在 module scope 跨页面复用；缺译回落 `en` → 原始键。
 */
import { fetchAssetJson } from '@/services/http';
import type { BattleI18nEntry } from './types';

export type BattleDictCategory = 'pokemon' | 'moves' | 'abilities' | 'items' | 'natures';

export type BattleDict = Record<string, BattleI18nEntry>;

/** 字典文件路径：历史赛季带 `${season}/` 段，当前赛季（null / 空）沿用根路径。 */
function dictPath(season: string | null | undefined, category: BattleDictCategory): string {
    const suffix = `i18n/${category}.json`;
    return season ? `assets/battle/${season}/${suffix}` : `assets/battle/${suffix}`;
}

const dictPromises = new Map<string, Promise<BattleDict>>();

/** 加载（并缓存）某类字典；并发调用共享同一 promise。season 缺省 = 当前赛季。 */
export function ensureDict(category: BattleDictCategory, season?: string | null): Promise<BattleDict> {
    const key = `${season ?? ''}:${category}`;
    const cached = dictPromises.get(key);
    if (cached) return cached;
    const promise = fetchAssetJson<BattleDict>(dictPath(season, category));
    promise.catch(() => {
        dictPromises.delete(key);
    });
    dictPromises.set(key, promise);
    return promise;
}

/** 同步取条目名：当前语言 → en → 原始键。纯函数。 */
export function entryName(entry: BattleI18nEntry | undefined, lang: string, fallbackKey: string): string {
    if (!entry) return fallbackKey;
    return entry.name[lang] ?? entry.name.en ?? fallbackKey;
}

/** 同步取形态名：当前语言 → en；无形态返回 undefined。纯函数。 */
export function entryForm(entry: BattleI18nEntry | undefined, lang: string): string | undefined {
    if (!entry?.form) return undefined;
    return entry.form[lang] ?? entry.form.en ?? undefined;
}
