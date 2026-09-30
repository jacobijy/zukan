/**
 * `src/services/resources/spritePersist.ts` 用例
 *
 * 守三类不变量：
 * 1. **磁盘上只有密文。** 存明文 PNG 等于把加密资源以可直接使用的形式留在用户
 *    磁盘上，整条加密链路就白搭了。这是本文件最重要的一条断言。
 * 2. **索引与数据最终一致。** 两者是独立写入，中间刷新必然不一致；
 *    「索引有数据没有」要按 miss 自愈，「数据有索引没有」要被对账收走 ——
 *    后者不修就是永不被预算计入、永不被淘汰的磁盘泄漏。
 * 3. **按平台启用持久化。** fs 后端（小程序 / App）走 USER_DATA_PATH；
 *    无 fs 时回落到 IDB（H5）；仅 `uniStorage`（10MB）时整体 no-op，
 *    避免塞图片把 FB bundle 顶出去。
 *
 * 后半段是与 `spriteCache` 的联调：确认「二次加载不走网络」这个本次改动的目的
 * 真的达成了 —— 单测 `spritePersist` 自己读写通了不代表 `spriteCache` 接对了。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ─────────────────────────────────────────────────────────
// 替身：内存版 binaryStorage + uni storage
// ─────────────────────────────────────────────────────────

/** 当前模拟的后端类型。`storageBackend === 'memory'` 时 imagePersist 整体 no-op。 */
let backend: 'idb' | 'uni' | 'memory';
/** 当前平台是否有 fs 后端（小程序 / App）。false 模拟 H5。 */
let hasFs: boolean;

let disk: Map<string, Uint8Array>;
/** fs 后端落点（sprite 持久层只在 fs 可用时写这里） */
let fsDisk: Map<string, Uint8Array>;
/** fs 后端 keys() 调用计数（与 binaryStorage 的 keysCalls 对应） */
let fsKeysCalls: number;
/** put 失败注入：命中的 key 抛错（模拟 quota） */
let putFailKeys: Set<string>;
let keysCalls: number;

/**
 * 图片持久层实际用的 store：模拟 imageBinaryStorage 的运行时分发。
 * fs 可用 → fsDisk；无 fs + idb 后端 → disk（H5 回落 IDB）；
 * 无 fs + 非 idb 后端 → 空实现（imagePersist 的 isPersistable 已拦截，
 * 这里只为不崩，见「fs 后端不可用 + uni-storage 后端」用例）。
 */
function pickImageStore(): BinaryStorage {
    if (hasFs) return fsStoreMock;
    if (backend === 'idb') return diskStoreMock;
    return noopStoreMock;
}

const noopStoreMock = {
    async get(): Promise<Uint8Array | null> {
        return null;
    },
    async put(): Promise<void> {
        return;
    },
    async delete(): Promise<void> {
        return;
    },
    async clear(): Promise<void> {
        return;
    },
    async keys(): Promise<string[]> {
        return [];
    },
};

const diskStoreMock = {
    async get(key: string) {
        return disk.get(key) ?? null;
    },
    async put(key: string, data: Uint8Array) {
        if (putFailKeys.has(key)) throw new Error('QuotaExceededError');
        disk.set(key, data);
    },
    async delete(key: string) {
        disk.delete(key);
    },
    async clear(prefix?: string) {
        // 先快照再删：边遍历边 delete 是未定义行为
        // eslint-disable-next-line unicorn/no-useless-spread -- 见上，这个 spread 不是多余的
        for (const k of [...disk.keys()]) {
            if (!prefix || k.startsWith(prefix)) disk.delete(k);
        }
    },
    async keys(prefix?: string) {
        keysCalls += 1;
        return [...disk.keys()].filter((k) => !prefix || k.startsWith(prefix));
    },
};

/** fs 后端替身：fs 可用时数据落这里而非 disk。 */
const fsStoreMock = {
    async get(key: string) {
        return fsDisk.get(key) ?? null;
    },
    async put(key: string, data: Uint8Array) {
        if (putFailKeys.has(key)) throw new Error('QuotaExceededError');
        fsDisk.set(key, data);
    },
    async delete(key: string) {
        fsDisk.delete(key);
    },
    async clear(prefix?: string) {
        // 先快照再删：边遍历边 delete 是未定义行为
        // eslint-disable-next-line unicorn/no-useless-spread -- 见上，这个 spread 不是多余的
        for (const k of [...fsDisk.keys()]) {
            if (!prefix || k.startsWith(prefix)) fsDisk.delete(k);
        }
    },
    async keys(prefix?: string) {
        fsKeysCalls += 1;
        return [...fsDisk.keys()].filter((k) => !prefix || k.startsWith(prefix));
    },
};

