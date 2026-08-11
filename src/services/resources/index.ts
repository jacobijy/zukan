/**
 * 加密资源加载栈
 *
 * - `resourceManager` FB bundle 三层缓存（memory / storage / network）
 * - `spriteCache` sprite Blob URL 共享缓存（引用计数 + 并发调度 / 离屏取消）
 * - `spritePersist` sprite 密文跨刷新缓存（IndexedDB；`spriteCache` 内部消费）
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

export { buildCdnUrl } from './cdn';

export { getStoredDataVersion, setStoredDataVersion, currentDataVersion } from './dataVersion';
