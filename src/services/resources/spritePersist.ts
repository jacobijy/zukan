/**
 * Sprite 密文持久化（跨刷新缓存）
 *
 * ## 为什么需要
 *
 * `spriteCache.ts` 只有内存 LRU（200 个 Blob URL）。刷新页面后内存清空，
 * 滚过的每一张都要重下 + 重解密。HTTP 缓存救不了：
 * - `uni.request` 在 H5 上走 XHR + `responseType: 'arraybuffer'`
 * - CDN 签名 URL 带 `?sign=…&t=…`，`t` 每次签都不同 ⇒ URL 不同 ⇒ 必然 miss
 *
 * 所以照 `resourceManager` 的做法自己存一层，让 sprite 也变成
 * `内存 → 存储 → 网络` 三层。
 *
 * ## 存密文，不存明文
 *
 * 落盘的是 `fetchBinary` 拿到的 **ZKDX 密文**，不是解密后的 PNG。
 * 存明文等于把加密资源以明文形式留在用户磁盘上，加密链路就白搭了 ——
 * 谁都能从 IndexedDB 里把整套图导出来。代价是每次启动要重新解密（AES-GCM
 * 走 WASM，实测每张 sub-ms 量级），换来的是磁盘上没有可直接使用的图。
 *
 * ## 只在 IndexedDB 上启用
 *
 * 小程序端 `uni.setStorage` 总量约 10MB，上千张 sprite（每张 76–190 KB）
 * 塞进去会把 FB bundle 顶出配额 —— 主数据比图片重要得多。
 * 因此 `storageBackend !== 'idb'` 时本模块所有写入都是 no-op，读取恒 miss，
 * 行为退化回改动前（只有内存缓存），不影响正确性。
 *
 * ## 字节预算与淘汰
 *
 * IDB 没有「超额自动淘汰」，写满会让浏览器抛 QuotaExceededError 或直接
 * 清掉整个源的存储。所以自己记账：维护一份 key → 字节数的索引，
 * 超出 `MAX_BYTES` 时按**插入序**（近似 FIFO）删到预算内。
 *
 * 刻意用 FIFO 而不是 LRU：LRU 要每次读命中都写一次索引，把「读缓存」
 * 从 1 次 IDB 往返变成 2 次，而 sprite 的访问模式是「滚过一遍就不再回头」，
 * LRU 的收益本来就有限。
 *
 * ## 索引的一致性
 *
 * 索引与数据是两条独立写入，中间刷新（或崩溃）会不一致。两个方向都兜住了：
 * - 索引有、数据没有 ⇒ `loadSpriteBytes` 读到 null，按 miss 走网络，
 *   并把这条索引删掉（自愈）
 * - 数据有、索引没有 ⇒ 这些字节永远不会被预算算进去，也永不被淘汰（泄漏）。
 *   因此 `reconcile()` 在首次使用时拿 `keys()` 与索引对账，把孤儿数据删掉。
 */

import { binaryStorage, storageBackend } from '@/infra/storage/binaryStorage';
import { currentDataVersion } from '@/services/resources/dataVersion';

/** 所有 sprite 密文 key 的公共前缀（不含版本），用于跨版本清理 */
export const SPRITE_KEY_ROOT = 'sprite:';

/** 索引存 key。用 uni storage 而不是 IDB —— 它小、要同步读、且与数据分开生命周期。 */
const INDEX_STORAGE_KEY = 'zukan_sprite_index';

/**
 * 磁盘预算。1025 个默认形态 × 约 130 KB ≈ 130 MB，全存下来太多；
 * 60 MB 约能装 460 张，够覆盖用户实际反复浏览的那部分。
 */
const MAX_BYTES = 60 * 1024 * 1024;

/** 索引落盘防抖：滚动时会连续写入几十条，逐条同步写 storage 会卡主线程 */
const FLUSH_DELAY_MS = 500;

interface SpriteIndex {
    /** 版本号。与 `currentDataVersion()` 不符时整份索引作废（DEK 轮换 / schema 变更） */
    v: number;
    /** key → 字节数。JS 对象保持插入序（字符串 key 非整数形态），即淘汰序 */
    e: Record<string, number>;
}

let index: SpriteIndex | null = null;
let totalBytes = 0;
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let reconciled = false;

/** 本模块是否生效。非 IDB 后端全程 no-op，见文件头。 */
function enabled(): boolean {
    return storageBackend === 'idb';
}

