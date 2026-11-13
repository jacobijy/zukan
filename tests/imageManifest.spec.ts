/**
 * `src/services/resources/imageManifest.ts` 用例 —— C1-A 图片 hash 清单查询层。
 *
 * 守四条：
 * 1. **同步查表、异步拉取分离**：`hashForPath` 读模块级快照，`refreshManifest` 拉新并替换；
 *    快照未就绪 / 失败 → undefined，调用方走无 hash 旧路径（向后兼容）。
 * 2. **失败保留旧快照**：清空会让已生效的 hash 全数退回旧 key → 全量重下，正是 C1-A 要消灭的。
 * 3. **时间闸**（`MIN_REFRESH_INTERVAL_MS`，假定时器）：小程序 `wx.request` 无 304，间隔内重复
 *    前台不该再整包拉一次；但「从未成功」不受闸（离线启动后每个前台都要重试）。
 * 4. **并发去重**：拉取进行中的重复调用复用同一 inflight。
 *
 * 每次用 `freshManifest()`（vi.resetModules + import）拿新模块，保证快照 / 时间戳不跨用例泄漏。
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

const MIN = 1000 * 60 * 5;

function bytesOf(s: string): Uint8Array {
    return new TextEncoder().encode(s);
}

function manifest(files: Record<string, unknown>): Uint8Array {
    return bytesOf(JSON.stringify({ version: 3, files }));
}

type ManifestModule = typeof import('@/services/resources/imageManifest');

async function freshManifest(): Promise<ManifestModule> {
    vi.resetModules();
    return import('@/services/resources/imageManifest');
}

afterEach(() => {
    vi.useRealTimers();
});

describe('hashForPath 相对路径解析', () => {
    it('命中：带/不带前导 /、带 query 的 remotePath 剥掉 assets/encrypted/ 精确查表', async () => {
        const { refreshManifest, hashForPath } = await freshManifest();
        await refreshManifest({
            fetch: async () =>
                manifest({ 'pokemon/1/home.bin': { h: 'aabbccdd' }, 'items/4.bin': { h: '11223344' } }),
        });

        expect(hashForPath('/assets/encrypted/pokemon/1/home.bin')).toBe('aabbccdd');
        expect(hashForPath('assets/encrypted/items/4.bin')).toBe('11223344');
        expect(hashForPath('/assets/encrypted/pokemon/1/home.bin?v=aabbccdd')).toBe('aabbccdd');
    });

    it('未收录 / 无 h 字段的条目不进快照 → undefined', async () => {
        const { refreshManifest, hashForPath } = await freshManifest();
        await refreshManifest({
            fetch: async () => manifest({ 'pokemon/2/home.bin': { m: 1712 } }),
        });

        expect(hashForPath('/assets/encrypted/pokemon/1/home.bin')).toBeUndefined();
        expect(hashForPath('/assets/encrypted/pokemon/2/home.bin')).toBeUndefined();
    });

    it('前缀剥取不会误伤 encrypted-assets 这类近名目录（剥不掉则查表 miss）', async () => {
        const { refreshManifest, hashForPath } = await freshManifest();
        await refreshManifest({
            fetch: async () => manifest({ 'pokemon/1/home.bin': { h: 'aabbccdd' } }),
        });

        expect(hashForPath('/assets/encrypted-assets/pokemon/1/home.bin')).toBeUndefined();
        expect(hashForPath('/other/encrypted/pokemon/1/home.bin')).toBeUndefined();
    });

    it('首拉失败（老后端 404 / 离线）→ 快照 null → 全部 undefined', async () => {
        const { refreshManifest, hashForPath } = await freshManifest();
        await refreshManifest({ fetch: async () => Promise.reject(new Error('network')) });

        expect(hashForPath('/assets/encrypted/pokemon/1/home.bin')).toBeUndefined();
    });
});

describe('快照维护', () => {
    it('刷新失败保留旧快照，不清空已生效 hash', async () => {
        vi.useFakeTimers();
        const { refreshManifest, hashForPath } = await freshManifest();
        await refreshManifest({
            fetch: async () => manifest({ 'pokemon/1/home.bin': { h: 'aabbccdd' } }),
        });
        expect(hashForPath('/assets/encrypted/pokemon/1/home.bin')).toBe('aabbccdd');

        // 推进超过刷新间隔，让第二次 refresh 真的打 fetch（否则被时间闸拦下，测的是闸不是失败分支）
        await vi.advanceTimersByTimeAsync(MIN + 1_000);
        await refreshManifest({ fetch: async () => Promise.reject(new Error('boom')) });

        expect(hashForPath('/assets/encrypted/pokemon/1/home.bin')).toBe('aabbccdd');
    });

    it('畸形 JSON / 截断内容不抛进调用方，保留旧快照', async () => {
        vi.useFakeTimers();
        const { refreshManifest, hashForPath } = await freshManifest();
        await refreshManifest({
            fetch: async () => manifest({ 'pokemon/1/home.bin': { h: 'aabbccdd' } }),
        });
        await vi.advanceTimersByTimeAsync(MIN + 1_000);

        // 截断 / 逐字节解码出破坏 UTF-8 的中文字符 —— decode 或 parse 失败必须只 warn
        await expect(
            refreshManifest({ fetch: async () => bytesOf('{"files": ') }),
        ).resolves.toBeUndefined();
        await expect(
            refreshManifest({ fetch: async () => bytesOf('中文{"files":{}}') }),
        ).resolves.toBeUndefined();

        expect(hashForPath('/assets/encrypted/pokemon/1/home.bin')).toBe('aabbccdd');
    });

    it('缺 files 的清单 → 快照为空对象，不炸不残留', async () => {
        const { refreshManifest, hashForPath } = await freshManifest();
        await refreshManifest({ fetch: async () => bytesOf('{"version":3}') });

        expect(hashForPath('/assets/encrypted/pokemon/1/home.bin')).toBeUndefined();
    });
});

describe('拉取频控', () => {
    it('间隔内重复刷新不重新拉取（时间闸）', async () => {
        vi.useFakeTimers();
        const fetchImpl = vi.fn(async () => manifest({}));
        const { refreshManifest } = await freshManifest();

        await refreshManifest({ fetch: fetchImpl });
        await refreshManifest({ fetch: fetchImpl });
        expect(fetchImpl).toHaveBeenCalledTimes(1);

        await vi.advanceTimersByTimeAsync(MIN + 1_000);
        await refreshManifest({ fetch: fetchImpl });
        expect(fetchImpl).toHaveBeenCalledTimes(2);
    });

    it('快照为 null（从未成功）时不受时间闸限制，仍会立即重试', async () => {
        vi.useFakeTimers();
        const fetchImpl = vi.fn(async () => {
            throw new Error('offline');
        });
        const { refreshManifest } = await freshManifest();

        await refreshManifest({ fetch: fetchImpl });
        // 未推进时间（间隔内），但上次是失败 —— lastRefreshAt 未更新，必须放行重试
        await refreshManifest({ fetch: fetchImpl });
        expect(fetchImpl).toHaveBeenCalledTimes(2);
    });

    it('并发调用复用同一 inflight：fetch 只调一次', async () => {
        let releaseFetch!: (b: Uint8Array) => void;
        const fetchImpl = vi.fn(() => new Promise<Uint8Array>((resolve) => {
            releaseFetch = resolve;
        }));
        const { refreshManifest } = await freshManifest();

        const p1 = refreshManifest({ fetch: fetchImpl });
        const p2 = refreshManifest({ fetch: fetchImpl });
        expect(fetchImpl).toHaveBeenCalledTimes(1);

        releaseFetch(manifest({}));
        await Promise.all([p1, p2]);
        expect(fetchImpl).toHaveBeenCalledTimes(1);
    });
});