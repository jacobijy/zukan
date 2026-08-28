/**
 * 道具图标加密资源 —— 通用加密图片管线的 item 实例。
 *
 * 道具图标和宝可梦立绘走**同一条**下载 / 解密 / 缓存通道：服务器上是
 * `encrypted-assets/items/<id>.bin`（ZKDX 密文，明文为 30×30 PNG，扁平结构、
 * 无 variant），经 `createImageCache` / `createImagePersist` 得到与 sprite 完全
 * 一致的限流调度 / 引用计数 / LRU / 离屏取消 / 三层缓存。
 *
 * 与 pokemon 实例相互独立：各自的 LRU、任务队列、并发槽、磁盘预算 / 索引，
 * 道具图不会挤占宝可梦立绘的缓存与配额。
 */
import { createImageCache } from '@/services/resources/imageCache';
import { createImagePersist } from '@/services/resources/imagePersist';
import { imageKindSpec } from '@/services/resources/imageKind';

/**
 * 磁盘预算。道具密文极小（单张约 200–400 字节，375 张合计不足 0.2 MB），
 * 预算给得宽裕也无妨；真正的上界是服务器上道具资源的数量。
 */
const MAX_BYTES = 8 * 1024 * 1024;

/** 内存 LRU 上限：道具列表虚拟化后同时挂载的行数有限，200 足够 */
const MAX_ENTRIES = 200;
/** 并发下载数，与 sprite 一致（H5 单域 6 连接要留余量给 FB bundle） */
const MAX_CONCURRENT = 4;

const itemPersist = createImagePersist(imageKindSpec('item'), MAX_BYTES);
const itemEngine = createImageCache('item', imageKindSpec('item'), itemPersist, {
    maxEntries: MAX_ENTRIES,
    maxConcurrent: MAX_CONCURRENT,
});

/** 道具图标无 variant 概念，统一用这个占位串（远端路径会忽略它） */
export const ITEM_VARIANT = 'icon';

/** 取得道具图标的 Blob URL 并登记一次引用；不用时必须 `releaseItemIcon` */
export function acquireItemIcon(itemId: number, options: { signal?: AbortSignal } = {}): Promise<string> {
    return itemEngine.acquire(itemId, ITEM_VARIANT, options);
}

/** 释放一次道具图标引用 */
export function releaseItemIcon(itemId: number): void {
    itemEngine.release(itemId, ITEM_VARIANT);
}

/** 清空道具图标的**内存**缓存（登出 / DEK 轮换）；不动磁盘密文 */
export function clearItemIconCache(): void {
    itemEngine.clear();
}

/** 供测试与排障：条目数 / 引用总数 / 在途数 / 排队数 */
export function itemIconStats(): {
    entries: number;
    refs: number;
    inflight: number;
    queued: number;
    running: number;
} {
    return itemEngine.stats();
}

/** 清理道具图标**磁盘**上除 `keepVersion` 外的所有版本密文（版本升级时调用） */
export function pruneItemIconVersions(keepVersion: number): Promise<void> {
    return itemPersist.pruneVersions(keepVersion);
}
