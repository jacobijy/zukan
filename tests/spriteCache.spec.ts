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

    it('中止在途与排队任务 —— 旧 DEK 解出来的图不该再入缓存', async () => {
        const mod = await freshModule();
        useDeferredFetch();

        // 4 个在途 + 2 个排队
        const promises = [1, 2, 3, 4, 5, 6].map((id) =>
            mod.acquireSprite(id, 'home').catch((err: unknown) => err),
        );
        await flush();
        expect(mod.spriteCacheStats()).toMatchObject({ running: 4, queued: 2 });

        mod.clearSpriteCache();
        await flush();

        // 在途的收到了取消信号
        expect(pendingFetches.every((f) => f.signal?.aborted)).toBe(true);
        // 排队的一个请求都没发出（只发过最初的 4 个）
        expect(pendingFetches).toHaveLength(4);

        const results = await Promise.all(promises);
        expect(results.every((r) => mod.isSpriteAbortError(r))).toBe(true);
        expect(mod.spriteCacheStats()).toMatchObject({ entries: 0, refs: 0, queued: 0, inflight: 0 });
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

/**
 * ── 调度用的可控下载 ──
 *
 * 上面的用例让 `fetchBinary` 立即 resolve，测不出排队顺序（每个任务在下一个入队前
 * 就结算完了）。这里改成手动结算：按 pokemon id 存住 resolve，
 * 从而能让槽位「占着不放」并观察谁在排队、谁抢到了槽位。
 */
interface Deferred {
    id: number;
    signal?: AbortSignal;
    done: boolean;
    resolve: () => void;
    reject: (err: Error) => void;
}

/** 按 fetchBinary 被调用的顺序记录 —— 即调度器真正放行的顺序 */
let pendingFetches: Deferred[];

/** url 形如 https://cdn.test/assets/encrypted/pokemon/{id}/home.bin */
function idFromUrl(url: string): number {
    const match = /\/pokemon\/(\d+)\//.exec(url);
    return match ? Number(match[1]) : -1;
}

function useDeferredFetch(): void {
    pendingFetches = [];
    fetchBinary.mockReset().mockImplementation((url: string, opts?: { signal?: AbortSignal }) => {
        return new Promise<Uint8Array>((resolve, reject) => {
            const entry: Deferred = {
                id: idFromUrl(url),
                signal: opts?.signal,
                done: false,
                resolve: () => {
                    entry.done = true;
                    resolve(new Uint8Array([4, 5, 6]));
                },
                reject,
            };
            pendingFetches.push(entry);
            // 取消在途请求：模拟 binaryRequest 里 RequestTask.abort() 后的 reject
            opts?.signal?.addEventListener('abort', () => {
                entry.done = true;
                reject(new FakeBinaryRequestError('Request aborted', undefined, true));
            });
        });
    });
}

/** 放行到调度队列的下一轮 —— 微任务队列排空 */
/**
 * 把微任务队列推到静止。
 *
 * 迭代次数要够多：`fetchSpriteBytes` 在发请求前先 await 一次持久层探测
 * （`spritePersist.loadSpriteBytes`，node 下 no-op 但仍是 async）+ WASM/密钥，
 * 每个任务因此有好几个 tick 的前置开销。给够余量，别卡在边界上。
 */
async function flush(): Promise<void> {
    for (let i = 0; i < 40; i += 1) {
        // eslint-disable-next-line no-await-in-loop -- 就是要逐个 tick 地推进微任务队列
        await Promise.resolve();
    }
}

/**
 * 推进一帧，让后续入队的任务落进新的 batch。
 * node 没有 rAF，`currentBatch` 退化为 `setTimeout(bump, 16)` —— 必须等够 16ms，
 * 否则批次号不变，「批间 LIFO」就退化成同批 FIFO。
 */
async function nextFrame(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 25));
    await flush();
}

/** 已发出下载的 id 列表（顺序即调度顺序） */
function startedIds(): number[] {
    return pendingFetches.map((f) => f.id);
}

