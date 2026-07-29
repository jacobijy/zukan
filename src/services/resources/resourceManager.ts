/**
 * 资源下载管理器
 *
 * 从 zukan-server 按需下载 ZKDX 加密的 FlatBuffers bundle，
 * 跨平台缓存加密字节，解密 + 解码后缓存解码结果到内存。
 *
 * ## 数据流
 * ```
 * memoryCache → inflight → binaryStorage → fetchBinary → decryptZukan → decode*Bundle
 * ```
 *
 * ## 错误 & 缓存失效
 * - 网络错误 / 5xx：`fetchBinary` 内部重试 1 次
 * - `/zukan/key` 401：清空密钥缓存后重试一次
 * - 存储读损坏 / 解密失败 / 解码 fid 不匹配：删除该 key 缓存后重下重解一次
 *
 * ## 版本
 * 缓存 key 前缀 `fb:v{N}` 里的 `N` 来自服务端 `GET /zukan/key.version`，
 * 由 `boot.ts` 在启动时写入 `dataVersion` 存储。版本升级时 `pruneOtherVersions`
 * 主动删旧字节；`FB_ASSET_VERSION` 只是首次启动前的兜底值。
 */

import {
    initWasm,
    decryptZukan,
    decodePokemonGenBundle,
    decodePokemonVgMovesBundle,
    decodePokemonMovesBundle,
    decodeMovesDataBundle,
    type PokemonGenBundle,
    type PokemonVgMovesBundle,
    type PokemonMovesBundle,
    type MovesDataBundle,
} from '@/infra/wasm';
import { fetchBinary, BinaryRequestError, RestRequestError } from '@/services/http';
import { getKey, clearKeyCache } from '@/services/session/key';
import { buildCdnUrl } from '@/services/resources/cdn';
import { getStoredDataVersion } from '@/services/resources/dataVersion';
import { binaryStorage } from '@/infra/storage/binaryStorage';

// ─────────────────────────────────────────────────────────
// 常量与类型
// ─────────────────────────────────────────────────────────

/** WASM schema / ZKDX 格式变更时手动 bump（一并 bump WASM 版本），作为 boot 未完成前的兜底 */
const FB_ASSET_VERSION = 1;

/** 内存解码结果 LRU 上限（bundle 体积较大，条数保守） */
const MEMORY_LRU_CAP = 12;

type PokemonMovesKind = 'common' | 'mainline' | 'special';
type MovesDataKind = 'common' | 'vg';

interface ResourceStats {
    memoryEntries: number;
    inflight: number;
    /** 尽力枚举；MP 通过 getStorageInfo，H5 通过 IDB getAllKeys */
    persistedKeys: string[];
}

// ─────────────────────────────────────────────────────────
// 私有状态
// ─────────────────────────────────────────────────────────

const memoryCache = new Map<string, unknown>();
const inflight = new Map<string, Promise<unknown>>();

// ─────────────────────────────────────────────────────────
// 工具函数
// ─────────────────────────────────────────────────────────

const pad2 = (n: number): string => String(n).padStart(2, '0');

/**
 * 缓存 key 前缀基于**服务端下发**的资源版本运行时派生：
 * - 已 boot：使用 `zukan_data_version` 里的值
 * - 未 boot / 老后端未下发：兜底到 `FB_ASSET_VERSION`
 * 版本变化时 `boot.ts` 调用 `pruneOtherVersions` 清旧字节；此处只负责 key 生成。
 */
function currentCacheKeyPrefix(): string {
    const v = getStoredDataVersion() ?? FB_ASSET_VERSION;
    return `fb:v${v}`;
}

function memGet<T>(key: string): T | null {
    if (!memoryCache.has(key)) return null;
    const v = memoryCache.get(key)!;
    // LRU: 命中后移到末尾
    memoryCache.delete(key);
    memoryCache.set(key, v);
    return v as T;
}

function memSet(key: string, val: unknown): void {
    if (memoryCache.has(key)) memoryCache.delete(key);
    memoryCache.set(key, val);
    while (memoryCache.size > MEMORY_LRU_CAP) {
        const oldest = memoryCache.keys().next().value;
        if (oldest == null) break;
        memoryCache.delete(oldest);
    }
}

function assertVgId(kind: string, vgId: number | undefined): asserts vgId is number {
    if (typeof vgId !== 'number' || !Number.isFinite(vgId)) {
        throw new Error(`vgId required for kind='${kind}'`);
    }
}

// ─────────────────────────────────────────────────────────
// 核心加载器
// ─────────────────────────────────────────────────────────

