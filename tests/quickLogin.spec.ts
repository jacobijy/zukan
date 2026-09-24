/**
 * 第三方登录编排（services/platform/quickLogin）用例。
 *
 * stub uni.login（成功给凭据 / 失败 / 不同 provider），mock authApi：
 * 验证微信按平台传对 app_type、Apple 带一次性 nonce、本机号解析 authResult、
 * 绑定/解绑走对应凭据，以及凭据缺失与授权失败正确上抛。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const authApiMocks = {
    loginWithWeixin: vi.fn().mockResolvedValue({ new_user: false }),
    loginWithApple: vi.fn().mockResolvedValue({ new_user: false }),
    loginWithPhone: vi.fn().mockResolvedValue({ new_user: false }),
    bindIdentity: vi.fn().mockResolvedValue({ identities: ['weixin'] }),
    unbindIdentity: vi.fn().mockResolvedValue(undefined),
};
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

async function quickLogin() {
    return await import('@/services/platform/quickLogin');
}

describe('weixinLogin', () => {
    it('mp-weixin：uni.login 取 code 后以 app_type=mp 提交', async () => {
        succeeds({ code: 'wx-code' });
        const q = await quickLogin();
        await q.weixinLogin('mp-weixin');
        expect(authApiMocks.loginWithWeixin).toHaveBeenCalledWith({
            code: 'wx-code',
            app_type: 'mp',
        });
    });

    it('app 平台 app_type=app', async () => {
        succeeds({ code: 'c' });
        const q = await quickLogin();
        await q.weixinLogin('app-android');
        expect(authApiMocks.loginWithWeixin).toHaveBeenCalledWith({ code: 'c', app_type: 'app' });
    });

    it('未返回 code 时抛错，不调用 api', async () => {
        succeeds({});
        const q = await quickLogin();
        await expect(q.weixinLogin('mp-weixin')).rejects.toThrow();
        expect(authApiMocks.loginWithWeixin).not.toHaveBeenCalled();
    });
});

describe('appleLogin', () => {
    it('带一次性 nonce 提交 identity_token 与 authorization_code', async () => {
        succeeds({ identityToken: 'id-token', code: 'auth-code' });
        const q = await quickLogin();
        await q.appleLogin();
        const arg = authApiMocks.loginWithApple.mock.calls[0][0];
        expect(arg).toMatchObject({
            identity_token: 'id-token',
            authorization_code: 'auth-code',
        });
        expect(typeof arg.nonce).toBe('string');
        expect(arg.nonce.length).toBeGreaterThan(0);
    });

    it('两次登录 nonce 不同（防重放）', async () => {
        succeeds({ identityToken: 't' });
        const q = await quickLogin();
        await q.appleLogin();
        await q.appleLogin();
        const n1 = authApiMocks.loginWithApple.mock.calls[0][0].nonce;
        const n2 = authApiMocks.loginWithApple.mock.calls[1][0].nonce;
        expect(n1).not.toBe(n2);
    });

    it('缺 identityToken 抛错', async () => {
        succeeds({ code: 'x' });
        const q = await quickLogin();
        await expect(q.appleLogin()).rejects.toThrow();
    });
});

describe('phoneLogin', () => {
    it('解析 authResult 中的 access_token', async () => {
        succeeds({ authResult: JSON.stringify({ access_token: 'phone-tok' }) });
        const q = await quickLogin();
        await q.phoneLogin();
        expect(authApiMocks.loginWithPhone).toHaveBeenCalledWith({ access_token: 'phone-tok' });
    });

    it('authResult 非法/缺 token 抛错', async () => {
        succeeds({ authResult: 'not-json' });
        const q = await quickLogin();
        await expect(q.phoneLogin()).rejects.toThrow();
    });
});

describe('授权失败', () => {
    it('uni.login fail 错误上抛', async () => {
        fails('login:fail');
        const q = await quickLogin();
        await expect(q.weixinLogin('mp-weixin')).rejects.toThrow('login:fail');
    });
});

describe('绑定 / 解绑', () => {
    it('bindProvider weixin 以授权 code 绑定', async () => {
        succeeds({ code: 'bind-code' });
        const q = await quickLogin();
        await q.bindProvider('weixin', 'mp-weixin');
        expect(authApiMocks.bindIdentity).toHaveBeenCalledWith('weixin', {
            code: 'bind-code',
            app_type: 'mp',
        });
    });

    it('bindProvider apple 带 nonce', async () => {
        succeeds({ identityToken: 't' });
        const q = await quickLogin();
        await q.bindProvider('apple');
        const [provider, payload] = authApiMocks.bindIdentity.mock.calls[0];
        expect(provider).toBe('apple');
        expect(payload.identity_token).toBe('t');
        expect(payload.nonce).toBeTruthy();
    });

    it('bindProvider phone 解析 access_token', async () => {
        succeeds({ authResult: JSON.stringify({ access_token: 'pt' }) });
        const q = await quickLogin();
        await q.bindProvider('phone');
        expect(authApiMocks.bindIdentity).toHaveBeenCalledWith('phone', { access_token: 'pt' });
    });

    it('bindProvider 不支持的 provider 抛错', async () => {
        const q = await quickLogin();
        await expect(q.bindProvider('platform')).rejects.toThrow();
    });

    it('unbindProvider 调 unbindIdentity', async () => {
        const q = await quickLogin();
        await q.unbindProvider('weixin');
        expect(authApiMocks.unbindIdentity).toHaveBeenCalledWith('weixin');
    });
});
