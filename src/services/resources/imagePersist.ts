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
 * ## 启用条件
 *
 * dev 的内存后端（`storageBackend === 'memory'`）全程 no-op。其余平台启用：
 * - **有 fs 后端**（小程序 / App）：sprite 等标记 `fsBackend` 的种类用 fs
 *   （USER_DATA_PATH 存密文，200MB 额度，与本地缓存共享、不占 storage 的 10MB）。
 * - **只有 IDB**（H5）：所有种类走 `binaryStorage`（IndexedDB）。
 * - **`uniStorage`（10MB）不存图片** —— 那会把 FB bundle 顶出去。
 *
 * 后端选择按种类标记 `spec.fsBackend`，由 `imageBinaryStorage` **运行时**分发
 * （模块加载时 `wx` 可能未就绪，定型会永久 no-op）。
 *
 * 历史：本模块曾硬编码「仅 IDB 启用」，因为小程序的 `uni.setStorage` 只有 10MB，
 * 塞图片会顶出 FB bundle。改用 fs 后端后小程序也启用（见 `docs/caching/fs-backend-plan.md`）。
 *
 * ## 字节预算与淘汰
 *
 * IDB / fs 都没有「超额自动淘汰」，写满会让浏览器抛 QuotaExceededError 或直接清掉
 * 整个源的存储。所以自己记账：维护一份 key → 字节数的索引，超出 `maxBytes`
 * 时按**插入序**（近似 FIFO）删到预算内。
 *
 * 刻意用 FIFO 而不是 LRU：LRU 要每次读命中都写一次索引，把「读缓存」从 1 次
 * 存储往返变成 2 次，而这类图的访问模式是「滚过一遍就不再回头」，LRU 收益有限。
 * （fs 后端虽能用文件 mtime 免费拿到 LRU 效果，但那要给 `BinaryStorage` 接口
 * 加 stat、并在 3 个测试 mock 里都实现它，得不偿失 —— 保持插入序。）
 *
 * **保护集**：id ≤ `protectedIdMax` 的条目优先保留（首屏常用图鉴常驻），
 * 非保护项删完仍超预算才回落删保护项。0 表示不启用（H5 / 道具按 0 传）。
 *
 * ## 索引的一致性
 *
 * 索引与数据是两条独立写入，中间刷新（或崩溃）会不一致。两个方向都兜住了：
 * - 索引有、数据没有 ⇒ `loadBytes` 读到 null，按 miss 走网络，并删掉这条索引（自愈）
 * - 数据有、索引没有 ⇒ 这些字节永远不被预算计入、永不淘汰（泄漏）。
 *   因此 `reconcile()` 首次使用时拿 `keys()` 与索引对账，删掉孤儿数据。
 */

import {
    binaryStorage,
    storageBackend,
    hasFileSystemBackend,
    imageBinaryStorage,
    type BinaryStorage,
} from '@/infra/storage/binaryStorage';
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
    storageKey: (id: number | string, variant: string) => string;
    loadBytes: (id: number | string, variant: string) => Promise<Uint8Array | null>;
    /** **必须传密文**，不是解密后的图片 */
    saveBytes: (id: number | string, variant: string, encrypted: Uint8Array) => Promise<void>;
    /** 删除单条缓存（解密失败时调用 —— 盘上那份可能是旧 DEK 加密的） */
    dropBytes: (id: number | string, variant: string) => Promise<void>;
    /** 清理除 `keepVersion` 外所有版本的密文与索引（版本升级时调用） */
    pruneVersions: (keepVersion: number) => Promise<void>;
    stats: () => { enabled: boolean; entries: number; bytes: number; maxBytes: number };
}

function emptyIndex(): ImageIndex {
    return { v: currentDataVersion(), e: {} };
}

/**
 * 为一个图片种类创建持久层。每个种类拥有独立的索引 / 预算 / 对账状态，
 * 互不影响（道具图不会挤占宝可梦立绘的 60MB 预算）。
 *
 * 默认后端按种类标记 `spec.fsBackend` 选：开 fs 的注入 `imageBinaryStorage`
 * （运行时分发 fs / IDB，见该导出），其余用全局 `binaryStorage`（H5 的 IDB）。
 * FB bundle 仍走 `binaryStorage`，与图片持久层无关。
 *
 * `protectedIdMax`：id ≤ 此值的条目在淘汰时优先保留（首屏常用图鉴常驻）。
 * 仅 fs 后端实例传；H5 / 道具传 0 表示不启用（预算宽裕，淘汰压力小）。
 */
