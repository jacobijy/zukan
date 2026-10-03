/**
 * 顶部状态栏归一（resolveStatusBarHeight）与页面根变量 computed（usePageSafeArea）用例。
 *
 * 重点覆盖两类历史盲区：
 * - H5 必须走 env(safe-area-inset-top)（普通浏览器=0、PWA/全屏 Safari=刘海），不能写死 0；
 * - statusBarHeight 的各种坏值（0/负/NaN/Infinity/非数字）必须回退 0px，避免坏值算崩布局。
 */
import { describe, expect, it, afterEach } from 'vitest';
import { resolveStatusBarHeight } from '@/infra/platform/safeArea';
import { usePageSafeArea } from '@/composables/usePageSafeArea';
import { setStatusBarHeight } from '@/infra/platform/safeAreaState';

const ENV_TOP = 'env(safe-area-inset-top, 0px)';

afterEach(() => setStatusBarHeight('0px'));

describe('resolveStatusBarHeight', () => {
    it('H5 恒取 env()，与 info / statusBarHeight 无关', () => {
        expect(resolveStatusBarHeight('h5', null)).toBe(ENV_TOP);
        expect(resolveStatusBarHeight('h5', undefined)).toBe(ENV_TOP);
        expect(resolveStatusBarHeight('h5', { statusBarHeight: 44 })).toBe(ENV_TOP);
        expect(resolveStatusBarHeight('h5', { platform: 'ios', statusBarHeight: 47 })).toBe(ENV_TOP);
    });

    it('mp-weixin / App 用真实 statusBarHeight 数值', () => {
        expect(resolveStatusBarHeight('mp-weixin', { statusBarHeight: 44 })).toBe('44px');
        expect(resolveStatusBarHeight('app', { platform: 'ios', statusBarHeight: 47 })).toBe('47px');
        expect(resolveStatusBarHeight('app', { platform: 'android', statusBarHeight: 24 })).toBe('24px');
    });

    it('statusBarHeight 为坏值时回退 0px', () => {
        const bad = [undefined, 0, -5, NaN, Infinity, -Infinity, '44', null];
        for (const v of bad) {
            expect(resolveStatusBarHeight('mp-weixin', { statusBarHeight: v as number })).toBe('0px');
        }
    });
});

describe('usePageSafeArea', () => {
    it('注入真实高度时两键按值序列化', () => {
        setStatusBarHeight('44px');
        const s = usePageSafeArea().value;
        expect(s['--status-bar-height']).toBe('44px');
        expect(s['--navbar-total-height']).toBe('calc(44px + var(--navbar-content-height))');
    });

    it('H5 走 env 时 navbar-total 包裹 env 表达式', () => {
        setStatusBarHeight(ENV_TOP);
        const s = usePageSafeArea().value;
        expect(s['--status-bar-height']).toBe(ENV_TOP);
        expect(s['--navbar-total-height']).toBe(`calc(${ENV_TOP} + var(--navbar-content-height))`);
    });

    it('缺省为 0px（首帧 / env 前）', () => {
        const s = usePageSafeArea().value;
        expect(s['--status-bar-height']).toBe('0px');
        expect(s['--navbar-total-height']).toBe('calc(0px + var(--navbar-content-height))');
    });
});
