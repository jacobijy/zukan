/**
 * 平台管理对象（services/platform/managers）用例。
 *
 * stub uni.login（成功给凭据 / 失败 / 不同 provider），mock authApi，通过
 * getPlatformManager(platform) 取各平台对象驱动：微信按平台传对 app_type、
 * Apple 带一次性 nonce、本机号解析 authResult、绑定/解绑走对应凭据，
 * 不支持的 provider、凭据缺失与授权失败正确上抛；并校验 registry 选型与单例。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getPlatformManager } from '@/services/platform/managers';
import { AppManager } from '@/services/platform/managers/app';
import { AppAndroidManager } from '@/services/platform/managers/appAndroid';
import { AppIosManager } from '@/services/platform/managers/appIos';
import { H5Manager } from '@/services/platform/managers/h5';
import { MpWeixinManager } from '@/services/platform/managers/mpWeixin';
import { UnknownManager } from '@/services/platform/managers/unknown';

// vi.hoisted 与下方 vi.mock 一起提升，保证 mock 工厂执行时 mocks 已初始化
// （本文件顶层静态 import managers → 会立即触发 @/services/api 的 mock）。
const authApiMocks = vi.hoisted(() => ({
    loginWithWeixin: vi.fn().mockResolvedValue({ new_user: false }),
    loginWithApple: vi.fn().mockResolvedValue({ new_user: false }),
    loginWithPhone: vi.fn().mockResolvedValue({ new_user: false }),
    bindIdentity: vi.fn().mockResolvedValue({ identities: ['weixin'] }),
    unbindIdentity: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/services/api', () => ({ authApi: authApiMocks }));

let loginImpl: ((opts: UniNamespace.LoginOptions) => void) | null = null;
beforeEach(() => {
    Object.values(authApiMocks).forEach((m) => m.mockClear());
    loginImpl = null;
    vi.stubGlobal('uni', {
        login: (opts: UniNamespace.LoginOptions) => loginImpl?.(opts),
    });
});

function succeeds(res: unknown) {
    loginImpl = (opts) => opts.success?.(res as UniNamespace.LoginRes);
}
function fails(msg: string) {
    loginImpl = (opts) => opts.fail?.({ errMsg: msg });
}

describe('registry 平台选型与单例', () => {
    it('按平台返回对应管理对象', () => {
        expect(getPlatformManager('h5')).toBeInstanceOf(H5Manager);
        expect(getPlatformManager('mp-weixin')).toBeInstanceOf(MpWeixinManager);
        expect(getPlatformManager('app-ios')).toBeInstanceOf(AppIosManager);
        expect(getPlatformManager('app-android')).toBeInstanceOf(AppAndroidManager);
        expect(getPlatformManager('unknown')).toBeInstanceOf(UnknownManager);
    });

    it('iOS / Android 同属 AppManager 基类', () => {
        expect(getPlatformManager('app-ios')).toBeInstanceOf(AppManager);
        expect(getPlatformManager('app-android')).toBeInstanceOf(AppManager);
    });

    it('携带正确平台标识，且同平台重复获取为同一实例', () => {
        expect(getPlatformManager('mp-weixin').platform).toBe('mp-weixin');
        expect(getPlatformManager('mp-weixin')).toBe(getPlatformManager('mp-weixin'));
    });
});

describe('微信登录', () => {
    it('mp-weixin：取 code 后以 app_type=mp 提交', async () => {
        succeeds({ code: 'wx-code' });
        await getPlatformManager('mp-weixin').login('weixin');
        expect(authApiMocks.loginWithWeixin).toHaveBeenCalledWith({ code: 'wx-code', app_type: 'mp' });
    });

    it('app-android / app-ios：app_type=app', async () => {
        succeeds({ code: 'c' });
        await getPlatformManager('app-android').login('weixin');
        expect(authApiMocks.loginWithWeixin).toHaveBeenCalledWith({ code: 'c', app_type: 'app' });

        succeeds({ code: 'c2' });
        await getPlatformManager('app-ios').login('weixin');
        expect(authApiMocks.loginWithWeixin).toHaveBeenLastCalledWith({ code: 'c2', app_type: 'app' });
    });

    it('未返回 code 时抛错，不调用 api', async () => {
        succeeds({});
        await expect(getPlatformManager('mp-weixin').login('weixin')).rejects.toThrow();
        expect(authApiMocks.loginWithWeixin).not.toHaveBeenCalled();
    });
});

describe('Apple 登录', () => {
    it('提交 identity_token、authorization_code 与一次性 nonce', async () => {
        succeeds({ identityToken: 'id-token', code: 'auth-code' });
        await getPlatformManager('app-ios').login('apple');
        expect(authApiMocks.loginWithApple).toHaveBeenCalledWith({
            identity_token: 'id-token',
            authorization_code: 'auth-code',
            nonce: expect.any(String),
        });
    });

    it('两次登录 nonce 不同（防重放）', async () => {
        succeeds({ identityToken: 't' });
        await getPlatformManager('app-ios').login('apple');
        succeeds({ identityToken: 't2' });
        await getPlatformManager('app-ios').login('apple');
        const n1 = authApiMocks.loginWithApple.mock.calls[0][0].nonce;
        const n2 = authApiMocks.loginWithApple.mock.calls[1][0].nonce;
        expect(n1).not.toBe(n2);
    });

    it('缺 identityToken 抛错', async () => {
        succeeds({ code: 'x' });
        await expect(getPlatformManager('app-ios').login('apple')).rejects.toThrow();
    });
});

describe('本机号一键登录', () => {
    it('解析 authResult 中的 access_token', async () => {
        succeeds({ authResult: JSON.stringify({ access_token: 'phone-tok' }) });
        await getPlatformManager('app-android').login('phone');
        expect(authApiMocks.loginWithPhone).toHaveBeenCalledWith({ access_token: 'phone-tok' });
    });

    it('authResult 非法 / 缺 token 抛错', async () => {
        succeeds({ authResult: 'not-json' });
        await expect(getPlatformManager('app-android').login('phone')).rejects.toThrow();
    });
});

describe('授权失败', () => {
    it('uni.login fail 错误上抛', async () => {
        fails('login:fail');
        await expect(getPlatformManager('mp-weixin').login('weixin')).rejects.toThrow('login:fail');
    });
});

describe('绑定 / 解绑', () => {
    it('bind weixin 以授权 code、app_type=mp 绑定', async () => {
        succeeds({ code: 'bind-code' });
        await getPlatformManager('mp-weixin').bind('weixin');
        expect(authApiMocks.bindIdentity).toHaveBeenCalledWith('weixin', {
            code: 'bind-code',
            app_type: 'mp',
        });
    });

    it('bind apple 带一次性 nonce', async () => {
        succeeds({ identityToken: 't' });
        await getPlatformManager('app-ios').bind('apple');
        expect(authApiMocks.bindIdentity).toHaveBeenCalledWith(
            'apple',
            expect.objectContaining({ identity_token: 't', nonce: expect.any(String) }),
        );
    });

    it('bind phone 解析 access_token', async () => {
        succeeds({ authResult: JSON.stringify({ access_token: 'pt' }) });
        await getPlatformManager('app-android').bind('phone');
        expect(authApiMocks.bindIdentity).toHaveBeenCalledWith('phone', { access_token: 'pt' });
    });

    it('bind 不支持的 provider 抛错', async () => {
        await expect(getPlatformManager('app-ios').bind('platform')).rejects.toThrow();
        expect(authApiMocks.bindIdentity).not.toHaveBeenCalled();
    });

    it('unbind 调 unbindIdentity', async () => {
        await getPlatformManager('mp-weixin').unbind('weixin');
        expect(authApiMocks.unbindIdentity).toHaveBeenCalledWith('weixin');
    });
});

describe('不支持的登录方式', () => {
    it('未知 provider 抛错且不调 api', async () => {
        await expect(getPlatformManager('h5').login('platform')).rejects.toThrow();
        expect(authApiMocks.loginWithWeixin).not.toHaveBeenCalled();
    });
});
