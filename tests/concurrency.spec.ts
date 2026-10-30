/**
 * mapWithConcurrency 用例（`src/utils/concurrency.ts`）
 *
 * 覆盖：并发上限、每项恰好一次、空数组、limit 越界 clamp、worker 抛错传播。
 */
import { describe, expect, it } from 'vitest';
import { mapWithConcurrency } from '@/utils/concurrency';

const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

describe('mapWithConcurrency', () => {
    it('并发不超过 limit，且每项恰好处理一次', async () => {
        const pending: Array<() => void> = [];
        const seen: number[] = [];
        let active = 0;
        let maxActive = 0;

        const task = mapWithConcurrency([0, 1, 2, 3, 4, 5, 6, 7, 8, 9], 3, async (n) => {
            seen.push(n);
            active++;
            maxActive = Math.max(maxActive, active);
            await new Promise<void>((resolve) => pending.push(resolve));
            active--;
        });

        // 入口同步启动 limit 个 drain，worker 都停在 deferred 上
        expect(active).toBe(3);

        async function releaseUntilDone(): Promise<void> {
            if (seen.length >= 10 && pending.length === 0) return;
            pending.shift()?.();
            await flush();
            return releaseUntilDone();
        }
        await releaseUntilDone();
        await task;

        expect(maxActive).toBe(3);
        expect(seen).toHaveLength(10);
        expect(new Set(seen).size).toBe(10);
    });

    it('空数组直接 resolve，不调用 worker', async () => {
        let calls = 0;
        await mapWithConcurrency([], 4, async () => {
            calls++;
        });
        expect(calls).toBe(0);
    });

    it('limit 越界安全 clamp（<=0 按 1，超大按数组长度）', async () => {
        let active = 0;
        let maxActive = 0;
        const worker = async (): Promise<void> => {
            active++;
            maxActive = Math.max(maxActive, active);
            await flush();
            active--;
        };

        await mapWithConcurrency([1, 2, 3], 0, worker);
        expect(maxActive).toBe(1);

        maxActive = 0;
        await mapWithConcurrency([1, 2, 3], 999, worker);
        expect(maxActive).toBe(3);
    });

    it('worker 抛错 → 整体 reject', async () => {
        await expect(
            mapWithConcurrency([1, 2, 3], 2, async (n) => {
                if (n === 2) throw new Error('boom');
            }),
        ).rejects.toThrow('boom');
    });
});
