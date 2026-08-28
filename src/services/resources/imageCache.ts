/**
 * 加密图片 Blob URL 缓存引擎（模块级共享 + 引用计数）。
 *
 * 由原 `spriteCache.ts` 泛化而来：宝可梦立绘（pokemon）与道具图标（item）共用
 * 同一套「限流调度 + 引用计数 + LRU + 离屏取消」引擎，差别（远端路径 / MIME /
 * 持久层）由 `ImageKindSpec` + 注入的 `ImagePersist` 提供。`spriteCache.ts` 现在
 * 是基于本工厂的薄封装（pokemon 种类），对外名字与签名不变。
 *
 * ## 为什么引用计数
 *
 * 单纯「卸载就 revoke」是错的：同一张图可能同时被多个组件引用（列表 + 详情），
 * 撤销正在使用的 URL 会让其它组件的图变裂图。所以按 key 记引用数：
 *
 * ```
 * acquire → refs++              命中缓存直接复用，未命中走 inflight 去重
 * release → refs--              归零后仍留在 LRU 里等淘汰（下次访问秒开）
 * 淘汰    → refs === 0 才 revoke
 * ```
 *
 * `refs > 0` 的条目**不会**被淘汰 —— 它正显示在屏幕上，撤销即裂图。因此在屏
 * 图片超过 `maxEntries` 时缓存会短暂超出上限，这是有意的取舍。
 *
 * ## 调度：批内 FIFO + 批间 LIFO + 离屏取消
 *
 * 每次 `acquire` 立刻发请求时，快速滑动会让几十个请求同时丢给浏览器，而浏览器按
 * **FIFO** 排队（H5 单域 6 连接）—— 当前视口那几张排在一堆早已划过去的图后面，
 * 表现为「从前往后逐一下载，当前页面加载很慢」。
 *
 * 所以入队限流，并给每个任务打两个标记决定出队顺序：
 *
 * - `batch` 每帧自增一次，同一帧入队的任务同批（IntersectionObserver 的投递与
 *   Vue 的挂载 flush 天然同帧）
 * - `seq` 全局单调自增
 *
 * 取任务时选 **`batch` 最大**的，同批内选 **`seq` 最小**的：
 *
 * - 首屏约 10 张同批 ⇒ 按 index 顺序出图（自上而下，符合直觉）。
 *   纯 LIFO 会让首屏「从下往上」冒，所以批内必须 FIFO。
 * - 滑动新入队的行属于更新的批 ⇒ 抢在旧批之前，当前视口优先。
 *
 * 取消同样重要：不取消在途请求的话，一个已划走的下载会占着连接槽直到自己下完
 * （实测 100–300ms × 4 槽），当前视口仍得等。排队中取消则连 `fetchBinary` 都不调。
 * 多个组件共享同一任务时**只有 waiters 归零才真取消** —— 列表卡片卸载不能连带
 * 取消详情页正在等的同一张。
 *
 * ## 跨刷新缓存
 *
 * 本引擎的缓存是纯内存的，刷新即清空。持久层在注入的 `ImagePersist`
 * （IndexedDB 存 ZKDX **密文**），由 `fetchBytes` 在走网络前先问一次，于是整条链是
 * `内存 Blob URL → IDB 密文 → 网络`。HTTP 缓存在这里救不了场：CDN 签名 URL 的
 * `t` 每次都不同，URL 不同必然 miss。
 */

import { initWasm, decryptZukan } from '@/infra/wasm';
import { getKey, clearKeyCache } from '@/services/session';
import { fetchBinary, BinaryRequestError } from '@/services/http';
import { buildCdnUrl } from '@/services/resources/cdn';
import type { ImageKindSpec } from '@/services/resources/imageKind';
import type { ImagePersist } from '@/services/resources/imagePersist';

/** 调用方取消导致的中止。正常路径，调用方不该当失败处理（别显示占位图）。 */
export class ImageAbortError extends Error {
    constructor(key: string) {
        super(`Encrypted image request aborted: ${key}`);
        this.name = 'ImageAbortError';
    }
}

export function isImageAbortError(err: unknown): boolean {
    return err instanceof ImageAbortError;
}

interface CacheEntry {
    url: string;
    /** 当前持有该 URL 的组件数；归零才允许 revoke */
    refs: number;
}

