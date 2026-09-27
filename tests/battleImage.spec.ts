/**
 * `src/services/resources/battleImage.ts` 用例
 *
 * 引擎（限流 / 引用计数 / LRU / 三层缓存）已由 sprite/item 用例覆盖。这里只守对战
 * 这一侧的接线差异：
 *
 * 1. 路径按赛季版本化：`/assets/encrypted/battle/<season>/icons/<cat>/<encodedKey>.bin`，
 *    资源键是**字符串**（slug / 小写名 / 英文显示名），扁平无 variant；
 * 2. persist root 带赛季（`battle-img:sM6:`），换赛季 → 新 root / 新路径；
 * 3. 404 抛 BinaryRequestError(404)，组件据此回落背包 glyph；
 * 4. 同 key 第二次取用命中缓存，不重复下载解密。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
vi.mock('@/services/resources/cdn', () => ({
    buildCdnUrl: (path: string) => path,
}));

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

// 赛季由 mock 的 loadBattleMeta 提供（可在用例里改）
let season = 'M6';
vi.mock('@/services/meta', () => ({
    loadBattleMeta: async () => ({ season }),
}));

let kv: Map<string, unknown>;
let urlSeq: number;

type BattleImageModule = typeof import('@/services/resources/battleImage');

async function freshModule(): Promise<BattleImageModule> {
    vi.resetModules();
    return import('@/services/resources/battleImage');
}

beforeEach(() => {
    season = 'M6';
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

describe('battleSpec', () => {
    it('root 带赛季、索引用固定 key、路径含赛季', async () => {
        const { battleSpec } = await freshModule();
        const spec = battleSpec('M6');
        expect(spec.persistRoot).toBe('battle-img:sM6:');
        expect(spec.indexStorageKey).toBe('zukan_battle_img_index');
        expect(spec.remotePath('items/x', '')).toBe('/assets/encrypted/battle/M6/icons/items/x.bin');
    });
});

describe('远端路径（字符串键 + 赛季）', () => {
    it('道具：英文显示名 URL 编码', async () => {
        const { acquireBattleIcon } = await freshModule();
        await acquireBattleIcon('items', 'Choice Scarf');
        expect(fetchBinary.mock.calls[0]![0]).toBe(
            '/assets/encrypted/battle/M6/icons/items/Choice%20Scarf.bin',
        );
    });

    it('属性：小写名；精灵：slug', async () => {
        const { acquireBattleIcon } = await freshModule();
        await acquireBattleIcon('types', 'dragon');
        expect(fetchBinary.mock.calls[0]![0]).toBe(
            '/assets/encrypted/battle/M6/icons/types/dragon.bin',
        );
        await acquireBattleIcon('pokemon', 'garchomp');
        expect(fetchBinary.mock.calls[1]![0]).toBe(
            '/assets/encrypted/battle/M6/icons/pokemon/garchomp.bin',
        );
    });
});

describe('缓存与引用计数', () => {
    it('同 key 第二次取用不重复下载解密', async () => {
        const { acquireBattleIcon } = await freshModule();
        await acquireBattleIcon('items', 'Salamencite');
        await acquireBattleIcon('items', 'Salamencite');
        expect(fetchBinary).toHaveBeenCalledTimes(1);
        expect(decryptZukan).toHaveBeenCalledTimes(1);
    });

    it('落盘 key 在赛季 root 下，且无 variant 后缀', async () => {
        vi.useFakeTimers();
        const { acquireBattleIcon } = await freshModule();
        await acquireBattleIcon('items', 'Salamencite');
        await vi.advanceTimersByTimeAsync(600);
        const keys = [...disk.keys()];
        expect(keys.some((k) => k.startsWith('battle-img:sM6:v1:items/Salamencite'))).toBe(true);
        expect(keys.some((k) => k.endsWith('/icon'))).toBe(false);
    });
});

describe('404 回落', () => {
    it('无资源抛 BinaryRequestError(404)，不留条目', async () => {
        const mod = await freshModule();
        fetchBinary.mockRejectedValueOnce(new FakeBinaryRequestError('not found', 404));
        await expect(mod.acquireBattleIcon('items', 'Nope')).rejects.toMatchObject({
            statusCode: 404,
        });
    });
});

describe('换赛季', () => {
    it('M7 走新路径 / 新 root（引擎按赛季缓存）', async () => {
        const mod = await freshModule();
        await mod.acquireBattleIcon('items', 'Choice Scarf');
        season = 'M7';
        await mod.acquireBattleIcon('items', 'Choice Scarf');
        expect(fetchBinary.mock.calls[1]![0]).toBe(
            '/assets/encrypted/battle/M7/icons/items/Choice%20Scarf.bin',
        );
    });
});
