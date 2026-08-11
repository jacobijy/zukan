/**
 * `src/utils/virtualWindow.ts` 用例
 *
 * 虚拟滚动最容易错的是 off-by-one 与边界越界，而这类错误在页面上只表现为
 * "某些滚动位置漏一行"或"滚到底缺最后几条"，靠肉眼很难稳定复现 —— 所以窗口
 * 计算抽成纯函数在这里逐个位置断言。
 *
 * 几何取实测值（CDP 量的真实布局）：
 * - mobile: 卡高 98, gap 12 → pitch 110
 * - ≥640px: 卡高 106, gap 16 → pitch 122
 */
import { describe, expect, it } from 'vitest';
import { computeVirtualWindow, type VirtualWindowInput } from '@/utils/virtualWindow';

/** 实测的移动端几何 */
const MOBILE = { cardHeight: 98, rowGap: 12 } as const;
/** 实测的桌面端几何 */
const DESKTOP = { cardHeight: 106, rowGap: 16 } as const;

const win = (over: Partial<VirtualWindowInput> = {}) =>
    computeVirtualWindow({
        scrollTop: 0,
        viewportHeight: 600,
        total: 1025,
        columns: 1,
        ...MOBILE,
        ...over,
    });

describe('总高与行数', () => {
    it('单列 1025 条：行数 = 条数', () => {
        const r = win();
        expect(r.totalRows).toBe(1025);
    });

    it('末行不占行间距（否则底部多出一条空白）', () => {
        // 3 行：98*3 + 12*2 = 318
        const r = win({ total: 3 });
        expect(r.spacerHeight).toBe(98 * 3 + 12 * 2);
    });

    it('单行时总高就是卡高', () => {
        expect(win({ total: 1 }).spacerHeight).toBe(98);
    });

    it.each([
        [1, 1025],
        [2, 513],
        [3, 342],
    ])('%i 列时行数为 %i', (columns, rows) => {
        expect(win({ columns }).totalRows).toBe(rows);
    });

    it('桌面端几何：3 列 342 行', () => {
        const r = win({ columns: 3, ...DESKTOP });
        expect(r.totalRows).toBe(342);
        expect(r.spacerHeight).toBe(342 * 122 - 16);
    });
});

describe('窗口位置', () => {
    it('顶部：从第 0 行起，不出现负数', () => {
        const r = win({ scrollTop: 0 });
        expect(r.firstRow).toBe(0);
        expect(r.firstIndex).toBe(0);
        expect(r.offsetTop).toBe(0);
    });

    it('中部：窗口覆盖视口并带 overscan', () => {
        // scrollTop 5500 → 第 50 行（5500/110）
        const r = win({ scrollTop: 5500, viewportHeight: 600 });
        expect(r.firstRow).toBe(48); // 50 - 2 overscan
        // 视口底 6100 → ceil(6100/110)=56，+2 = 58
        expect(r.lastRow).toBe(58);
        expect(r.offsetTop).toBe(48 * 110);
    });

    it('offsetTop 始终等于 firstRow * pitch（定位不漂移）', () => {
        for (const scrollTop of [0, 137, 1100, 5500, 40_000, 112_000]) {
            const r = win({ scrollTop });
            expect(r.offsetTop).toBe(r.firstRow * 110);
        }
    });

    it('底部：窗口含最后一条', () => {
        const r = win({ scrollTop: 112_138, viewportHeight: 600 });
        expect(r.lastRow).toBe(1024);
        expect(r.lastIndex).toBe(1024);
    });

    it('overscan 不越过末行', () => {
        const r = win({ scrollTop: 112_138 });
        expect(r.lastRow).toBeLessThanOrEqual(r.totalRows - 1);
        expect(r.lastIndex).toBeLessThanOrEqual(1024);
    });
});