vi.mock('@/infra/storage/binaryStorage', () => ({
    get storageBackend() {
        return backend;
    },
    hasFileSystemBackend: () => hasFs,
    // 运行时按 hasFs / backend 分发，模拟 imageBinaryStorage 的真实语义
    get imageBinaryStorage() {
        return pickImageStore();
    },
    get fsStorage() {
        return hasFs ? fsStoreMock : noopStoreMock;
    },
    get binaryStorage() {
        return diskStoreMock;
    },
}));

/** uni storage 的同步替身（索引存这里） */
let kv: Map<string, unknown>;

type PersistModule = typeof import('@/services/resources/spritePersist');
import type { BinaryStorage } from '@/infra/storage/binaryStorage';

async function freshPersist(): Promise<PersistModule> {
    vi.resetModules();
    return import('@/services/resources/spritePersist');
}

/** 推进微任务队列，让 fire-and-forget 的对账 / 落盘跑完 */
async function flush(): Promise<void> {
    for (let i = 0; i < 20; i += 1) {
        // eslint-disable-next-line no-await-in-loop -- 就是要逐个 tick 地推进微任务队列
        await Promise.resolve();
    }
}

/**
 * 伪造指定体积的字节。
 *
 * 预算是 60MB，真分配几十 MB 太重；这里只关心 `byteLength`
 * （存储替身不看内容，`decryptZukan` 也被 mock 了）。
 */
function bytesOfSize(n: number): Uint8Array {
    return { byteLength: n } as unknown as Uint8Array;
}

beforeEach(() => {
    backend = 'idb';
    hasFs = true;
    disk = new Map();
    fsDisk = new Map();
    fsKeysCalls = 0;
    putFailKeys = new Set();
    keysCalls = 0;
    kv = new Map();

    vi.stubGlobal('uni', {
        getStorageSync: (key: string) => kv.get(key) ?? '',
        setStorageSync: (key: string, value: unknown) => {
            kv.set(key, value);
        },
        removeStorageSync: (key: string) => {
            kv.delete(key);
        },
    });
});

afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
});

describe('启用条件', () => {
    it('fs 后端启用（默认）—— 数据落 fsDisk 不落 disk', async () => {
        const mod = await freshPersist();

        await mod.saveSpriteBytes(1, 'home', bytesOfSize(1000));

        expect(fsDisk.size).toBe(1);
        // binaryStorage（uniStorage）不该被写入 —— 那是 FB bundle 的后端
        expect(disk.size).toBe(0);
        expect(await mod.loadSpriteBytes(1, 'home')).not.toBeNull();
        expect(mod.spritePersistStats()).toMatchObject({ enabled: true, entries: 1, bytes: 1000 });
    });

    it('fs 后端不可用 + IDB 后端（H5）—— 数据落 disk 不落 fsDisk', async () => {
        // 覆盖「H5 上 fsStorage 恒退化、但图片持久层必须回落到 IDB」这条路径：
        // 若这里写不进 disk，H5 就丢了跨刷新的 sprite 缓存。
        hasFs = false;
        backend = 'idb';
        const mod = await freshPersist();

        await mod.saveSpriteBytes(1, 'home', bytesOfSize(1000));

        expect(disk.size).toBe(1);
        expect(fsDisk.size).toBe(0);
        expect(await mod.loadSpriteBytes(1, 'home')).not.toBeNull();
        expect(mod.spritePersistStats()).toMatchObject({ enabled: true, entries: 1, bytes: 1000 });
    });

    it('fs 后端不可用 + uni-storage 后端 —— 全程 no-op，不写 10MB 配额', async () => {
        // 假想的 uni-storage 平台：既无 fs 也无 IDB。不能为了启用持久层
        // 回落 uniStorage —— 那只有 10MB，塞图片会把 FB bundle 顶出去。
        hasFs = false;
        backend = 'uni';
        const mod = await freshPersist();

        await mod.saveSpriteBytes(1, 'home', bytesOfSize(1000));

        expect(disk.size).toBe(0);
        expect(fsDisk.size).toBe(0);
        expect(mod.spritePersistStats()).toMatchObject({ enabled: false, entries: 0, bytes: 0 });
    });

    it('dev 内存后端全程 no-op', async () => {
        // storageBackend === 'memory' 时 imagePersist 整体 no-op，不写 fsDisk
        backend = 'memory';
        const mod = await freshPersist();

        await mod.saveSpriteBytes(1, 'home', bytesOfSize(1000));

        expect(fsDisk.size).toBe(0);
        // 既不该写 fsDisk 也不该写 uniStorage
        expect(disk.size).toBe(0);
        expect(mod.spritePersistStats()).toMatchObject({ enabled: false, entries: 0, bytes: 0 });
    });
});

