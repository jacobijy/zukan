/**
 * 加密资源加载栈
 *
 * - `resourceManager` FB bundle 三层缓存（memory / storage / network）
 * - `spriteCache` 宝可梦立绘 Blob URL 共享缓存（引用计数 + 并发调度 / 离屏取消）
 * - `spritePersist` 宝可梦立绘密文跨刷新缓存（IndexedDB；`spriteCache` 内部消费）
 * - `itemImage` 道具图标加密资源（与 sprite 同一套引擎的 item 实例）
 * - `buildCdnUrl` 签 URL
 * - `dataVersion` KV 版本号
 */
export { resourceManager } from './resourceManager';

export {
    acquireSprite,
    releaseSprite,
    clearSpriteCache,
    spriteCacheStats,
    SpriteAbortError,
    isSpriteAbortError,
} from './spriteCache';

export { spritePersistStats } from './spritePersist';

export { acquireItemIcon, releaseItemIcon, clearItemIconCache, pruneItemIconVersions } from './itemImage';

export { buildCdnUrl } from './cdn';

export { getStoredDataVersion, setStoredDataVersion, currentDataVersion } from './dataVersion';