describe('边界与异常输入', () => {
    it('total = 0：空窗口，不产生负下标以外的渲染', () => {
        const r = win({ total: 0 });
        expect(r.lastIndex).toBe(-1);
        expect(r.lastRow).toBe(-1);
        expect(r.spacerHeight).toBe(0);
        expect(r.totalRows).toBe(0);
    });

    it('total 小于一屏：窗口就是全部', () => {
        const r = win({ total: 3, viewportHeight: 600 });
        expect(r.firstIndex).toBe(0);
        expect(r.lastIndex).toBe(2);
    });

    it('负 scrollTop（iOS 橡皮筋）回退到顶部', () => {
        const r = win({ scrollTop: -240 });
        expect(r.firstRow).toBe(0);
        expect(r.firstIndex).toBe(0);
        expect(r.offsetTop).toBe(0);
    });

    it('scrollTop 超过最大值也不越界', () => {
        const r = win({ scrollTop: 999_999 });
        expect(r.firstRow).toBeLessThanOrEqual(r.totalRows - 1);
        expect(r.lastRow).toBe(r.totalRows - 1);
        expect(r.lastIndex).toBe(1024);
        expect(r.firstRow).toBeLessThanOrEqual(r.lastRow);
    });

    it('columns = 0 视为 1，不产生 Infinity 行', () => {
        const r = win({ columns: 0 });
        expect(Number.isFinite(r.totalRows)).toBe(true);
        expect(r.totalRows).toBe(1025);
    });

    it('cardHeight = 0（未测到几何）返回空窗口，交给调用方降级', () => {
        const r = win({ cardHeight: 0 });
        expect(r.lastIndex).toBe(-1);
        expect(r.spacerHeight).toBe(0);
    });

    it('viewportHeight = 0 时仍至少给出 overscan 范围', () => {
        const r = win({ viewportHeight: 0, scrollTop: 0 });
        expect(r.firstRow).toBe(0);
        expect(r.lastRow).toBeGreaterThanOrEqual(0);
    });
});

describe('末行不满', () => {
    it('lastIndex 不超过 total-1', () => {
        // 3 列 1025 条 → 末行只有 1025 - 341*3 = 2 条
        const r = win({ columns: 3, scrollTop: 999_999, ...DESKTOP });
        expect(r.totalRows).toBe(342);
        expect(r.lastRow).toBe(341);
        expect(r.lastIndex).toBe(1024);
    });

    it('整除时末行是满的', () => {
        const r = win({ total: 30, columns: 3, scrollTop: 999_999 });
        expect(r.totalRows).toBe(10);
        expect(r.lastIndex).toBe(29);
    });
});

describe('遍历完整性（关键不变量）', () => {
    // 逐屏滚动应能覆盖每一个下标，一个都不漏
    it.each([1, 2, 3])('%i 列：逐屏滚动覆盖全部 1025 条', (columns) => {
        const total = 1025;
        const pitch = MOBILE.cardHeight + MOBILE.rowGap;
        const viewportHeight = 600;
        const seen = new Set<number>();

        const first = win({ columns, total, scrollTop: 0, viewportHeight });
        const maxScroll = Math.max(0, first.spacerHeight - viewportHeight);

        // 步长取半屏，确保不跳过任何行
        for (let st = 0; st <= maxScroll + pitch; st += viewportHeight / 2) {
            const r = win({ columns, total, scrollTop: st, viewportHeight });
            for (let i = r.firstIndex; i <= r.lastIndex; i += 1) seen.add(i);
        }

        expect(seen.size).toBe(total);
        expect(Math.min(...seen)).toBe(0);
        expect(Math.max(...seen)).toBe(total - 1);
    });

    it('相邻滚动位置的窗口连续（不留空洞）', () => {
        const viewportHeight = 600;
        let prevLast = -1;
        for (let st = 0; st <= 112_000; st += viewportHeight) {
            const r = win({ scrollTop: st, viewportHeight });
            // 下一屏的起点不能跳过上一屏的终点
            expect(r.firstIndex).toBeLessThanOrEqual(prevLast + 1);
            prevLast = Math.max(prevLast, r.lastIndex);
        }
    });
});