describe('存取往返', () => {
    it('存进去的字节能原样读回来', async () => {
        const mod = await freshPersist();
        const payload = new Uint8Array([9, 8, 7]);

        await mod.saveSpriteBytes(25, 'home', payload);

        expect(await mod.loadSpriteBytes(25, 'home')).toBe(payload);
    });

    it('未存过的返回 null', async () => {
        const mod = await freshPersist();
        expect(await mod.loadSpriteBytes(999, 'home')).toBeNull();
    });

    it('id / variant 各自独立', async () => {
        const mod = await freshPersist();

        await mod.saveSpriteBytes(1, 'home', bytesOfSize(10));
        await mod.saveSpriteBytes(1, 'shiny', bytesOfSize(20));
        await mod.saveSpriteBytes(2, 'home', bytesOfSize(30));

        expect(mod.spritePersistStats()).toMatchObject({ entries: 3, bytes: 60 });
        expect(await mod.loadSpriteBytes(1, 'shiny')).not.toBeNull();
    });

    it('重复存同一 key 不重复计账', async () => {
        const mod = await freshPersist();

        await mod.saveSpriteBytes(1, 'home', bytesOfSize(100));
        await mod.saveSpriteBytes(1, 'home', bytesOfSize(150));

        // 覆盖而不是累加 —— 累加会让预算被虚高的账目提前撑爆
        expect(mod.spritePersistStats()).toMatchObject({ entries: 1, bytes: 150 });
    });
});

describe('索引跨刷新', () => {
    it('索引落盘后，新模块实例仍认得已缓存的条目', async () => {
        vi.useFakeTimers();
        const first = await freshPersist();

        await first.saveSpriteBytes(1, 'home', new Uint8Array([1, 2, 3]));
        // 落盘是防抖的（滚动时会连续写几十条）
        await vi.advanceTimersByTimeAsync(600);
        expect(kv.get('zukan_sprite_index')).toBeTruthy();

        // 模拟刷新页面：模块状态归零，磁盘与 kv 保留
        const second = await freshPersist();
        expect(await second.loadSpriteBytes(1, 'home')).not.toBeNull();
        expect(second.spritePersistStats()).toMatchObject({ entries: 1, bytes: 3 });
    });

    it('版本号不符时整份索引作废 —— 不能拿旧字节喂新 DEK', async () => {
        vi.useFakeTimers();
        const first = await freshPersist();
        await first.saveSpriteBytes(1, 'home', new Uint8Array([1, 2, 3]));
        await vi.advanceTimersByTimeAsync(600);

        // 服务端 bump 了资源版本
        kv.set('zukan_data_version', 2);

        const second = await freshPersist();
        expect(second.spritePersistStats()).toMatchObject({ entries: 0, bytes: 0 });
        // 新版本的 key 与旧版本不同，必然 miss
        expect(await second.loadSpriteBytes(1, 'home')).toBeNull();
    });

    it('索引损坏时按空缓存处理，不抛错', async () => {
        kv.set('zukan_sprite_index', '{ 这不是 JSON');
        const mod = await freshPersist();

        expect(mod.spritePersistStats()).toMatchObject({ entries: 0 });
        await expect(mod.loadSpriteBytes(1, 'home')).resolves.toBeNull();
    });
});