export function createImagePersist(
    spec: ImageKindSpec,
    maxBytes: number,
    store: BinaryStorage = spec.fsBackend ? imageBinaryStorage : binaryStorage,
    protectedIdMax: number = 0,
): ImagePersist {
    const root = spec.persistRoot;
    const indexStorageKey = spec.indexStorageKey;

    let index: ImageIndex | null = null;
    let totalBytes = 0;
    let flushTimer: ReturnType<typeof setTimeout> | null = null;
    let reconciled = false;

    /**
     * 持久化是否生效。两种情况 no-op：
     * - dev 内存后端（`storageBackend === 'memory'`）—— 明确不持久化；
     * - 当前平台既没有 fs 后端、也没有 IDB —— 此时只能靠 `uniStorage`
     *   （10MB），塞图片会把 FB bundle 顶出去，所以直接不启用。
     *
     * **运行期判定**（不缓存到模块加载时的快照）：`hasFileSystemBackend()`
     * 每次重查 `wx`，因为小程序端 `wx` 是运行时注入的全局，import 那一刻
     * 可能尚未就绪。
     */
    const isPersistable =
        storageBackend !== 'memory' && (hasFileSystemBackend() || storageBackend === 'idb');

    function storageKey(id: number | string, variant: string): string {
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
        if (reconciled || !isPersistable) return;
        reconciled = true;

        void (async () => {
            try {
                const idx = loadIndex();
                const all = await store.keys(root);
                const orphans = all.filter((k) => !(k in idx.e));
                if (orphans.length === 0) return;
                await Promise.all(orphans.map((k) => store.delete(k).catch(() => {})));
            } catch (err) {
                console.warn('[imagePersist] 对账失败', root, err);
            }
        })();
    }

    // ── 淘汰 ──────────────────────────────────────────────────

    /**
     * 解析 key 里的数字 id（`sprite:v1:123/front` → 123）用于保护集判断。
     * 取第一段冒号后的纯数字前缀；取不到或非有限数返回 -1（不保护）。
     */
    function keyId(key: string): number {
        const seg = key.split(':')[2] ?? '';
        const m = /^(\d+)/.exec(seg);
        return m ? Number(m[1]) : -1;
    }

    /**
     * 删到预算内。两阶段：先淘汰**非保护项**（id > protectedIdMax），
     * 非保护项删完仍超预算才回落到保护项。保护是「优先保留」而非「永不删」。
     *
     * 各阶段内按索引插入序（近似 FIFO）取最旧的删。fs 后端本可用文件 mtime 拿到
     * 更准的 LRU 序，但那要给 `BinaryStorage` 接口加 stat、并在 3 个测试 mock 里都
     * 实现它，得不偿失 —— 统一用插入序。删除失败也把索引项摘掉，
     * 那条数据交给下次 reconcile 当孤儿收走。
     */
    async function evictToBudget(): Promise<void> {
        const idx = loadIndex();
        const victims: string[] = [];

        // 候选按「保护与否」分两组，各自按淘汰序排；先排空非保护组。
        // protectedIdMax <= 0 表示不启用保护集，退化成纯插入序（近似 FIFO）。
        const candidates = Object.entries(idx.e);
        const unprotected =
            protectedIdMax > 0 ? candidates.filter(([k]) => keyId(k) > protectedIdMax) : candidates;
        const protectedSet =
            protectedIdMax > 0 ? candidates.filter(([k]) => keyId(k) <= protectedIdMax) : [];
        for (const group of [unprotected, protectedSet]) {
            for (const [key, size] of group) {
                if (totalBytes <= maxBytes) break;
                victims.push(key);
                totalBytes -= size;
                delete idx.e[key];
            }
            if (totalBytes <= maxBytes) break;
        }

        if (victims.length === 0) return;
        flushIndex();
        await Promise.all(victims.map((k) => store.delete(k).catch(() => {})));
    }

    // ── 公共 API ──────────────────────────────────────────────

    /**
     * 读取已缓存的密文。miss / 未启用 / 出错都返回 null（调用方走网络）。
     *
     * 索引里有但盘上没有时把索引项删掉 —— 那是上次「写数据失败但索引写成功」
     * 或用户手动清了 IDB 留下的幽灵项。
     */
    async function loadBytes(id: number | string, variant: string): Promise<Uint8Array | null> {
        if (!isPersistable) return null;
        reconcile();

        const key = storageKey(id, variant);
        const idx = loadIndex();
        if (!(key in idx.e)) return null;

        try {
            const bytes = await store.get(key);
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
    async function saveBytes(id: number | string, variant: string, encrypted: Uint8Array): Promise<void> {
        if (!isPersistable) return;

        const key = storageKey(id, variant);
        const idx = loadIndex();
        // 已有同 key（并发下载同一张 / 重试）：先扣掉旧账再记新的，避免重复计数
        if (key in idx.e) totalBytes -= idx.e[key] ?? 0;

        try {
            await store.put(key, encrypted);
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
    async function dropBytes(id: number | string, variant: string): Promise<void> {
        if (!isPersistable) return;

        const key = storageKey(id, variant);
        const idx = loadIndex();
        if (key in idx.e) {
            totalBytes -= idx.e[key] ?? 0;
            delete idx.e[key];
            scheduleFlush();
        }
        await store.delete(key).catch(() => {});
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

        if (!isPersistable) return;
        try {
            const all = await store.keys(root);
            const stale = all.filter((k) => !k.startsWith(keepPrefix));
            await Promise.all(stale.map((k) => store.delete(k).catch(() => {})));
        } catch (err) {
            console.warn('[imagePersist] 清理旧版本失败', root, err);
        }
    }

    function stats(): { enabled: boolean; entries: number; bytes: number; maxBytes: number } {
        const idx = isPersistable ? loadIndex() : null;
        return {
            enabled: isPersistable,
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