interface Job {
    key: string;
    id: number;
    variant: string;
    /** 入队所在帧；越大越新，优先服务 */
    batch: number;
    /** 全局单调序号；同批内越小越先 */
    seq: number;
    /** 已占用槽位开始跑了 —— 取消要走 AbortController 而不是移出队列 */
    started: boolean;
    /** 还在等结果的调用方数量；归零才真取消 */
    waiters: number;
    controller: AbortController | null;
    /** 放行闸门：pump 时调用，在此之前 `run` 不会执行 */
    release: () => void;
    /** 排队中取消：让 promise 直接 reject，`fetchBinary` 从未被调用 */
    cancel: () => void;
    promise: Promise<string>;
}

export interface ImageCache {
    cacheKey: (id: number, variant: string) => string;
    /** 取得图片 Blob URL 并登记一次引用；调用方必须在不用时 `release` */
    acquire: (id: number, variant: string, options?: { signal?: AbortSignal }) => Promise<string>;
    /** 释放一次引用（归零后条目仍留缓存，真正 revoke 发生在 LRU 淘汰时） */
    release: (id: number, variant: string) => void;
    /** 清空内存缓存并撤销所有 URL（登出 / DEK 轮换）；不动磁盘密文 */
    clear: () => void;
    /** 供测试与排障 */
    stats: () => { entries: number; refs: number; inflight: number; queued: number; running: number };
}

export interface CreateImageCacheOptions {
    /** 内存 LRU 条目上限 */
    maxEntries?: number;
    /** 同时在途的下载数（H5 单域 6 连接要留余量给 FB bundle） */
    maxConcurrent?: number;
    /** 中止错误工厂；默认产 `ImageAbortError`。sprite 封装注入其子类以保持 instanceof */
    abortError?: (key: string) => Error;
}

/**
 * 为一个图片种类创建独立的缓存引擎（各自的 LRU / 任务队列 / 计数器互不影响）。
 */
