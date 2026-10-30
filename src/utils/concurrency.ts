/**
 * 并发上限内的批量异步遍历（纯函数，零平台依赖）。
 *
 * - 共享游标 + `width` 个 drain 循环：任一任务完成立刻取下一个，不做「分批发船」，
 *   避免慢请求拖住整批。
 * - worker 抛错会 reject 整体 Promise（调用方自行按 item 捕获）。
 * - 不取消已经在途的任务。
 */
export async function mapWithConcurrency<T>(
    items: readonly T[],
    limit: number,
    worker: (item: T, index: number) => Promise<void>,
): Promise<void> {
    if (items.length === 0) return;

    const safeLimit = Number.isFinite(limit) ? Math.floor(limit) : 1;
    const width = Math.min(items.length, Math.max(1, safeLimit));

    let cursor = 0;
    async function drain(): Promise<void> {
        while (true) {
            const index = cursor++;
            if (index >= items.length) return;
            // 每条 lane 串行取下一个任务；跨 lane 已由 Promise.all 并行，这是分发器本意
            // eslint-disable-next-line no-await-in-loop
            await worker(items[index]!, index);
        }
    }

    await Promise.all(Array.from({ length: width }, () => drain()));
}
