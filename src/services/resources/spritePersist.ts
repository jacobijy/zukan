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
 * 2. dev 内存后端 no-op；H5 走 IDB，小程序 / App 走 fs 后端（USER_DATA_PATH 存密文）。
 *    后端按 `spec.fsBackend` 由运行时分发，不在 import 期定型（见下文 MAX_BYTES）。
 * 3. 索引（uni storage）与数据是两条独立写入，双向自愈（幽灵项 / 孤儿）。
 * 4. `clearSpriteCache()`（登出）刻意不清磁盘 —— 密文没 DEK 解不开，版本升级走
 *    `pruneSpriteVersions`。
 */
import { createImagePersist } from '@/services/resources/imagePersist';
import { imageKindSpec } from '@/services/resources/imageKind';
import { hasFileSystemBackend } from '@/infra/storage/binaryStorage';
import { CACHE_CONFIG } from '@/constants/cacheConfig';

/**
 * 磁盘预算按后端取：fs（小程序 / App）共享 200MB 本地缓存额度，给 40MB；
 * IDB（H5）配额大得多，给 200MB 基本无感。
 *
 * 运行时判定，不在 import 期定型 —— 小程序端 `wx` 尚未就绪时会拿错后端。
 */
const MAX_BYTES = (hasFileSystemBackend() ? CACHE_CONFIG.fsBudgetMB : 200) * 1024 * 1024;

/** 图鉴前 N 号优先保留（见 imagePersist.ts）。fs 后端才需要，IDB 上淘汰压力小 */
const PROTECTED_ID_MAX = CACHE_CONFIG.protectedIdMax;

/**
 * pokemon 种类的持久层单例。`spriteCache` 复用同一实例（load/save/drop 与
 * 版本清理必须共享同一份内存索引状态），道具种类的单例在 `itemImage.ts`。
 *
 * 后端由 `spec.fsBackend` 决定（注入 `imageBinaryStorage`，运行时按平台
 * 分发 fs / IDB），不必在这里显式注入 —— 模块加载期定型会因 `wx` 未就绪
 * 而永久 no-op。
 */
export const pokemonImagePersist = createImagePersist(
    imageKindSpec('pokemon'),
    MAX_BYTES,
    undefined,
    PROTECTED_ID_MAX,
);

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
