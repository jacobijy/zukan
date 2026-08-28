/**
 * Sprite（宝可梦立绘）密文持久化 —— 通用加密图片持久层的 pokemon 实例。
 *
 * 实现已泛化到 `imagePersist.ts`（`createImagePersist` 工厂），道具图标共用
 * 同一套逻辑（见 `itemImage.ts`）。本文件保留原有的 sprite 命名与签名作为薄封装，
 * 历史用例（`tests/spritePersist.spec.ts`）与 `resourceManager` 的版本清理调用
 * 无需改动。
 *
 * 不变量（详见 `imagePersist.ts` 文件头）：
 * 1. 落盘的是 ZKDX **密文**，不是解密后的 PNG。
 * 2. 只在 `storageBackend === 'idb'` 启用，小程序端全程 no-op。
 * 3. 索引（uni storage）与数据（IDB）是两条独立写入，双向自愈（幽灵项 / 孤儿）。
 * 4. `clearSpriteCache()`（登出）刻意不清磁盘 —— 密文没 DEK 解不开，版本升级走
 *    `pruneSpriteVersions`。
 */
import { createImagePersist } from '@/services/resources/imagePersist';
import { imageKindSpec } from '@/services/resources/imageKind';

const MAX_BYTES = 60 * 1024 * 1024;

/**
 * pokemon 种类的持久层单例。`spriteCache` 复用同一实例（load/save/drop 与
 * 版本清理必须共享同一份内存索引状态），道具种类的单例在 `itemImage.ts`。
 */
export const pokemonImagePersist = createImagePersist(imageKindSpec('pokemon'), MAX_BYTES);

/** 所有 sprite 密文 key 的公共前缀（不含版本），用于跨版本清理 */
export const SPRITE_KEY_ROOT = pokemonImagePersist.root;

export function spriteStorageKey(pokemonId: number, variant: string): string {
    return pokemonImagePersist.storageKey(pokemonId, variant);
}

export function loadSpriteBytes(pokemonId: number, variant: string): Promise<Uint8Array | null> {
    return pokemonImagePersist.loadBytes(pokemonId, variant);
}

export function saveSpriteBytes(pokemonId: number, variant: string, encrypted: Uint8Array): Promise<void> {
    return pokemonImagePersist.saveBytes(pokemonId, variant, encrypted);
}

export function dropSpriteBytes(pokemonId: number, variant: string): Promise<void> {
    return pokemonImagePersist.dropBytes(pokemonId, variant);
}

export function pruneSpriteVersions(keepVersion: number): Promise<void> {
    return pokemonImagePersist.pruneVersions(keepVersion);
}

export function spritePersistStats(): {
    enabled: boolean;
    entries: number;
    bytes: number;
    maxBytes: number;
} {
    return pokemonImagePersist.stats();
}