interface BundleSpec {
    cacheKey: string;
    remotePath: string;
}

async function fetchDecrypted(spec: BundleSpec, allowKeyRetry = true): Promise<Uint8Array> {
    // 1. 存储命中？
    let bytes: Uint8Array | null = null;
    try {
        bytes = await binaryStorage.get(spec.cacheKey);
    } catch (err) {
        console.warn('[resourceManager] 存储读取失败，按 miss 处理', spec.cacheKey, err);
    }

    // 2. WASM 与密钥（含 CDN token）并发准备 —— 密钥要先到位才能签 URL
    let dek: string;
    let cdn: Awaited<ReturnType<typeof getKey>>['cdn'];
    try {
        const [, key] = await Promise.all([initWasm(), getKey()]);
        dek = key.dek;
        cdn = key.cdn;
    } catch (err) {
        // 密钥 401 恢复：清缓存后重试一次。
        // `getKey` 走 rest 客户端抛 RestRequestError；
        // `fetchBinary` 走 BinaryRequestError（预留兼容，虽然此 try 只覆盖 getKey）。
        const is401 =
            (err instanceof RestRequestError && err.statusCode === 401) ||
            (err instanceof BinaryRequestError && err.statusCode === 401);
        if (allowKeyRetry && is401) {
            clearKeyCache();
            const [, key] = await Promise.all([initWasm(), getKey()]);
            dek = key.dek;
            cdn = key.cdn;
        } else {
            throw err;
        }
    }

    // 3. miss：远程下载并写回。CDN 403（签名过期 / 非法）时清 key 重签重下一次。
    if (!bytes) {
        try {
            bytes = await fetchBinary(buildCdnUrl(spec.remotePath, cdn));
        } catch (err) {
            if (allowKeyRetry && err instanceof BinaryRequestError && err.statusCode === 403) {
                clearKeyCache();
                const key = await getKey();
                dek = key.dek;
                cdn = key.cdn;
                bytes = await fetchBinary(buildCdnUrl(spec.remotePath, cdn));
            } else {
                throw err;
            }
        }
        try {
            await binaryStorage.put(spec.cacheKey, bytes);
        } catch (err) {
            // MP 端 quota 已在 storage 内部静默；此处兜底
            console.warn('[resourceManager] 存储写入失败', spec.cacheKey, err);
        }
    }

    // 4. 解密
    return decryptZukan(bytes, dek);
}

/**
 * 通用加载路径。dedup 通过 `inflight` map；解密/解码失败自动重试一次
 * （覆盖缓存过期 / schema drift）。
 */
async function loadBundle<T>(spec: BundleSpec, decoder: (u8: Uint8Array) => T): Promise<T> {
    // 内存命中
    const mem = memGet<T>(spec.cacheKey);
    if (mem != null) return mem;

    // in-flight 去重
    const existing = inflight.get(spec.cacheKey) as Promise<T> | undefined;
    if (existing) return existing;

    const p = (async (): Promise<T> => {
        try {
            const decrypted = await fetchDecrypted(spec);
            return decoder(decrypted);
        } catch (err) {
            // 缓存字节可能已过期（DEK 轮换 / schema drift）—— 清 key 后重下重解一次
            console.warn('[resourceManager] 首次解密/解码失败，尝试重下', spec.cacheKey, err);
            try {
                await binaryStorage.delete(spec.cacheKey);
            } catch {
                // ignore
            }
            const decrypted = await fetchDecrypted(spec, false);
            return decoder(decrypted);
        }
    })();

    inflight.set(spec.cacheKey, p);
    try {
        const result = await p;
        memSet(spec.cacheKey, result);
        return result;
    } finally {
        inflight.delete(spec.cacheKey);
    }
}

// ─────────────────────────────────────────────────────────
// BundleSpec 构造
// ─────────────────────────────────────────────────────────

function specPokemonGen(genId: number): BundleSpec {
    return {
        cacheKey: `${currentCacheKeyPrefix()}:gen:${genId}`,
        remotePath: `/assets/encrypted/fb/gen-${genId}.bin`,
    };
}

function specVgMoves(vgId: number): BundleSpec {
    return {
        cacheKey: `${currentCacheKeyPrefix()}:vgmoves:${pad2(vgId)}`,
        remotePath: `/assets/encrypted/fb/moves/vg-${pad2(vgId)}.bin`,
    };
}

