/**
 * DEK 密钥缓存与去重
 *
 * `getKey()` 会缓存首次请求结果；并发调用共享同一 promise，避免多次
 * 撞 `/zukan/key`。401 / 403 由调用方（`resourceManager`、`EncryptedSprite`）
 * 判断后 `clearKeyCache()` + 重试。
 */
import { fetchKey } from '@/services/api/zukanKey';
import type { DekResponse } from './types';

let keyCache: DekResponse | null = null;
let keyPromise: Promise<DekResponse> | null = null;

/**
 * 获取 DEK 密钥；模块级 `keyPromise` 去重并发调用。
 * 401/403 需要调用方 `clearKeyCache()` 后重试。
 */
export function getKey(): Promise<DekResponse> {
    if (keyCache) return Promise.resolve(keyCache);
    if (keyPromise) return keyPromise;

    keyPromise = fetchKey().then((res) => {
        keyCache = res;
        return res;
    });

    // 请求失败时清理 keyPromise，允许下次重试（保留原 promise 供当前调用者 reject）
    keyPromise.catch(() => {
        keyPromise = null;
    });

    return keyPromise;
}

/**
 * 清空密钥缓存。401/403 恢复路径调用；下次 `getKey()` 会重新请求。
 */
export function clearKeyCache(): void {
    keyCache = null;
    keyPromise = null;
}
