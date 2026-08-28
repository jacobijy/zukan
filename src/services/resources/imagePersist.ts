/**
 * 加密图片密文持久化工厂（跨刷新缓存）。
 *
 * 由原 `spritePersist.ts` 泛化而来：宝可梦立绘与道具图标共用同一套
 * 「内存 → 存储 → 网络」三层中的存储层，差别只有 key 前缀 / 索引 key /
 * 磁盘预算，由 `ImageKindSpec` 注入。`spritePersist.ts` 现在是基于本工厂的
 * 薄封装（pokemon 种类），对外名字与签名不变。
 *
 * ## 为什么需要
 *
 * `imageCache.ts` 只有内存 LRU。刷新页面后内存清空，滚过的每张图都要重下 +
 * 重解密。HTTP 缓存救不了：
 * - `uni.request` 在 H5 上走 XHR + `responseType: 'arraybuffer'`
 * - CDN 签名 URL 带 `?sign=…&t=…`，`t` 每次签都不同 ⇒ URL 不同 ⇒ 必然 miss
 *
 * ## 存密文，不存明文
 *
 * 落盘的是 `fetchBinary` 拿到的 **ZKDX 密文**，不是解密后的图片。
 * 存明文等于把加密资源以明文形式留在用户磁盘上，加密链路就白搭了 ——
 * 谁都能从 IndexedDB 里把整套图导出来。代价是每次启动要重新解密（AES-GCM
 * 走 WASM，实测每张 sub-ms 量级），换来磁盘上没有可直接使用的图。
 *
 * ## 只在 IndexedDB 上启用
 *
 * 小程序端 `uni.setStorage` 总量约 10MB，上千张图塞进去会把 FB bundle 顶出
 * 配额 —— 主数据比图片重要得多。因此 `storageBackend !== 'idb'` 时所有写入
 * 都是 no-op，读取恒 miss，行为退化回「只有内存缓存」，不影响正确性。
 *
 * ## 字节预算与淘汰
 *
 * IDB 没有「超额自动淘汰」，写满会让浏览器抛 QuotaExceededError 或直接清掉
 * 整个源的存储。所以自己记账：维护一份 key → 字节数的索引，超出 `maxBytes`
 * 时按**插入序**（近似 FIFO）删到预算内。
 *
 * 刻意用 FIFO 而不是 LRU：LRU 要每次读命中都写一次索引，把「读缓存」从 1 次
 * IDB 往返变成 2 次，而这类图的访问模式是「滚过一遍就不再回头」，LRU 收益有限。
 *
 * ## 索引的一致性
 *
 * 索引与数据是两条独立写入，中间刷新（或崩溃）会不一致。两个方向都兜住了：
 * - 索引有、数据没有 ⇒ `loadBytes` 读到 null，按 miss 走网络，并删掉这条索引（自愈）
 * - 数据有、索引没有 ⇒ 这些字节永远不被预算计入、永不淘汰（泄漏）。
 *   因此 `reconcile()` 首次使用时拿 `keys()` 与索引对账，删掉孤儿数据。
 */

import { binaryStorage, storageBackend } from '@/infra/storage/binaryStorage';
import { currentDataVersion } from '@/services/resources/dataVersion';
import type { ImageKindSpec } from '@/services/resources/imageKind';

/** 索引落盘防抖：滚动时会连续写入几十条，逐条同步写 storage 会卡主线程 */
const FLUSH_DELAY_MS = 500;

interface ImageIndex {
    /** 版本号。与 `currentDataVersion()` 不符时整份索引作废（DEK 轮换 / schema 变更） */
    v: number;
    /** key → 字节数。JS 对象保持插入序（字符串 key 非整数形态），即淘汰序 */
    e: Record<string, number>;
}

export interface ImagePersist {
    /** key 前缀（不含版本），跨版本清理按此圈定范围 */
    readonly root: string;
    storageKey: (id: number, variant: string) => string;
    loadBytes: (id: number, variant: string) => Promise<Uint8Array | null>;
    /** **必须传密文**，不是解密后的图片 */
    saveBytes: (id: number, variant: string, encrypted: Uint8Array) => Promise<void>;
    /** 删除单条缓存（解密失败时调用 —— 盘上那份可能是旧 DEK 加密的） */
    dropBytes: (id: number, variant: string) => Promise<void>;
    /** 清理除 `keepVersion` 外所有版本的密文与索引（版本升级时调用） */
    pruneVersions: (keepVersion: number) => Promise<void>;
    stats: () => { enabled: boolean; entries: number; bytes: number; maxBytes: number };
}