function specPokemonMoves(kind: PokemonMovesKind, vgId?: number): BundleSpec {
    if (kind === 'common') {
        return {
            cacheKey: `${currentCacheKeyPrefix()}:pmoves:common`,
            remotePath: `/assets/encrypted/fb/pokemon_moves/common.bin`,
        };
    }
    assertVgId(kind, vgId);
    const seg = kind === 'mainline' ? 'mainline' : 'special';
    return {
        cacheKey: `${currentCacheKeyPrefix()}:pmoves:${kind}:vg-${pad2(vgId)}`,
        remotePath: `/assets/encrypted/fb/pokemon_moves/${seg}/vg-${pad2(vgId)}.bin`,
    };
}

function specMovesData(kind: MovesDataKind, vgId?: number): BundleSpec {
    if (kind === 'common') {
        return {
            cacheKey: `${currentCacheKeyPrefix()}:mdata:common`,
            remotePath: `/assets/encrypted/fb/moves_data/common.bin`,
        };
    }
    assertVgId(kind, vgId);
    return {
        cacheKey: `${currentCacheKeyPrefix()}:mdata:vg-${pad2(vgId)}`,
        remotePath: `/assets/encrypted/fb/moves_data/vg-${pad2(vgId)}.bin`,
    };
}

// ─────────────────────────────────────────────────────────
// 公共 API
// ─────────────────────────────────────────────────────────

function silence<T>(p: Promise<T>, tag: string): void {
    p.catch((err) => console.warn(`[resourceManager] prefetch ${tag} 失败`, err));
}

export const resourceManager = {
    // ── 类型化 getter ──
    getPokemonGen(genId: number): Promise<PokemonGenBundle> {
        return loadBundle(specPokemonGen(genId), decodePokemonGenBundle);
    },
    getVgMoves(vgId: number): Promise<PokemonVgMovesBundle> {
        return loadBundle(specVgMoves(vgId), decodePokemonVgMovesBundle);
    },
    getPokemonMoves(kind: PokemonMovesKind, vgId?: number): Promise<PokemonMovesBundle> {
        return loadBundle(specPokemonMoves(kind, vgId), decodePokemonMovesBundle);
    },
    getMovesData(kind: MovesDataKind, vgId?: number): Promise<MovesDataBundle> {
        return loadBundle(specMovesData(kind, vgId), decodeMovesDataBundle);
    },

    // ── 预取（与 get* 共享 inflight 去重；错误静默） ──
    prefetchPokemonGen(genId: number): void {
        silence(this.getPokemonGen(genId), `gen-${genId}`);
    },
    prefetchVgMoves(vgId: number): void {
        silence(this.getVgMoves(vgId), `vgmoves-${pad2(vgId)}`);
    },
    prefetchPokemonMoves(kind: PokemonMovesKind, vgId?: number): void {
        silence(this.getPokemonMoves(kind, vgId), `pmoves-${kind}`);
    },
    prefetchMovesData(kind: MovesDataKind, vgId?: number): void {
        silence(this.getMovesData(kind, vgId), `mdata-${kind}`);
    },

    // ── 运维 ──
    async clear(): Promise<void> {
        memoryCache.clear();
        await binaryStorage.clear(currentCacheKeyPrefix());
    },
    /**
     * 清理**除 `keepVersion` 外**所有历史版本的字节缓存。
     * boot 流程发现服务端版本变化时调用；`keepVersion` 是即将写入 `dataVersion` 的新值。
     * 同时清空内存 LRU（跨版本的解码结果不能保留）。
     */
    async pruneOtherVersions(keepVersion: number): Promise<void> {
        const keepPrefix = `fb:v${keepVersion}`;
        const allFb = await binaryStorage.keys('fb:').catch(() => []);
        const stale = allFb.filter((k) => !(k === keepPrefix || k.startsWith(`${keepPrefix}:`)));
        await Promise.all(stale.map((k) => binaryStorage.delete(k).catch(() => {})));
        memoryCache.clear();
    },
    stats(): ResourceStats {
        return {
            memoryEntries: memoryCache.size,
            inflight: inflight.size,
            // 同步接口无法 await；调用方需要精确列表时可自行 `await binaryStorage.keys(...)`
            persistedKeys: [],
        };
    },
    /** 异步版本，包含持久化 key 列表 */
    async statsAsync(): Promise<ResourceStats> {
        const persistedKeys = await binaryStorage.keys(currentCacheKeyPrefix()).catch(() => []);
        return {
            memoryEntries: memoryCache.size,
            inflight: inflight.size,
            persistedKeys,
        };
    },
};
