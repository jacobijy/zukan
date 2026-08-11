/**
 * `src/services/resources/spriteCache.ts` 用例
 *
 * 守的是两个真实 bug（都源于「看着像模块级、其实在 setup() 里」的缓存）：
 * 1. 缓存永不命中 —— 每个组件实例一份空 Map，同一 sprite 反复下载解密
 * 2. Blob URL 永久泄漏 —— 卸载时的守卫条件恒假，`revokeObjectURL` 从不执行
 *
 * 因此断言集中在：命中率、并发去重、引用计数与 revoke 的时机。
 * 「在屏（refs > 0）的条目不可被撤销」是关键不变量 —— 撤销即裂图。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── 被 mock 的下游：不碰真实 WASM / 网络 / 密钥 ──
const fetchBinary = vi.fn();
const decryptZukan = vi.fn();
const getKey = vi.fn();
const clearKeyCache = vi.fn();

class FakeBinaryRequestError extends Error {
    statusCode?: number;
    constructor(message: string, statusCode?: number) {
        super(message);
        this.statusCode = statusCode;
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
    buildCdnUrl: (path: string) => `https://cdn.test${path}`,
}));

/** createObjectURL / revokeObjectURL 的可观测替身 */
let createdUrls: string[];
let revokedUrls: string[];
let urlSeq: number;

type SpriteCacheModule = typeof import('@/services/resources/spriteCache');

async function freshModule(): Promise<SpriteCacheModule> {
    vi.resetModules();
    return import('@/services/resources/spriteCache');
}

