/**
 * Sprite Blob URL 缓存（模块级共享 + 引用计数）
 *
 * ## 为什么需要这个模块
 *
 * 这套缓存原先写在 `EncryptedSprite.vue` 的 `<script setup>` 顶层。看着像模块级
 * 单例，实际编译后**落在 `setup()` 内部** —— 每个组件实例一份空 Map：
 *
 * ```js
 * setup(__props) {
 *   const decryptedCache = new Map();   // ← 每个实例独立
 * ```
 *
 * 后果是两个真实 bug：
 * 1. **缓存永不命中**：实例只查自己那一个 key，`MAX_CACHE` 淘汰逻辑从未触发，
 *    注释写的"全局共享"没有实现 —— 同一只宝可梦在列表和详情页各解密一次。
 * 2. **Blob URL 永久泄漏**：卸载时的守卫是 `if (!decryptedCache.has(cacheKey))`，
 *    而加载成功时刚 `set` 过这个 key，条件恒假 ⇒ `revokeObjectURL` 永不执行。
 *    每张卡片约 130 KB，滚完全表泄漏上百 MB。
 *
 * ## 引用计数
 *
 * 单纯"卸载就 revoke"是错的：同一只宝可梦可能同时被多个组件引用（列表 + 详情），
 * 撤销正在使用的 URL 会让其它组件的图变裂图。所以按 key 记引用数：
 *
 * ```
 * acquire → refs++              命中缓存直接复用，未命中走 inflight 去重
 * release → refs--              归零后仍留在 LRU 里等淘汰（下次访问秒开）
 * 淘汰    → refs === 0 才 revoke
 * ```
 *
 * `refs > 0` 的条目**不会**被淘汰 —— 它正显示在屏幕上，撤销即裂图。因此在屏
 * sprite 超过 `MAX_ENTRIES` 时缓存会短暂超出上限，这是有意的取舍。
 */

import { initWasm, decryptZukan } from '@/infra/wasm';
import { getKey, clearKeyCache } from '@/services/session';
import { fetchBinary, BinaryRequestError } from '@/services/http';
import { buildCdnUrl } from '@/services/resources/cdn';

/**
 * 缓存条目上限。sprite 解密后是完整 PNG（实测 76–190 KB），200 条约 20–30 MB，
 * 已是移动端可接受的上界。
 */
const MAX_ENTRIES = 200;

interface CacheEntry {
    url: string;
    /** 当前持有该 URL 的组件数；归零才允许 revoke */
    refs: number;
}

/** key → 条目。Map 的插入序即 LRU 序（命中时重新插入到末尾）。 */
const cache = new Map<string, CacheEntry>();

/** 进行中的解密。多个组件同时请求同一 sprite 时只下载 + 解密一次。 */
const inflight = new Map<string, Promise<string>>();

export function spriteCacheKey(pokemonId: number, variant: string): string {
    return `${pokemonId}/${variant}`;
}

/** LRU：命中后移到末尾 */
function touch(key: string, entry: CacheEntry): void {
    cache.delete(key);
    cache.set(key, entry);
}

/**
 * 淘汰到 `MAX_ENTRIES` 以内。只动 `refs === 0` 的条目 ——
 * 在屏的 URL 一旦 revoke，`<image>` 会立刻变裂图。
 */
function evictIfNeeded(): void {
    if (cache.size <= MAX_ENTRIES) return;

    for (const [key, entry] of cache) {
        if (cache.size <= MAX_ENTRIES) break;
        if (entry.refs > 0) continue;
        cache.delete(key);
        URL.revokeObjectURL(entry.url);
    }
}

/**
 * 下载 + 解密单个 sprite。
 * CDN 403（签名过期）时清 key 重签重下一次 —— 与 `resourceManager.fetchDecrypted`
 * 同一策略。
 */
async function fetchSpriteBytes(pokemonId: number, variant: string): Promise<Uint8Array> {
    const [, key] = await Promise.all([initWasm(), getKey()]);
    let { dek, cdn } = key;

    const remotePath = `/assets/encrypted/pokemon/${pokemonId}/${variant}.bin`;

    let encrypted: Uint8Array;
    try {
        encrypted = await fetchBinary(buildCdnUrl(remotePath, cdn));
    } catch (err) {
        if (err instanceof BinaryRequestError && err.statusCode === 403) {
            clearKeyCache();
            const fresh = await getKey();
            dek = fresh.dek;
            cdn = fresh.cdn;
            encrypted = await fetchBinary(buildCdnUrl(remotePath, cdn));
        } else {
            throw err;
        }
    }

    return decryptZukan(encrypted, dek);
}

/**
 * 取得 sprite 的 Blob URL 并登记一次引用。
 *
 * **调用方必须在不再使用时调用 `releaseSprite(key)`**，否则该条目永不被淘汰
 * （等价于泄漏）。组件里配对写在 `onUnmounted` / props 变化处。
 */
export async function acquireSprite(pokemonId: number, variant: string): Promise<string> {
    const key = spriteCacheKey(pokemonId, variant);

    const hit = cache.get(key);
    if (hit) {
        hit.refs += 1;
        touch(key, hit);
        return hit.url;
    }

    let pending = inflight.get(key);
    if (!pending) {
        pending = (async () => {
            const bytes = await fetchSpriteBytes(pokemonId, variant);
            // 解密结果是完整 PNG 字节
            return URL.createObjectURL(new Blob([bytes], { type: 'image/png' }));
        })();

        inflight.set(key, pending);
        // 无论成败都要清理，否则失败后会一直复用已 reject 的 promise
        pending
            .catch(() => undefined)
            .then(() => {
                if (inflight.get(key) === pending) inflight.delete(key);
            });
    }

    const url = await pending;

    // 并发 await 同一 promise 的调用方拿到的是同一个 url，
    // 因此这里只需登记引用，不会重复 createObjectURL。
    const entry = cache.get(key) ?? { url, refs: 0 };
    entry.refs += 1;
    touch(key, entry);
    evictIfNeeded();

    return entry.url;
}

/**
 * 释放一次引用。归零后条目**仍留在缓存**里（下次访问秒开），
 * 真正的 `revokeObjectURL` 发生在被 LRU 淘汰时。
 */
export function releaseSprite(pokemonId: number, variant: string): void {
    const entry = cache.get(spriteCacheKey(pokemonId, variant));
    if (entry && entry.refs > 0) entry.refs -= 1;
}

/** 清空缓存并撤销所有 URL。登出 / DEK 轮换时调用。 */
export function clearSpriteCache(): void {
    for (const entry of cache.values()) {
        URL.revokeObjectURL(entry.url);
    }
    cache.clear();
    inflight.clear();
}

/** 供测试与排障：当前条目数 / 引用总数 / 进行中请求数 */
export function spriteCacheStats(): { entries: number; refs: number; inflight: number } {
    let refs = 0;
    for (const entry of cache.values()) refs += entry.refs;
    return { entries: cache.size, refs, inflight: inflight.size };
}
