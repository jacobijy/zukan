/**
 * 平台归一、登录能力矩阵与启用闸门用例。
 *
 * 矩阵数据刻意覆盖「双 provider」平台（app-ios 同时支持微信 + Apple）——这是
 * OR/AND 语义盲区：单 provider 平台上漏判一个也发现不了。
 */
import { describe, expect, it, vi } from 'vitest';
import { resolvePlatform, supportedProviders, weixinAppType } from '@/infra/platform';
import { parseEnabledProviders } from '@/services/platform/providerConfig';

describe('resolvePlatform', () => {
    it('h5 / mp-weixin 宿主直接归一，不依赖 system info', () => {
        expect(resolvePlatform('h5', null)).toBe('h5');
        expect(resolvePlatform('mp-weixin', { platform: 'ios' })).toBe('mp-weixin');
    });

    it('app 宿主按 info.platform 区分 iOS/Android，且大小写不敏感', () => {
        expect(resolvePlatform('app', { platform: 'ios' })).toBe('app-ios');
        expect(resolvePlatform('app', { platform: 'Android' })).toBe('app-android');
    });

    it('app 宿主拿不到 os 时归为 unknown', () => {
        expect(resolvePlatform('app', {})).toBe('unknown');
        expect(resolvePlatform('app', { platform: 'devtools' })).toBe('unknown');
    });

    it('unknown 宿主始终 unknown', () => {
        expect(resolvePlatform('unknown', { platform: 'ios' })).toBe('unknown');
    });
});

describe('supportedProviders 能力矩阵', () => {
    it('mp-weixin 仅微信', () => {
        expect(supportedProviders('mp-weixin')).toEqual(['weixin']);
    });

    it('app-ios 必须同时含微信与 Apple（App Store 要求）', () => {
        expect(supportedProviders('app-ios')).toEqual(['weixin', 'apple']);
    });

    it('app-android 仅微信、不含 Apple', () => {
        expect(supportedProviders('app-android')).toEqual(['weixin']);
        expect(supportedProviders('app-android')).not.toContain('apple');
    });

    it('h5 / unknown 静态矩阵为空（网页扫码另算）', () => {
        expect(supportedProviders('h5')).toEqual([]);
        expect(supportedProviders('unknown')).toEqual([]);
    });
});

describe('weixinAppType', () => {
    it('按平台映射来源类型', () => {
        expect(weixinAppType('mp-weixin')).toBe('mp');
        expect(weixinAppType('app-ios')).toBe('app');
        expect(weixinAppType('app-android')).toBe('app');
        expect(weixinAppType('h5')).toBe('web');
    });
});

describe('parseEnabledProviders', () => {
    it('空输入返回空数组（默认全关）', () => {
        expect(parseEnabledProviders(undefined)).toEqual([]);
        expect(parseEnabledProviders('')).toEqual([]);
    });

    it('解析、去空白、按固定顺序输出', () => {
        expect(parseEnabledProviders('apple, weixin')).toEqual(['weixin', 'apple']);
    });

    it('忽略未知/重复 provider', () => {
        expect(parseEnabledProviders('weixin,foobar,weixin')).toEqual(['weixin']);
    });
});

describe('selectVisibleProviders（capability ∩ enabled）', () => {
    it('默认未配置时任何平台都不渲染', async () => {
        vi.resetModules();
        const mod = await import('@/services/platform/providerConfig');
        expect(mod.selectVisibleProviders('app-ios')).toEqual([]);
        expect(mod.selectVisibleProviders('mp-weixin')).toEqual([]);
    });

    it('启用后与平台能力取交：android 启用 apple 也不渲染', async () => {
        vi.stubEnv('VITE_AUTH_PROVIDERS', 'weixin,apple,phone');
        vi.resetModules();
        const mod = await import('@/services/platform/providerConfig');
        expect(mod.selectVisibleProviders('app-ios')).toEqual(['weixin', 'apple']);
        expect(mod.selectVisibleProviders('app-android')).toEqual(['weixin']);
        expect(mod.selectVisibleProviders('mp-weixin')).toEqual(['weixin']);
        vi.unstubAllEnvs();
    });
});