describe('索引与数据的一致性', () => {
    it('索引有、数据没有 → 按 miss 处理并摘掉幽灵索引项', async () => {
        vi.useFakeTimers();
        const first = await freshPersist();
        await first.saveSpriteBytes(1, 'home', new Uint8Array([1, 2, 3]));
        await vi.advanceTimersByTimeAsync(600);

        // 用户手动清了 fs，索引还在
        fsDisk.clear();

        const second = await freshPersist();
        expect(await second.loadSpriteBytes(1, 'home')).toBeNull();
        // 自愈：幽灵项已摘掉，字节账目一并回收
        expect(second.spritePersistStats()).toMatchObject({ entries: 0, bytes: 0 });
    });

    it('数据有、索引没有 → 对账删掉孤儿（否则永不被淘汰）', async () => {
        const mod = await freshPersist();

        // 上次「写数据成功但索引没来得及落盘」留下的孤儿
        fsDisk.set('sprite:v1:1/home', new Uint8Array([1]));
        fsDisk.set('sprite:v1:2/home', new Uint8Array([2]));

        await mod.loadSpriteBytes(3, 'home');
        await flush();

        expect(fsDisk.size).toBe(0);
    });

    it('对账只跑一次，不给每次读都加一趟 getAllKeys', async () => {
        const mod = await freshPersist();

        await mod.loadSpriteBytes(1, 'home');
        await mod.loadSpriteBytes(2, 'home');
        await mod.loadSpriteBytes(3, 'home');
        await flush();

        expect(fsKeysCalls).toBe(1);
    });

    it('对账不误删索引里记着的条目', async () => {
        vi.useFakeTimers();
        const first = await freshPersist();
        await first.saveSpriteBytes(1, 'home', new Uint8Array([1, 2, 3]));
        await vi.advanceTimersByTimeAsync(600);

        const second = await freshPersist();
        await second.loadSpriteBytes(1, 'home');
        await vi.advanceTimersByTimeAsync(100);

        expect(fsDisk.has('sprite:v1:1/home')).toBe(true);
    });

    it('写入失败（quota）不留下索引项', async () => {
        const mod = await freshPersist();
        putFailKeys.add('sprite:v1:1/home');

        // 静默降级：持久化是纯优化，不该把当前这张图的显示带崩
        await expect(mod.saveSpriteBytes(1, 'home', bytesOfSize(100))).resolves.toBeUndefined();

        expect(mod.spritePersistStats()).toMatchObject({ entries: 0, bytes: 0 });
        expect(await mod.loadSpriteBytes(1, 'home')).toBeNull();
    });
});

describe('字节预算淘汰', () => {
    const MB = 1024 * 1024;

    it('超出预算后按插入序删到预算内', async () => {
        const mod = await freshPersist();

        // MAX_BYTES = 40MB（fs 预算）；6 × 8MB = 48MB 触发淘汰
        for (let id = 1; id <= 6; id += 1) {
            // eslint-disable-next-line no-await-in-loop -- 插入序即淘汰序，并发会打乱
            await mod.saveSpriteBytes(id, 'home', bytesOfSize(8 * MB));
        }

        expect(mod.spritePersistStats().bytes).toBeLessThanOrEqual(40 * MB);
        // 删的是最早那个，不是最新那个
        expect(fsDisk.has('sprite:v1:1/home')).toBe(false);
        expect(fsDisk.has('sprite:v1:6/home')).toBe(true);
    });

    it('没超预算时一个都不删', async () => {
        const mod = await freshPersist();

        for (let id = 1; id <= 4; id += 1) {
            // eslint-disable-next-line no-await-in-loop -- 同上
            await mod.saveSpriteBytes(id, 'home', bytesOfSize(8 * MB));
        }

        expect(mod.spritePersistStats()).toMatchObject({ entries: 4, bytes: 32 * MB });
        expect(fsDisk.size).toBe(4);
    });

    it('单张就超预算时不会把自己删光后仍留着账', async () => {
        const mod = await freshPersist();

        await mod.saveSpriteBytes(1, 'home', bytesOfSize(50 * MB));

        // 唯一的条目被删掉了，账目必须一起归零 —— 留着会让预算永久少一块
        expect(mod.spritePersistStats().bytes).toBe(0);
        expect(fsDisk.size).toBe(0);
    });
});