export function spriteStorageKey(pokemonId: number, variant: string): string {
    return `${SPRITE_KEY_ROOT}v${currentDataVersion()}:${pokemonId}/${variant}`;
}

// ─────────────────────────────────────────────────────────
// 索引读写
// ─────────────────────────────────────────────────────────

function emptyIndex(): SpriteIndex {
    return { v: currentDataVersion(), e: {} };
}

function recompute(): void {
    totalBytes = 0;
    if (!index) return;
    for (const size of Object.values(index.e)) totalBytes += size;
}

/**
 * 懒加载索引。版本不符或解析失败时重置为空 —— 宁可当成空缓存重下，
 * 也不能拿旧版本的字节去喂新 DEK（解密必然失败，白跑一轮重试）。
 */
function loadIndex(): SpriteIndex {
    if (index) return index;

    try {
        const raw = uni.getStorageSync(INDEX_STORAGE_KEY) as unknown;
        const parsed = (typeof raw === 'string' && raw ? JSON.parse(raw) : raw) as SpriteIndex | undefined;
        if (parsed && parsed.v === currentDataVersion() && parsed.e && typeof parsed.e === 'object') {
            index = { v: parsed.v, e: parsed.e };
        } else {
            index = emptyIndex();
        }
    } catch {
        index = emptyIndex();
    }

    recompute();
    return index;
}

function flushIndex(): void {
    if (flushTimer) {
        clearTimeout(flushTimer);
        flushTimer = null;
    }
    if (!index) return;
    try {
        uni.setStorageSync(INDEX_STORAGE_KEY, JSON.stringify(index));
    } catch (err) {
        // 写不进去只是下次启动少认几条缓存（数据仍在 IDB，由 reconcile 收走），
        // 不该让调用方的图挂掉
        console.warn('[spritePersist] 索引写入失败', err);
    }
}

function scheduleFlush(): void {
    if (flushTimer) return;
    flushTimer = setTimeout(() => {
        flushTimer = null;
        flushIndex();
    }, FLUSH_DELAY_MS);
}

// ─────────────────────────────────────────────────────────
// 对账
// ─────────────────────────────────────────────────────────

/**
 * 与实际落盘的 key 对账，删掉索引里没有的孤儿数据。
 *
 * 只跑一次，且刻意**不 await** —— 挡在首张图前面会白等一次 `getAllKeys`。
 * 孤儿多活几秒无所谓，它们唯一的害处是不占预算却占磁盘。
 */
function reconcile(): void {
    if (reconciled || !enabled()) return;
    reconciled = true;

    void (async () => {
        try {
            const idx = loadIndex();
            const all = await binaryStorage.keys(SPRITE_KEY_ROOT);
            const orphans = all.filter((k) => !(k in idx.e));
            if (orphans.length === 0) return;
            await Promise.all(orphans.map((k) => binaryStorage.delete(k).catch(() => {})));
        } catch (err) {
            console.warn('[spritePersist] 对账失败', err);
        }
    })();
}

// ─────────────────────────────────────────────────────────
// 淘汰
// ─────────────────────────────────────────────────────────

/**
 * 删到预算内。按索引插入序（近似 FIFO）取最旧的删。
 * 删除失败也把索引项摘掉：留着会让预算永久性地少一块，
 * 那条数据交给下次 `reconcile` 当孤儿收走。
 */
async function evictToBudget(): Promise<void> {
    const idx = loadIndex();
    const victims: string[] = [];

    for (const [key, size] of Object.entries(idx.e)) {
        if (totalBytes <= MAX_BYTES) break;
        victims.push(key);
        totalBytes -= size;
        delete idx.e[key];
    }

    if (victims.length === 0) return;
    flushIndex();
    await Promise.all(victims.map((k) => binaryStorage.delete(k).catch(() => {})));
}

// ─────────────────────────────────────────────────────────
// 公共 API
// ─────────────────────────────────────────────────────────

/**
 * 读取已缓存的 sprite 密文。miss / 未启用 / 出错都返回 null（调用方走网络）。
 *
 * 索引里有但盘上没有时把索引项删掉 —— 那是上次「写数据失败但索引写成功」
 * 或用户手动清了 IDB 留下的幽灵项。
 */