beforeEach(() => {
    createdUrls = [];
    revokedUrls = [];
    urlSeq = 0;

    fetchBinary.mockReset().mockResolvedValue(new Uint8Array([1, 2, 3]));
    decryptZukan.mockReset().mockReturnValue(new Uint8Array([4, 5, 6]));
    getKey.mockReset().mockResolvedValue({ dek: 'deadbeef', cdn: undefined });
    clearKeyCache.mockReset();

    vi.stubGlobal('URL', {
        createObjectURL: () => {
            urlSeq += 1;
            const url = `blob:mock/${urlSeq}`;
            createdUrls.push(url);
            return url;
        },
        revokeObjectURL: (url: string) => {
            revokedUrls.push(url);
        },
    });
    vi.stubGlobal('Blob', class {
        constructor(readonly parts: unknown[]) {}
    });
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('缓存命中', () => {
    it('同一 sprite 第二次取用不重复下载解密', async () => {
        const { acquireSprite } = await freshModule();

        const first = await acquireSprite(1, 'home');
        const second = await acquireSprite(1, 'home');

        expect(second).toBe(first);
        expect(fetchBinary).toHaveBeenCalledTimes(1);
        expect(decryptZukan).toHaveBeenCalledTimes(1);
        expect(createdUrls).toHaveLength(1);
    });

    it('不同 variant / id 各自独立', async () => {
        const { acquireSprite } = await freshModule();

        const a = await acquireSprite(1, 'home');
        const b = await acquireSprite(1, 'shiny');
        const c = await acquireSprite(2, 'home');

        expect(new Set([a, b, c]).size).toBe(3);
        expect(fetchBinary).toHaveBeenCalledTimes(3);
    });

    it('并发请求同一 sprite 只下载一次（inflight 去重）', async () => {
        const { acquireSprite, spriteCacheStats } = await freshModule();

        const results = await Promise.all([
            acquireSprite(7, 'home'),
            acquireSprite(7, 'home'),
            acquireSprite(7, 'home'),
        ]);

        expect(new Set(results).size).toBe(1);
        expect(fetchBinary).toHaveBeenCalledTimes(1);
        // 三个调用方各自登记了一次引用
        expect(spriteCacheStats()).toMatchObject({ entries: 1, refs: 3 });
    });

    it('失败后不缓存 reject 的 promise，下次可重试', async () => {
        const { acquireSprite } = await freshModule();

        fetchBinary.mockRejectedValueOnce(new Error('network down'));
        await expect(acquireSprite(1, 'home')).rejects.toThrow('network down');

        // 第二次应真的重试而不是复用已失败的 promise
        const url = await acquireSprite(1, 'home');
        expect(url).toMatch(/^blob:mock\//);
        expect(fetchBinary).toHaveBeenCalledTimes(2);
    });
});

describe('引用计数与 revoke', () => {
    it('release 后条目仍在缓存，不撤销 URL（下次秒开）', async () => {
        const { acquireSprite, releaseSprite, spriteCacheStats } = await freshModule();

        const url = await acquireSprite(1, 'home');
        releaseSprite(1, 'home');

        expect(revokedUrls).toEqual([]);
        expect(spriteCacheStats()).toMatchObject({ entries: 1, refs: 0 });

        // 再取用命中缓存，仍是同一个 URL
        expect(await acquireSprite(1, 'home')).toBe(url);
        expect(fetchBinary).toHaveBeenCalledTimes(1);
    });

    it('多个持有者各自 release 才归零', async () => {
        const { acquireSprite, releaseSprite, spriteCacheStats } = await freshModule();

        await acquireSprite(1, 'home');
        await acquireSprite(1, 'home');
        expect(spriteCacheStats().refs).toBe(2);

        releaseSprite(1, 'home');
        expect(spriteCacheStats().refs).toBe(1);

        releaseSprite(1, 'home');
        expect(spriteCacheStats().refs).toBe(0);
    });

    it('release 次数多于 acquire 不会把 refs 压成负数', async () => {
        const { acquireSprite, releaseSprite, spriteCacheStats } = await freshModule();

        await acquireSprite(1, 'home');
        releaseSprite(1, 'home');
        releaseSprite(1, 'home');
        releaseSprite(1, 'home');

        expect(spriteCacheStats().refs).toBe(0);
    });

    it('release 未知 key 不抛错', async () => {
        const { releaseSprite } = await freshModule();
        expect(() => releaseSprite(999, 'home')).not.toThrow();
    });
});

/**
 * 装满缓存并全部 release，使条目可被淘汰。
 *
 * 这里**刻意串行 await**：LRU 顺序就是插入顺序，`Promise.all` 会让完成次序
 * 不确定，后面「撤销的是最旧那个」的断言就失去意义。
 */
async function fill(mod: SpriteCacheModule, from: number, to: number) {
    for (let id = from; id <= to; id += 1) {
        // eslint-disable-next-line no-await-in-loop -- 顺序即 LRU 顺序，见上
        await mod.acquireSprite(id, 'home');
        mod.releaseSprite(id, 'home');
    }
}

describe('LRU 淘汰', () => {
    it('超过上限后撤销最旧的空闲条目', async () => {
        const mod = await freshModule();

        // MAX_ENTRIES = 200
        await fill(mod, 1, 200);
        expect(mod.spriteCacheStats().entries).toBe(200);
        expect(revokedUrls).toEqual([]);

        // 第 201 条触发淘汰
        await mod.acquireSprite(201, 'home');
        expect(mod.spriteCacheStats().entries).toBe(200);
        expect(revokedUrls).toHaveLength(1);
        // 撤销的是最早插入的那个
        expect(revokedUrls[0]).toBe(createdUrls[0]);
    });

    it('在屏条目（refs > 0）不被撤销 —— 撤销即裂图', async () => {
        const mod = await freshModule();

        // 第 1 条保持持有（模拟正显示在屏幕上）
        const pinned = await mod.acquireSprite(1, 'home');
        await fill(mod, 2, 250);

        expect(revokedUrls).not.toContain(pinned);
        // 被 pin 住的条目仍可命中
        expect(await mod.acquireSprite(1, 'home')).toBe(pinned);
    });

    it('全部在屏时缓存可短暂超限，但不误撤销', async () => {
        const mod = await freshModule();

        for (let id = 1; id <= 210; id += 1) {
            // eslint-disable-next-line no-await-in-loop -- 同上：顺序即 LRU 顺序
            await mod.acquireSprite(id, 'home'); // 不 release
        }

        expect(mod.spriteCacheStats().entries).toBe(210);
        expect(revokedUrls).toEqual([]);
    });

    it('命中会刷新 LRU 位置，最旧的不再是它', async () => {
        const mod = await freshModule();

        await fill(mod, 1, 200);
        // 重新取用第 1 条 → 移到末尾，再 release 使其可淘汰
        await mod.acquireSprite(1, 'home');
        mod.releaseSprite(1, 'home');

        await mod.acquireSprite(201, 'home');

        // 淘汰的应是第 2 条（现存最旧），而不是刚刷新过的第 1 条
        expect(revokedUrls).toEqual([createdUrls[1]]);
    });
});

describe('clearSpriteCache', () => {
    it('撤销全部 URL 并清空', async () => {
        const mod = await freshModule();

        await mod.acquireSprite(1, 'home');
        await mod.acquireSprite(2, 'home');
        mod.clearSpriteCache();

        expect(revokedUrls).toHaveLength(2);
        expect(mod.spriteCacheStats()).toMatchObject({ entries: 0, refs: 0, inflight: 0 });
    });

    it('清空后重新取用会重新下载', async () => {
        const mod = await freshModule();

        await mod.acquireSprite(1, 'home');
        mod.clearSpriteCache();
        await mod.acquireSprite(1, 'home');

        expect(fetchBinary).toHaveBeenCalledTimes(2);
    });
});

describe('CDN 403 重签', () => {
    it('403 时清密钥缓存并重试一次', async () => {
        const mod = await freshModule();

        fetchBinary.mockRejectedValueOnce(new FakeBinaryRequestError('forbidden', 403));
        getKey
            .mockResolvedValueOnce({ dek: 'stale', cdn: undefined })
            .mockResolvedValueOnce({ dek: 'fresh', cdn: undefined });

        const url = await mod.acquireSprite(1, 'home');

        expect(url).toMatch(/^blob:mock\//);
        expect(clearKeyCache).toHaveBeenCalledTimes(1);
        expect(fetchBinary).toHaveBeenCalledTimes(2);
        // 重试用的是新密钥
        expect(decryptZukan).toHaveBeenCalledWith(expect.anything(), 'fresh');
    });

    it('非 403 错误直接抛出，不重签', async () => {
        const mod = await freshModule();

        fetchBinary.mockRejectedValueOnce(new FakeBinaryRequestError('server error', 500));
        await expect(mod.acquireSprite(1, 'home')).rejects.toThrow('server error');
        expect(clearKeyCache).not.toHaveBeenCalled();
    });
});
