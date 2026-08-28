/**
 * `src/services/resources/itemImage.ts` 用例
 *
 * 引擎（限流 / 引用计数 / LRU / 三层缓存）已由 `spriteCache.spec.ts` /
 * `spritePersist.spec.ts` 充分覆盖 —— 道具走的是同一个 `createImageCache` /
 * `createImagePersist`。这里只守道具这一侧的**接线**差异：
 *
 * 1. 远端路径是扁平的 `/assets/encrypted/items/<id>.bin`（无 variant 子目录，
 *    与 pokemon 的 `/pokemon/<id>/<variant>.bin` 不同）；
 * 2. 道具缓存与 sprite 相互独立（各自 LRU / 引用计数）；
 * 3. 服务器无该道具资源时抛 404（`BinaryRequestError`），组件据此回落占位盒，
 *    而不是当成中止 / 解密失败；
 * 4. 跨刷新密文缓存落在独立的 `item-img:` 前缀下，二次加载不走网络。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── 被 mock 的下游：不碰真实 WASM / 网络 / 密钥 ──
const fetchBinary = vi.fn();
const decryptZukan = vi.fn();
const getKey = vi.fn();
const clearKeyCache = vi.fn();

class FakeBinaryRequestError extends Error {
    statusCode?: number;
    aborted: boolean;
    constructor(message: string, statusCode?: number, aborted = false) {
        super(message);
        this.statusCode = statusCode;
        this.aborted = aborted;
    }
}

vi.mock('@/infra/wasm', () => ({
    initWasm: vi.fn().mockResolvedValue(undefined),
    decryptZukan: (...args: unknown[]) => decryptZukan(...args),
}));
vi.mock('@/services/session', () => ({
    getKey: () => getKey(),
    clearKeyCache: () => clearKeyCache(),
}));
vi.mock('@/services/http', () => ({
    fetchBinary: (...args: unknown[]) => fetchBinary(...args),
    BinaryRequestError: FakeBinaryRequestError,
}));
// 透传路径，便于直接断言远端 URL
vi.mock('@/services/resources/cdn', () => ({
    buildCdnUrl: (path: string) => path,
}));

// ── 内存版 binaryStorage（idb 后端）──
let backend: 'idb' | 'uni';
let disk: Map<string, Uint8Array>;

vi.mock('@/infra/storage/binaryStorage', () => ({
    get storageBackend() {
        return backend;
    },
    binaryStorage: {
        async get(key: string) {
            return disk.get(key) ?? null;
        },
        async put(key: string, data: Uint8Array) {
            disk.set(key, data);
        },
        async delete(key: string) {
            disk.delete(key);
        },
        async keys(prefix?: string) {
            return [...disk.keys()].filter((k) => !prefix || k.startsWith(prefix));
        },
    },
}));

let kv: Map<string, unknown>;
let urlSeq: number;

type ItemImageModule = typeof import('@/services/resources/itemImage');

async function freshModule(): Promise<ItemImageModule> {
    vi.resetModules();
    return import('@/services/resources/itemImage');
}

beforeEach(() => {
    backend = 'idb';
    disk = new Map();
    kv = new Map();
    urlSeq = 0;

    fetchBinary.mockReset().mockResolvedValue(new Uint8Array([1, 2, 3]));
    decryptZukan.mockReset().mockReturnValue(new Uint8Array([4, 5, 6]));
    getKey.mockReset().mockResolvedValue({ dek: 'deadbeef', cdn: undefined });
    clearKeyCache.mockReset();

    vi.stubGlobal('uni', {
        getStorageSync: (key: string) => kv.get(key) ?? '',
        setStorageSync: (key: string, value: unknown) => {
            kv.set(key, value);
        },
    });
    vi.stubGlobal('URL', {
        createObjectURL: () => {
            urlSeq += 1;
            return `blob:mock/${urlSeq}`;
        },
        revokeObjectURL: () => {},
    });
    vi.stubGlobal('Blob', class {
        constructor(readonly parts: unknown[]) {}
    });
});

afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
});

describe('远端路径', () => {
    it('道具走扁平的 /assets/encrypted/items/<id>.bin（无 variant 子目录）', async () => {
        const mod = await freshModule();
        await mod.acquireItemIcon(42);

        const calledUrl = fetchBinary.mock.calls[0]![0] as string;
        expect(calledUrl).toBe('/assets/encrypted/items/42.bin');
        expect(calledUrl).not.toContain('/pokemon/');
    });
});

describe('缓存与引用计数', () => {
    it('同一道具第二次取用不重复下载解密', async () => {
        const { acquireItemIcon } = await freshModule();

        await acquireItemIcon(7);
        await acquireItemIcon(7);

        expect(fetchBinary).toHaveBeenCalledTimes(1);
        expect(decryptZukan).toHaveBeenCalledTimes(1);
    });

    it('release 后引用归零但条目仍缓存，再取用命中缓存', async () => {
        const mod = await freshModule();

        const url = await mod.acquireItemIcon(7);
        mod.releaseItemIcon(7);
        expect(mod.itemIconStats()).toMatchObject({ entries: 1, refs: 0 });
        expect(await mod.acquireItemIcon(7)).toBe(url);
        expect(fetchBinary).toHaveBeenCalledTimes(1);
    });
});

describe('404 回落', () => {
    it('服务器无该道具资源时抛 BinaryRequestError(404)，不是中止错误', async () => {
        const mod = await freshModule();
        fetchBinary.mockRejectedValueOnce(new FakeBinaryRequestError('not found', 404));

        await expect(mod.acquireItemIcon(9999)).rejects.toMatchObject({ statusCode: 404 });
        // 失败不留引用 / 不留缓存条目
        const stats = mod.itemIconStats();
        expect(stats.entries).toBe(0);
        expect(stats.refs).toBe(0);
    });
});

describe('跨刷新密文缓存', () => {
    it('首次下载落盘 item-img: 前缀；重置模块后二次加载不走网络', async () => {
        vi.useFakeTimers();
        const first = await freshModule();
        await first.acquireItemIcon(99);
        // 索引落盘是防抖的（滚动时连续写几十条），推进 500ms+ 让它刷盘
        await vi.advanceTimersByTimeAsync(600);

        // 密文落盘，且用独立前缀（不与 sprite: 混）
        const keys = [...disk.keys()];
        expect(keys.some((k) => k.startsWith('item-img:v1:99'))).toBe(true);
        expect(keys.some((k) => k.startsWith('sprite:'))).toBe(false);

        // 模拟刷新：模块内存缓存清空，但磁盘密文 + 索引还在
        fetchBinary.mockClear();
        decryptZukan.mockClear();
        const second = await freshModule();
        await second.acquireItemIcon(99);

        // 命中磁盘密文 → 只解密、不联网
        expect(fetchBinary).not.toHaveBeenCalled();
        expect(decryptZukan).toHaveBeenCalledTimes(1);
    });
});