describe('fs 后端（小程序 / App 图片持久层）', () => {
    const MB = 1024 * 1024;

    it('fs 预算来自 CACHE_CONFIG（40MB）', async () => {
        expect((await freshPersist()).spritePersistStats().maxBytes).toBe(40 * MB);
    });

    it('保护集：淘汰先删非保护项（id > 100），保护项（id ≤ 100）后删', async () => {
        const mod = await freshPersist();

        // 预算 40MB；塞 1 张保护(id=1, 25MB) + 2 张非保护(id=101,102 各 20MB) = 65MB > 40
        // 非保护先删（101→45，仍>40；102→25 ≤40），两张非保护都删完，保护项 id=1 留着
        await mod.saveSpriteBytes(1, 'home', bytesOfSize(25 * MB));
        await mod.saveSpriteBytes(101, 'home', bytesOfSize(20 * MB));
        await mod.saveSpriteBytes(102, 'home', bytesOfSize(20 * MB));

        expect(fsDisk.has('sprite:v1:1/home')).toBe(true);
        expect(fsDisk.has('sprite:v1:101/home')).toBe(false);
        expect(fsDisk.has('sprite:v1:102/home')).toBe(false);
    });

    it('保护集删不干净时回落到保护项 —— 保护是优先保留不是永不删', async () => {
        const mod = await freshPersist();

        // 只塞一张 50MB 的保护项（id=1），非保护为空，必须删掉它
        await mod.saveSpriteBytes(1, 'home', bytesOfSize(50 * MB));

        expect(mod.spritePersistStats().bytes).toBe(0);
        expect(fsDisk.size).toBe(0);
    });
});

describe('删除与版本清理', () => {
    it('dropSpriteBytes 同时删数据与索引项', async () => {
        const mod = await freshPersist();

        await mod.saveSpriteBytes(1, 'home', bytesOfSize(100));
        await mod.dropSpriteBytes(1, 'home');

        expect(fsDisk.size).toBe(0);
        expect(mod.spritePersistStats()).toMatchObject({ entries: 0, bytes: 0 });
    });

    it('drop 未缓存过的不抛错', async () => {
        const mod = await freshPersist();
        await expect(mod.dropSpriteBytes(999, 'home')).resolves.toBeUndefined();
    });

    it('pruneSpriteVersions 只删别的版本，保留 keepVersion', async () => {
        const mod = await freshPersist();

        fsDisk.set('sprite:v1:1/home', new Uint8Array([1]));
        fsDisk.set('sprite:v1:2/home', new Uint8Array([2]));
        fsDisk.set('sprite:v2:1/home', new Uint8Array([3]));
        // fb 前缀不属于 sprite root，不该被清
        fsDisk.set('fb:v1:gen:1', new Uint8Array([4]));

        await mod.pruneSpriteVersions(2);

        expect([...fsDisk.keys()].toSorted()).toEqual(['fb:v1:gen:1', 'sprite:v2:1/home']);
    });

    it('pruneSpriteVersions 用参数而不是存储里的版本号 —— 调用点在写新版本号之前', async () => {
        const mod = await freshPersist();

        // 存储里还是旧版本 1，但要保留的是即将写入的 2
        kv.set('zukan_data_version', 1);
        fsDisk.set('sprite:v2:1/home', new Uint8Array([1]));

        await mod.pruneSpriteVersions(2);

        expect(fsDisk.has('sprite:v2:1/home')).toBe(true);
    });
});

// ─────────────────────────────────────────────────────────
// 与 spriteCache 的联调
// ─────────────────────────────────────────────────────────

const fetchBinary = vi.fn();
const decryptZukan = vi.fn();

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
    getKey: vi.fn().mockResolvedValue({ dek: 'deadbeef', cdn: undefined }),
    clearKeyCache: vi.fn(),
}));
vi.mock('@/services/http', () => ({
    fetchBinary: (...args: unknown[]) => fetchBinary(...args),
    BinaryRequestError: FakeBinaryRequestError,
}));
vi.mock('@/services/resources/cdn', () => ({
    buildCdnUrl: (path: string) => `https://cdn.test${path}`,
}));

/** 密文与明文用可区分的内容，好断言「落盘的是哪一份」 */
const CIPHERTEXT = new Uint8Array([0x5a, 0x4b, 0x44, 0x58, 1, 1, 1]);
const PLAINTEXT = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 2, 2, 2]);

async function freshCache(): Promise<typeof import('@/services/resources/spriteCache')> {
    vi.resetModules();
    return import('@/services/resources/spriteCache');
}

