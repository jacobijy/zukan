/**
 * `interp`（微信 runtime-only vue-i18n 插值兜底）用例 —— src/services/i18n/ui-i18n.ts
 *
 * 背景：uni-app 在 mp/app 构建把 vue-i18n 重定向到自带的 runtime-only 版（无
 * message-compiler），运行时无法插值，`t(key, { count })` 返回 `{count}` 原文；
 * H5 用完整版（vite alias 配对 9.9），插值正常。`interp` 在 `t()` 结果上做幂等
 * 替换，两种情况输出都正确。详见 docs/i18n/i18n-bundle.md「插值兜底」。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { i18n, interp } from '@/services/i18n/ui-i18n';

// 模块加载时 `resolveUiLocale()` 会读 `uni.getStorageSync`（node 无 uni 全局），需 stub
beforeEach(() => {
    vi.stubGlobal('uni', { getStorageSync: () => '' });
});
afterEach(() => {
    vi.unstubAllGlobals();
});

describe('interp', () => {
    it('完整版（H5 / node）已插值：无 {k} 原文可替换，原样返回', () => {
        expect(interp('mine.statusDesc', { count: 3 })).toBe(
            '当前收藏 3 个宝可梦样本，可在图鉴页继续标记。',
        );
        expect(interp('dex.banner.count', { count: 0 })).toBe('当前显示 0 只');
    });

    it('微信 runtime-only 返回原文：{count} 被手动替换', () => {
        const spy = vi
            .spyOn(i18n.global, 't')
            .mockReturnValue('当前收藏 {count} 个宝可梦样本，可在图鉴页继续标记。');
        expect(interp('mine.statusDesc', { count: 7 })).toBe(
            '当前收藏 7 个宝可梦样本，可在图鉴页继续标记。',
        );
        spy.mockRestore();
    });

    it('多占位符 / 非数字参数同样替换', () => {
        const spy = vi
            .spyOn(i18n.global, 't')
            .mockReturnValue('暂无{label}招式');
        expect(interp('moves.empty', { label: '物理' })).toBe('暂无物理招式');
        spy.mockRestore();
    });

    it('原文里占位符出现多次时全部替换', () => {
        const spy = vi
            .spyOn(i18n.global, 't')
            .mockReturnValue('x {id} y {id}');
        expect(interp('detail.form.label', { id: 10001 })).toBe('x 10001 y 10001');
        spy.mockRestore();
    });

    it('英文文案（fallback locale）同样生效', () => {
        const spy = vi
            .spyOn(i18n.global, 't')
            .mockReturnValue('You have {count} favored Pokémon specimens.');
        expect(interp('mine.statusDesc', { count: 2 })).toBe(
            'You have 2 favored Pokémon specimens.',
        );
        spy.mockRestore();
    });
});
