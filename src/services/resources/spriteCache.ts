/**
 * Sprite（宝可梦立绘）Blob URL 缓存 —— 通用加密图片引擎的 pokemon 实例。
 *
 * 限流调度 / 引用计数 / LRU / 离屏取消 / 三层缓存的实现已泛化到
 * `imageCache.ts`（`createImageCache` 工厂），道具图标共用同一套逻辑
 * （见 `itemImage.ts`）。本文件保留原有 sprite 命名与签名作为薄封装，
 * 历史用例（`tests/spriteCache.spec.ts`）与组件无需改动。
 *
 * 三条调度不变量（实现见 `imageCache.ts` 文件头）：
 * 1. **限流 4 并发** —— 不限流时几十个请求丢给浏览器 FIFO 排队，当前视口排在
 *    已划过去的行后面。
 * 2. **批内 FIFO，批间 LIFO** —— `batch` 每帧自增，取任务时 batch 最大优先、
 *    同批 seq 最小优先；纯 LIFO 首屏会「从下往上」冒，纯 FIFO 退回原 bug。
 * 3. **离屏取消** —— IntersectionObserver 不是一次性的，滑出视口要 abort 腾槽；
 *    多 waiter 时只有 waiters 归零才真取消，否则列表卡片卸载连累详情页。
 *
 * 持久层复用 `spritePersist` 的 pokemon 单例 —— load/save/drop 与版本清理
 * （`pruneSpriteVersions`）必须共享同一份内存索引状态。
 */
import { createImageCache, ImageAbortError, isImageAbortError } from '@/services/resources/imageCache';
import { imageKindSpec } from '@/services/resources/imageKind';
import { pokemonImagePersist } from '@/services/resources/spritePersist';

/**
 * 内存 LRU 条目上限。sprite 解密后是完整 PNG（实测 76–190 KB），200 条约
 * 20–30 MB，已是移动端可接受的上界。
 */
const MAX_ENTRIES = 200;

/**
 * 同时在途的 sprite 下载数。H5 单域 6 连接要留余量给 FB bundle；
 * 且解密是主线程同步的 WASM 调用，再高也排不开。
 */
const MAX_CONCURRENT = 4;

const engine = createImageCache('pokemon', imageKindSpec('pokemon'), pokemonImagePersist, {
    maxEntries: MAX_ENTRIES,
    maxConcurrent: MAX_CONCURRENT,
    // 中止错误用 SpriteAbortError，保持 `err instanceof SpriteAbortError`（历史用例与组件约定）
    abortError: (key) => new SpriteAbortError(key),
});

/** 调用方取消导致的中止。继承引擎的 ImageAbortError，`isSpriteAbortError` 通用。 */
export class SpriteAbortError extends ImageAbortError {}

export function isSpriteAbortError(err: unknown): boolean {
    return isImageAbortError(err);
}

export function spriteCacheKey(pokemonId: number, variant: string): string {
    return engine.cacheKey(pokemonId, variant);
}

/**
 * 取得 sprite 的 Blob URL 并登记一次引用。
 *
 * **调用方必须在不再使用时 `releaseSprite`**，否则该条目永不被淘汰（等价泄漏）。
 * 组件里配对写在 `onUnmounted` / props 变化处。传 `signal` 可在滑出视口 / 卸载时
 * 取消，取消时抛 `SpriteAbortError`，用 `isSpriteAbortError` 与真失败区分。
 */
export function acquireSprite(
    pokemonId: number,
    variant: string,
    options: { signal?: AbortSignal } = {},
): Promise<string> {
    return engine.acquire(pokemonId, variant, options);
}

/** 释放一次引用。归零后条目仍留缓存，真正 revoke 发生在 LRU 淘汰时。 */
export function releaseSprite(pokemonId: number, variant: string): void {
    engine.release(pokemonId, variant);
}

/**
 * 清空**内存**缓存并撤销所有 URL（登出 / DEK 轮换）。刻意不动磁盘密文 ——
 * 没 DEK 解不开不构成泄露，下次登录还能命中；版本升级走 `pruneSpriteVersions`。
 */
export function clearSpriteCache(): void {
    engine.clear();
}

/** 供测试与排障：条目数 / 引用总数 / 在途数 / 排队数 */
export function spriteCacheStats(): {
    entries: number;
    refs: number;
    inflight: number;
    queued: number;
    running: number;
} {
    return engine.stats();
}