export async function loadSpriteBytes(pokemonId: number, variant: string): Promise<Uint8Array | null> {
    if (!enabled()) return null;
    reconcile();

    const key = spriteStorageKey(pokemonId, variant);
    const idx = loadIndex();
    if (!(key in idx.e)) return null;

    try {
        const bytes = await binaryStorage.get(key);
        if (bytes) return bytes;
        // 幽灵索引项：自愈
        totalBytes -= idx.e[key] ?? 0;
        delete idx.e[key];
        scheduleFlush();
        return null;
    } catch (err) {
        console.warn('[spritePersist] 读取失败，按 miss 处理', key, err);
        return null;
    }
}

/**
 * 缓存 sprite 密文。**必须传密文**，不是解密后的 PNG（见文件头）。
 *
 * 失败静默：持久化是纯优化，写不进去下次重下就好，不该影响当前这张图的显示。
 */
export async function saveSpriteBytes(pokemonId: number, variant: string, encrypted: Uint8Array): Promise<void> {
    if (!enabled()) return;

    const key = spriteStorageKey(pokemonId, variant);
    const idx = loadIndex();
    // 已有同 key（并发下载同一张 / 重试）：先扣掉旧账再记新的，避免重复计数
    if (key in idx.e) totalBytes -= idx.e[key] ?? 0;

    try {
        await binaryStorage.put(key, encrypted);
    } catch (err) {
        // 配额满或序列化失败。把索引项摘掉保持一致，下次访问按 miss 走网络。
        console.warn('[spritePersist] 写入失败，跳过持久化', key, err);
        if (key in idx.e) {
            delete idx.e[key];
            scheduleFlush();
        }
        return;
    }

    idx.e[key] = encrypted.byteLength;
    totalBytes += encrypted.byteLength;
    scheduleFlush();

    if (totalBytes > MAX_BYTES) await evictToBudget();
}

/**
 * 删除单张的缓存。`spriteCache` 在解密失败时调用 ——
 * 盘上那份可能是旧 DEK 加密的，留着会让每次刷新都重复一次「解密失败 → 重下」。
 */
export async function dropSpriteBytes(pokemonId: number, variant: string): Promise<void> {
    if (!enabled()) return;

    const key = spriteStorageKey(pokemonId, variant);
    const idx = loadIndex();
    if (key in idx.e) {
        totalBytes -= idx.e[key] ?? 0;
        delete idx.e[key];
        scheduleFlush();
    }
    await binaryStorage.delete(key).catch(() => {});
}

/**
 * 清理**除 `keepVersion` 外**所有版本的 sprite 密文与索引。
 * 由 `resourceManager.pruneOtherVersions`（版本升级）调用，与 FB bundle 同一时机 ——
 * 两者的版本前缀必须同步失效，否则 DEK 轮换后一方清了另一方没清。
 *
 * 注意 `clearSpriteCache()`（登出）**不**调这里：磁盘上是密文，
 * 没有密钥解不开，留着不构成泄露，而下个用户登录后还能直接命中。
 *
 * 索引直接按 `keepVersion` 重置，不用 `currentDataVersion()` ——
 * 调用点在 `setStoredDataVersion` **之前**，那时读到的还是旧版本号。
 */
export async function pruneSpriteVersions(keepVersion: number): Promise<void> {
    const keepPrefix = `${SPRITE_KEY_ROOT}v${keepVersion}:`;

    // 索引整份作废：它只记一个版本，而留下来的那个版本的条目要靠 reconcile 重建。
    // 直接置空 + 允许再对账一次，孤儿会被收走。
    index = { v: keepVersion, e: {} };
    totalBytes = 0;
    reconciled = false;
    flushIndex();

    if (!enabled()) return;
    try {
        const all = await binaryStorage.keys(SPRITE_KEY_ROOT);
        const stale = all.filter((k) => !k.startsWith(keepPrefix));
        await Promise.all(stale.map((k) => binaryStorage.delete(k).catch(() => {})));
    } catch (err) {
        console.warn('[spritePersist] 清理旧版本失败', err);
    }
}

export function spritePersistStats(): {
    enabled: boolean;
    entries: number;
    bytes: number;
    maxBytes: number;
} {
    const idx = enabled() ? loadIndex() : null;
    return {
        enabled: enabled(),
        entries: idx ? Object.keys(idx.e).length : 0,
        bytes: idx ? totalBytes : 0,
        maxBytes: MAX_BYTES,
    };
}