/** 结算某张图。取消过的那次不算 —— 重试会是同 id 的新条目。 */
function settle(id: number): void {
    const entry = pendingFetches.find((f) => f.id === id && !f.done);
    if (!entry) throw new Error(`no pending fetch for id ${id}`);
    entry.resolve();
}

describe('并发限流', () => {
    it('同时请求 10 张只有 4 个在途，其余排队', async () => {
        const mod = await freshModule();
        useDeferredFetch();

        const ids = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
        ids.forEach((id) => void mod.acquireSprite(id, 'home').catch(() => undefined));
        await flush();

        // MAX_CONCURRENT = 4
        expect(pendingFetches).toHaveLength(4);
        expect(mod.spriteCacheStats()).toMatchObject({ running: 4, queued: 6 });
    });

    it('一个结算后才放行下一个', async () => {
        const mod = await freshModule();
        useDeferredFetch();

        [1, 2, 3, 4, 5].forEach((id) => void mod.acquireSprite(id, 'home').catch(() => undefined));
        await flush();
        expect(pendingFetches).toHaveLength(4);

        settle(1);
        await flush();

        expect(pendingFetches).toHaveLength(5);
        expect(mod.spriteCacheStats().running).toBe(4);
    });

    it('缓存命中不入队 —— 槽位全忙时也立刻返回', async () => {
        const mod = await freshModule();

        // 先正常拿一张进缓存
        await mod.acquireSprite(99, 'home');
        mod.releaseSprite(99, 'home');

        useDeferredFetch();
        [1, 2, 3, 4, 5, 6].forEach((id) => void mod.acquireSprite(id, 'home').catch(() => undefined));
        await flush();
        expect(mod.spriteCacheStats().running).toBe(4);

        // 槽位已满，但命中缓存的这次不该被挡住
        await expect(mod.acquireSprite(99, 'home')).resolves.toMatch(/^blob:mock\//);
    });
});

describe('调度顺序', () => {
    it('同一批内先进先出 —— 首屏自上而下出图', async () => {
        const mod = await freshModule();
        useDeferredFetch();

        // 同一帧入队 ⇒ 同批。前 4 个直接占满槽位，5..10 进队列。
        for (let id = 1; id <= 10; id += 1) {
            void mod.acquireSprite(id, 'home').catch(() => undefined);
        }
        await flush();
        expect(startedIds()).toEqual([1, 2, 3, 4]);

        // 关键断言在这里：队列有积压时腾出槽位，取的必须是同批 seq 最小的 5。
        // 纯 LIFO（takeNext 用 pop）会取 10 —— 那样首屏会「从下往上」冒。
        // 只看前 4 个是测不出来的：槽位空闲时 pump 逐个放行，任何策略都按到达序。
        settle(1);
        await flush();
        expect(startedIds()[4]).toBe(5);

        settle(2);
        await flush();
        expect(startedIds()[5]).toBe(6);
    });

    it('后一批抢在前一批之前 —— 当前视口优先', async () => {
        const mod = await freshModule();
        useDeferredFetch();

        // 第一批：占满 4 个槽 + 5..10 排队（模拟已划过去的行）
        for (let id = 1; id <= 10; id += 1) {
            void mod.acquireSprite(id, 'home').catch(() => undefined);
        }
        await flush();
        expect(startedIds()).toEqual([1, 2, 3, 4]);

        // 下一帧：当前视口的新行入队
        await nextFrame();
        for (let id = 100; id <= 103; id += 1) {
            void mod.acquireSprite(id, 'home').catch(() => undefined);
        }
        await flush();

        // 腾出一个槽位 —— 该跑的是新批的 100，不是旧批排头的 5
        settle(1);
        await flush();
        expect(startedIds()[4]).toBe(100);

        settle(2);
        await flush();
        expect(startedIds()[5]).toBe(101);
    });
});

describe('取消', () => {
    it('排队中取消：fetchBinary 从未被调用', async () => {
        const mod = await freshModule();
        useDeferredFetch();

        [1, 2, 3, 4].forEach((id) => void mod.acquireSprite(id, 'home').catch(() => undefined));
        const ac = new AbortController();
        const queued = mod.acquireSprite(50, 'home', { signal: ac.signal });
        await flush();

        expect(mod.spriteCacheStats().queued).toBe(1);
        ac.abort();

        await expect(queued).rejects.toThrow(mod.SpriteAbortError);
        expect(startedIds()).not.toContain(50);
        expect(mod.spriteCacheStats().queued).toBe(0);
    });

    it('在途取消：抛 SpriteAbortError 并腾出槽位给排队任务', async () => {
        const mod = await freshModule();
        useDeferredFetch();

        const ac = new AbortController();
        const first = mod.acquireSprite(1, 'home', { signal: ac.signal });
        [2, 3, 4, 5].forEach((id) => void mod.acquireSprite(id, 'home').catch(() => undefined));
        await flush();

        expect(startedIds()).toEqual([1, 2, 3, 4]);
        const inflightSignal = pendingFetches[0]!.signal;

        ac.abort();
        await expect(first).rejects.toThrow(mod.SpriteAbortError);
        await flush();

        // 底层请求收到了取消（binaryRequest 会据此调 RequestTask.abort）
        expect(inflightSignal?.aborted).toBe(true);
        // 槽位让给了排队中的 5
        expect(startedIds()).toContain(5);
        expect(mod.spriteCacheStats().running).toBe(4);
    });

    it('取消不残留引用，也不残留在途登记', async () => {
        const mod = await freshModule();
        useDeferredFetch();

        const ac = new AbortController();
        const p = mod.acquireSprite(1, 'home', { signal: ac.signal });
        await flush();
        ac.abort();
        await expect(p).rejects.toThrow(mod.SpriteAbortError);
        await flush();

        expect(mod.spriteCacheStats()).toMatchObject({ refs: 0, queued: 0, inflight: 0 });
    });

    it('取消是 SpriteAbortError，不是失败 —— 调用方据此区分', async () => {
        const mod = await freshModule();
        useDeferredFetch();

        const ac = new AbortController();
        const p = mod.acquireSprite(1, 'home', { signal: ac.signal });
        await flush();
        ac.abort();

        const err = await p.catch((e: unknown) => e);
        expect(mod.isSpriteAbortError(err)).toBe(true);
        // 真失败不该被误判成取消
        expect(mod.isSpriteAbortError(new Error('decrypt failed'))).toBe(false);
    });

    it('已 abort 的 signal 直接拒绝，不入队', async () => {
        const mod = await freshModule();
        useDeferredFetch();

        const ac = new AbortController();
        ac.abort();

        await expect(mod.acquireSprite(1, 'home', { signal: ac.signal })).rejects.toThrow(
            mod.SpriteAbortError,
        );
        expect(pendingFetches).toHaveLength(0);
        expect(mod.spriteCacheStats().queued).toBe(0);
    });

    it('多个等待者时，一个取消不影响另一个（列表卸载不能连累详情页）', async () => {
        const mod = await freshModule();
        useDeferredFetch();

        const ac = new AbortController();
        const cancelled = mod.acquireSprite(1, 'home', { signal: ac.signal });
        const survivor = mod.acquireSprite(1, 'home');
        await flush();

        expect(pendingFetches).toHaveLength(1);
        ac.abort();
        await expect(cancelled).rejects.toThrow(mod.SpriteAbortError);

        // 下载没被取消，另一个等待者照常拿到 url
        expect(pendingFetches[0]!.signal?.aborted).toBe(false);
        settle(1);
        await expect(survivor).resolves.toMatch(/^blob:mock\//);
        // 只有存活的那个登记了引用
        expect(mod.spriteCacheStats().refs).toBe(1);
    });

    it('取消后重新请求同一张仍能正常下载', async () => {
        const mod = await freshModule();
        useDeferredFetch();

        const ac = new AbortController();
        const p = mod.acquireSprite(1, 'home', { signal: ac.signal });
        await flush();
        ac.abort();
        await expect(p).rejects.toThrow(mod.SpriteAbortError);
        await flush();

        // 重新进视口
        const retry = mod.acquireSprite(1, 'home');
        await flush();
        settle(1);
        await expect(retry).resolves.toMatch(/^blob:mock\//);
    });
});