describe('spriteCache 联调', () => {
    beforeEach(() => {
        fetchBinary.mockReset().mockResolvedValue(CIPHERTEXT);
        decryptZukan.mockReset().mockReturnValue(PLAINTEXT);

        let seq = 0;
        vi.stubGlobal('URL', {
            createObjectURL: () => `blob:mock/${(seq += 1)}`,
            revokeObjectURL: () => undefined,
        });
        vi.stubGlobal(
            'Blob',
            class {
                constructor(readonly parts: unknown[]) {}
            },
        );
        vi.stubGlobal('uni', {
            getStorageSync: (key: string) => kv.get(key) ?? '',
            setStorageSync: (key: string, value: unknown) => {
                kv.set(key, value);
            },
            removeStorageSync: (key: string) => {
                kv.delete(key);
            },
        });
    });

    it('落盘的是密文，不是解密后的 PNG —— 明文上盘等于加密白做', async () => {
        vi.useFakeTimers();
        const mod = await freshCache();

        await mod.acquireSprite(1, 'home');
        await vi.advanceTimersByTimeAsync(600);

        const stored = [...fsDisk.values()];
        expect(stored).toHaveLength(1);
        expect(stored[0]).toBe(CIPHERTEXT);
        expect(stored[0]).not.toBe(PLAINTEXT);
    });

    it('二次加载（模拟刷新）命中磁盘，不走网络', async () => {
        vi.useFakeTimers();
        const first = await freshCache();
        await first.acquireSprite(1, 'home');
        await vi.advanceTimersByTimeAsync(600);
        expect(fetchBinary).toHaveBeenCalledTimes(1);

        // 刷新：内存缓存与调度器状态全部归零，磁盘保留
        const second = await freshCache();
        const url = await second.acquireSprite(1, 'home');

        expect(url).toMatch(/^blob:mock\//);
        // 关键断言：这就是本次改动的目的
        expect(fetchBinary).toHaveBeenCalledTimes(1);
        // 仍然解密了一次 —— 盘上是密文，每次启动都要重解
        expect(decryptZukan).toHaveBeenCalledTimes(2);
    });

    it('缓存密文解不开（旧 DEK / 损坏）时删掉并重新下载', async () => {
        vi.useFakeTimers();
        const first = await freshCache();
        await first.acquireSprite(1, 'home');
        await vi.advanceTimersByTimeAsync(600);

        const second = await freshCache();
        // 第一次解密（对着盘上那份）失败，重下后成功
        decryptZukan
            .mockReset()
            .mockImplementationOnce(() => {
                throw new Error('tag mismatch');
            })
            .mockReturnValue(PLAINTEXT);

        const url = await second.acquireSprite(1, 'home');
        await vi.advanceTimersByTimeAsync(600);

        expect(url).toMatch(/^blob:mock\//);
        // 走了网络兜底
        expect(fetchBinary).toHaveBeenCalledTimes(2);
    });

    /**
     * 上一条测不出「删」这个动作 —— 重下成功会覆盖同一个 key，删与不删都一样。
     * 坏字节的真正危害要在**重下也失败**时才显形：不删的话它永远躺在盘上，
     * 每次刷新都白跑一轮「解密失败 → 重下」。
     */
    it('重下也失败时，坏字节必须已从盘上删掉（否则每次刷新都重复失败一轮）', async () => {
        vi.useFakeTimers();
        const first = await freshCache();
        await first.acquireSprite(1, 'home');
        await vi.advanceTimersByTimeAsync(600);
        expect(fsDisk.size).toBe(1);

        const second = await freshCache();
        decryptZukan.mockReset().mockImplementation(() => {
            throw new Error('tag mismatch');
        });
        fetchBinary.mockRejectedValue(new Error('offline'));

        await expect(second.acquireSprite(1, 'home')).rejects.toThrow('offline');
        await vi.advanceTimersByTimeAsync(600);

        expect(fsDisk.size).toBe(0);
    });

    it('clearSpriteCache 不动磁盘 —— 密文没密钥解不开，留着下次登录还能命中', async () => {
        vi.useFakeTimers();
        const mod = await freshCache();

        await mod.acquireSprite(1, 'home');
        await vi.advanceTimersByTimeAsync(600);
        expect(fsDisk.size).toBe(1);

        mod.clearSpriteCache();

        expect(fsDisk.size).toBe(1);
        expect(mod.spriteCacheStats()).toMatchObject({ entries: 0 });
    });

    it('dev 内存后端时退化为改动前行为：每次都走网络', async () => {
        backend = 'memory';
        const first = await freshCache();
        await first.acquireSprite(1, 'home');

        const second = await freshCache();
        await second.acquireSprite(1, 'home');

        expect(fsDisk.size).toBe(0);
        expect(fetchBinary).toHaveBeenCalledTimes(2);
    });
});