export function createImageCache(
    kind: string,
    spec: ImageKindSpec,
    persist: ImagePersist,
    options: CreateImageCacheOptions = {},
): ImageCache {
    const maxEntries = options.maxEntries ?? 200;
    const maxConcurrent = options.maxConcurrent ?? 4;
    const newAbortError = options.abortError ?? ((key: string) => new ImageAbortError(key));

    /** key → 条目。Map 的插入序即 LRU 序（命中时重新插入到末尾）。 */
    const cache = new Map<string, CacheEntry>();
    /** 进行中或排队中的任务。多个组件请求同一张图时只下载 + 解密一次。 */
    const jobs = new Map<string, Job>();
    /** 等待槽位的任务。出队顺序见文件头「调度」，不是先进先出。 */
    const queue: Job[] = [];
    let running = 0;

    let seqCounter = 0;
    let batchCounter = 0;
    /** 本帧是否已安排过批次自增 */
    let batchScheduled = false;

    function cacheKey(id: number, variant: string): string {
        return `${kind}:${id}/${variant}`;
    }

    /**
     * 当前批次号。每帧自增一次 —— 同一帧内入队的任务视为同一批。
     * 没有 rAF 的环境（小程序 / node 测试）退化为 16ms 定时器，语义一致。
     */
    function currentBatch(): number {
        if (!batchScheduled) {
            batchScheduled = true;
            const bump = () => {
                batchScheduled = false;
                batchCounter += 1;
            };
            if (typeof requestAnimationFrame === 'function') requestAnimationFrame(bump);
            else setTimeout(bump, 16);
        }
        return batchCounter;
    }

    /** LRU：命中后移到末尾 */
    function touch(key: string, entry: CacheEntry): void {
        cache.delete(key);
        cache.set(key, entry);
    }

    /**
     * 淘汰到 `maxEntries` 以内。只动 `refs === 0` 的条目 ——
     * 在屏的 URL 一旦 revoke，`<image>` 会立刻变裂图。
     */
    function evictIfNeeded(): void {
        if (cache.size <= maxEntries) return;

        for (const [key, entry] of cache) {
            if (cache.size <= maxEntries) break;
            if (entry.refs > 0) continue;
            cache.delete(key);
            URL.revokeObjectURL(entry.url);
        }
    }

    /**
     * 下载 + 解密单张图片。
     *
     * 三层：`persist`（IDB 密文）→ 网络。内存层在 `acquire` 里，命中走不到这里。
     *
     * CDN 403（签名过期）时清 key 重签重下一次 —— 与 `resourceManager.fetchDecrypted`
     * 同一策略。
     */
    async function fetchBytes(id: number, variant: string, signal?: AbortSignal): Promise<Uint8Array> {
        // 存储读取与「WASM + 密钥」并发启动 —— 三者互不依赖，串行会白等一个 IDB 往返。
        const storedPromise = persist.loadBytes(id, variant).catch(() => null);

        const [, key] = await Promise.all([initWasm(), getKey()]);
        let { dek, cdn } = key;

        const remotePath = spec.remotePath(id, variant);

        // 取消可能发生在等 IDB / 密钥期间；此时一个请求都还没发，直接退出
        if (signal?.aborted) throw newAbortError(cacheKey(id, variant));

        const stored = await storedPromise;
        if (stored) {
            try {
                return decryptZukan(stored, dek);
            } catch (err) {
                // 盘上那份是旧 DEK 加密的（或已损坏）。删掉再走网络 ——
                // 不删的话每次刷新都会重复这一轮「解密失败 → 重下」。
                console.warn('[imageCache] 缓存密文解密失败，重新下载', kind, id, variant, err);
                await persist.dropBytes(id, variant).catch(() => {});
            }
        }

        let encrypted: Uint8Array;
        try {
            encrypted = await fetchBinary(buildCdnUrl(remotePath, cdn), { signal });
        } catch (err) {
            if (err instanceof BinaryRequestError && err.statusCode === 403) {
                clearKeyCache();
                const fresh = await getKey();
                dek = fresh.dek;
                cdn = fresh.cdn;
                encrypted = await fetchBinary(buildCdnUrl(remotePath, cdn), { signal });
            } else {
                throw err;
            }
        }

        // 先解密：解不开的字节不值得存（存了下次还是走这条失败路径）。
        const plain = decryptZukan(encrypted, dek);

        // 落盘不阻塞返回 —— 调用方等的是这张图，不是 IDB 写完。存的是**密文**。
        void persist.saveBytes(id, variant, encrypted);

        return plain;
    }

    /**
     * 挑下一个该跑的任务：`batch` 最大优先，同批内 `seq` 最小优先。
     * 队列规模最多几百且 pump 只在任务结算时触发，线性扫描的开销可忽略。
     */
    function takeNext(): Job | undefined {
        if (queue.length === 0) return undefined;

        let bestIndex = 0;
        for (let i = 1; i < queue.length; i += 1) {
            const candidate = queue[i]!;
            const best = queue[bestIndex]!;
            if (candidate.batch > best.batch || (candidate.batch === best.batch && candidate.seq < best.seq)) {
                bestIndex = i;
            }
        }

        return queue.splice(bestIndex, 1)[0];
    }

    /** 有空槽就放行下一个任务。`running` 在此同步自增，故上限严格成立。 */
    function pump(): void {
        while (running < maxConcurrent) {
            const job = takeNext();
            if (!job) return;
            running += 1;
            job.started = true;
            job.release();
        }
    }

    function removeFromQueue(job: Job): void {
        const index = queue.indexOf(job);
        if (index >= 0) queue.splice(index, 1);
    }

    /**
     * 建任务并入队。闸门（gate promise）在 `pump()` 放行前不 resolve，
     * 因此排队中取消时 `fetchBytes` 根本不会被调用。
     */
    function createJob(key: string, id: number, variant: string): Job {
        let releaseGate!: () => void;
        let cancelGate!: () => void;
        const gate = new Promise<void>((resolve, reject) => {
            releaseGate = resolve;
            cancelGate = () => reject(newAbortError(key));
        });

        const job: Job = {
            key,
            id,
            variant,
            batch: currentBatch(),
            seq: (seqCounter += 1),
            started: false,
            waiters: 0,
            controller: typeof AbortController === 'function' ? new AbortController() : null,
            release: releaseGate,
            cancel: cancelGate,
            promise: undefined as unknown as Promise<string>,
        };

        job.promise = gate
            .then(async () => {
                try {
                    const bytes = await fetchBytes(id, variant, job.controller?.signal);
                    const url = URL.createObjectURL(new Blob([bytes], { type: spec.mime }));

                    // 条目在这里就登记（refs: 0）。若等到 acquire 的 await 之后再建，
                    // 所有调用方都已放弃时这个 URL 就进不了 cache，永远无人 revoke。
                    // evictIfNeeded 留给 acquire 在 refs++ 之后调 —— 否则刚建好的
                    // 条目可能被自己触发的淘汰撤销掉。
                    if (!cache.has(key)) cache.set(key, { url, refs: 0 });
                    return cache.get(key)!.url;
                } finally {
                    running -= 1;
                    if (jobs.get(key) === job) jobs.delete(key);
                    pump();
                }
            })
            .catch((err) => {
                // 排队中被取消：闸门 reject，上面的 finally 不会执行（从未占用槽位）
                if (!job.started && jobs.get(key) === job) jobs.delete(key);
                throw err;
            });

        // 失败或取消的 promise 无人 await 时不要触发 unhandledrejection
        job.promise.catch(() => undefined);

        jobs.set(key, job);
        queue.push(job);
        return job;
    }

    async function acquire(
        id: number,
        variant: string,
        acquireOptions: { signal?: AbortSignal } = {},
    ): Promise<string> {
        const key = cacheKey(id, variant);

        // 命中缓存不入队 —— 槽位全忙时也应立刻返回
        const hit = cache.get(key);
        if (hit) {
            hit.refs += 1;
            touch(key, hit);
            return hit.url;
        }

        const { signal } = acquireOptions;
        if (signal?.aborted) throw newAbortError(key);

        const job = jobs.get(key) ?? createJob(key, id, variant);
        job.waiters += 1;

        let aborted = false;
        /**
         * 本次调用自己的中止通道。
         *
         * 不能只靠 `await job.promise` —— 还有别的等待者时任务**不会**被取消，
         * 那样本次调用会一直挂到共享下载结束（详情页与列表同时要同一张时必然发生）。
         * 所以每个调用方都能独立提前退出。
         */
        let rejectAborted: ((err: Error) => void) | undefined;
        const abortRace = signal
            ? new Promise<never>((_resolve, reject) => {
                  rejectAborted = reject;
              })
            : null;
        // 没走到 race 时（正常完成）这个 promise 无人处理，避免 unhandledrejection
        abortRace?.catch(() => undefined);

        const onAbort = () => {
            aborted = true;
            job.waiters -= 1;
            // 还有别的组件在等同一张（列表 + 详情）—— 不取消下载，但本次调用立刻退出
            if (job.waiters <= 0) {
                if (job.started) {
                    // 先摘掉登记，避免紧接着的 acquire 挂到这个将死的任务上
                    if (jobs.get(key) === job) jobs.delete(key);
                    job.controller?.abort();
                } else {
                    removeFromQueue(job);
                    job.cancel();
                }
            }
            rejectAborted?.(newAbortError(key));
        };
        signal?.addEventListener('abort', onAbort);

        pump();

        try {
            let url: string;
            try {
                url = abortRace ? await Promise.race([job.promise, abortRace]) : await job.promise;
            } catch (err) {
                // 取消在途请求时，底层抛的是 BinaryRequestError(aborted) 而不是
                // ImageAbortError。统一成后者，否则调用方会把「划出视口」当成解密失败。
                if (aborted || (err instanceof BinaryRequestError && err.aborted)) {
                    throw newAbortError(key);
                }
                throw err;
            }
            if (aborted) throw newAbortError(key);

            // 并发 await 同一 promise 的调用方拿到的是同一个 url，
            // 因此这里只需登记引用，不会重复 createObjectURL。
            const entry = cache.get(key) ?? { url, refs: 0 };
            entry.refs += 1;
            touch(key, entry);
            evictIfNeeded();

            return entry.url;
        } finally {
            signal?.removeEventListener('abort', onAbort);
            if (!aborted) job.waiters -= 1;
        }
    }

    function release(id: number, variant: string): void {
        const entry = cache.get(cacheKey(id, variant));
        if (entry && entry.refs > 0) entry.refs -= 1;
    }

    /**
     * 清空**内存**缓存并撤销所有 URL。登出 / DEK 轮换时调用。
     *
     * 刻意不动持久层磁盘缓存：那里存的是密文，没有 DEK 解不开，留着不构成泄露，
     * 而下次登录还能直接命中。真要清（版本升级）走 `pruneVersions`。
     */
    function clear(): void {
        for (const entry of cache.values()) {
            URL.revokeObjectURL(entry.url);
        }
        cache.clear();

        // 排队中的任务直接取消，一个请求都不发
        for (const job of queue.splice(0)) {
            jobs.delete(job.key);
            job.cancel();
        }

        // 在途的也中止：调用时机是登出 / DEK 轮换，它们手里的密钥马上就失效了，
        // 让它们跑完只会白占槽位并往缓存里塞一批用旧 DEK 解出来的图。
        for (const job of jobs.values()) {
            job.controller?.abort();
        }
        jobs.clear();
    }

    function stats(): { entries: number; refs: number; inflight: number; queued: number; running: number } {
        let refs = 0;
        for (const entry of cache.values()) refs += entry.refs;
        return {
            entries: cache.size,
            refs,
            inflight: jobs.size,
            queued: queue.length,
            running,
        };
    }

    return { cacheKey, acquire, release, clear, stats };
}