/** 持久化是否生效。非 IDB 后端全程 no-op，见文件头。 */
function isIdbBackend(): boolean {
    return storageBackend === 'idb';
}

function emptyIndex(): ImageIndex {
    return { v: currentDataVersion(), e: {} };
}

/**
 * 为一个图片种类创建持久层。每个种类拥有独立的索引 / 预算 / 对账状态，
 * 互不影响（道具图不会挤占宝可梦立绘的 60MB 预算）。
 */
export function createImagePersist(spec: ImageKindSpec, maxBytes: number): ImagePersist {
    const root = spec.persistRoot;
    const indexStorageKey = spec.indexStorageKey;

    let index: ImageIndex | null = null;
    let totalBytes = 0;
    let flushTimer: ReturnType<typeof setTimeout> | null = null;
    let reconciled = false;

    function storageKey(id: number, variant: string): string {
        // 前缀（root）已区隔种类，key 内不再带目录名 —— 保持 pokemon 的
        // `sprite:v<ver>:<id>/<variant>` 格式与历史缓存一致。
        return `${root}v${currentDataVersion()}:${id}${variant ? `/${variant}` : ''}`;
    }

    // ── 索引读写 ──────────────────────────────────────────────

    function recompute(): void {
        totalBytes = 0;
        if (!index) return;
        for (const size of Object.values(index.e)) totalBytes += size;
    }

    /**
     * 懒加载索引。版本不符或解析失败时重置为空 —— 宁可当成空缓存重下，
     * 也不能拿旧版本的字节去喂新 DEK（解密必然失败，白跑一轮重试）。
     */
    function loadIndex(): ImageIndex {
        if (index) return index;

        try {
            const raw = uni.getStorageSync(indexStorageKey) as unknown;
            const parsed = (typeof raw === 'string' && raw ? JSON.parse(raw) : raw) as ImageIndex | undefined;
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
            uni.setStorageSync(indexStorageKey, JSON.stringify(index));
        } catch (err) {
            // 写不进去只是下次启动少认几条缓存（数据仍在 IDB，由 reconcile 收走），
            // 不该让调用方的图挂掉
            console.warn('[imagePersist] 索引写入失败', root, err);
        }
    }

    function scheduleFlush(): void {
        if (flushTimer) return;
        flushTimer = setTimeout(() => {
            flushTimer = null;
            flushIndex();
        }, FLUSH_DELAY_MS);
    }

    // ── 对账 ──────────────────────────────────────────────────

    /**
     * 与实际落盘的 key 对账，删掉索引里没有的孤儿数据。
     *
     * 只跑一次，且刻意**不 await** —— 挡在首张图前面会白等一次 `getAllKeys`。
     * 孤儿多活几秒无所谓，它们唯一的害处是不占预算却占磁盘。
     */
    function reconcile(): void {
        if (reconciled || !isIdbBackend()) return;
        reconciled = true;

        void (async () => {
            try {
                const idx = loadIndex();
                const all = await binaryStorage.keys(root);
                const orphans = all.filter((k) => !(k in idx.e));
                if (orphans.length === 0) return;
                await Promise.all(orphans.map((k) => binaryStorage.delete(k).catch(() => {})));
            } catch (err) {
                console.warn('[imagePersist] 对账失败', root, err);
            }
        })();
    }

    // ── 淘汰 ──────────────────────────────────────────────────

    /**
     * 删到预算内。按索引插入序（近似 FIFO）取最旧的删。
     * 删除失败也把索引项摘掉：留着会让预算永久性地少一块，
     * 那条数据交给下次 `reconcile` 当孤儿收走。
     */
    async function evictToBudget(): Promise<void> {
        const idx = loadIndex();
        const victims: string[] = [];

        for (const [key, size] of Object.entries(idx.e)) {
            if (totalBytes <= maxBytes) break;
            victims.push(key);
            totalBytes -= size;
            delete idx.e[key];
        }

        if (victims.length === 0) return;
        flushIndex();
        await Promise.all(victims.map((k) => binaryStorage.delete(k).catch(() => {})));
    }

    // ── 公共 API ──────────────────────────────────────────────

    /**
     * 读取已缓存的密文。miss / 未启用 / 出错都返回 null（调用方走网络）。
     *
     * 索引里有但盘上没有时把索引项删掉 —— 那是上次「写数据失败但索引写成功」
     * 或用户手动清了 IDB 留下的幽灵项。
     */
    async function loadBytes(id: number, variant: string): Promise<Uint8Array | null> {
        if (!isIdbBackend()) return null;
        reconcile();

        const key = storageKey(id, variant);
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
            console.warn('[imagePersist] 读取失败，按 miss 处理', key, err);
            return null;
        }
    }

    /**
     * 缓存密文。**必须传密文**，不是解密后的图片（见文件头）。
     *
     * 失败静默：持久化是纯优化，写不进去下次重下就好，不该影响当前这张图的显示。
     */
    async function saveBytes(id: number, variant: string, encrypted: Uint8Array): Promise<void> {
        if (!isIdbBackend()) return;

        const key = storageKey(id, variant);
        const idx = loadIndex();
        // 已有同 key（并发下载同一张 / 重试）：先扣掉旧账再记新的，避免重复计数
        if (key in idx.e) totalBytes -= idx.e[key] ?? 0;

        try {
            await binaryStorage.put(key, encrypted);
        } catch (err) {
            // 配额满或序列化失败。把索引项摘掉保持一致，下次访问按 miss 走网络。
            console.warn('[imagePersist] 写入失败，跳过持久化', key, err);
            if (key in idx.e) {
                delete idx.e[key];
                scheduleFlush();
            }
            return;
        }

        idx.e[key] = encrypted.byteLength;
        totalBytes += encrypted.byteLength;
        scheduleFlush();

        if (totalBytes > maxBytes) await evictToBudget();
    }

    /**
     * 删除单条缓存。`imageCache` 在解密失败时调用 ——
     * 盘上那份可能是旧 DEK 加密的，留着会让每次刷新都重复一次「解密失败 → 重下」。
     */
    async function dropBytes(id: number, variant: string): Promise<void> {
        if (!isIdbBackend()) return;

        const key = storageKey(id, variant);
        const idx = loadIndex();
        if (key in idx.e) {
            totalBytes -= idx.e[key] ?? 0;
            delete idx.e[key];
            scheduleFlush();
        }
        await binaryStorage.delete(key).catch(() => {});
    }

    /**
     * 清理**除 `keepVersion` 外**所有版本的密文与索引。由
     * `resourceManager.pruneOtherVersions`（版本升级）调用，与 FB bundle 同一时机 ——
     * 两者的版本前缀必须同步失效，否则 DEK 轮换后一方清了另一方没清。
     *
     * 注意内存缓存的 `clear()`（登出）**不**调这里：磁盘上是密文，没有密钥解不开，
     * 留着不构成泄露，下个用户登录后还能直接命中。
     *
     * 索引直接按 `keepVersion` 重置，不用 `currentDataVersion()` ——
     * 调用点在 `setStoredDataVersion` **之前**，那时读到的还是旧版本号。
     */
    async function pruneVersions(keepVersion: number): Promise<void> {
        const keepPrefix = `${root}v${keepVersion}:`;

        // 索引整份作废：它只记一个版本，而留下来的那个版本的条目要靠 reconcile 重建。
        // 直接置空 + 允许再对账一次，孤儿会被收走。
        index = { v: keepVersion, e: {} };
        totalBytes = 0;
        reconciled = false;
        flushIndex();

        if (!isIdbBackend()) return;
        try {
            const all = await binaryStorage.keys(root);
            const stale = all.filter((k) => !k.startsWith(keepPrefix));
            await Promise.all(stale.map((k) => binaryStorage.delete(k).catch(() => {})));
        } catch (err) {
            console.warn('[imagePersist] 清理旧版本失败', root, err);
        }
    }

    function stats(): { enabled: boolean; entries: number; bytes: number; maxBytes: number } {
        const idx = isIdbBackend() ? loadIndex() : null;
        return {
            enabled: isIdbBackend(),
            entries: idx ? Object.keys(idx.e).length : 0,
            bytes: idx ? totalBytes : 0,
            maxBytes,
        };
    }

    return {
        root,
        storageKey,
        loadBytes,
        saveBytes,
        dropBytes,
        pruneVersions,
        stats,
    };
}
