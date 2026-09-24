/**
 * 第三方登录 / 绑定 auth client 用例。
 *
 * mock http 层，stub uni storage：验证成功落盘两 token、透传 new_user、
 * 上游不可用（503 + UPSTREAM_UNAVAILABLE / 无 code 兜底）、绑定 409、解绑 204。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── mock http：提供 rest.post 与与 auth.ts 同源的 RestRequestError ──
class MockRestError extends Error {
    statusCode?: number;
    data?: unknown;
    constructor(message: string, statusCode?: number, data?: unknown) {
        super(message);
        this.name = 'RestRequestError';
        this.statusCode = statusCode;
        this.data = data;
    }
}
const postMock = vi.fn();
vi.mock('@/services/http', () => ({
    RestRequestError: MockRestError,
    rest: { post: (...args: unknown[]) => postMock(...args) },
}));

// ── uni storage stub ──
const store: Record<string, string> = {};
beforeEach(() => {
    for (const k of Object.keys(store)) delete store[k];
    postMock.mockReset();
    vi.stubGlobal('uni', {
        setStorageSync: (k: string, v: unknown) => {
            store[k] = String(v);
        },
        getStorageSync: (k: string) => store[k] ?? '',
        removeStorageSync: (k: string) => delete store[k],
    });
});

const SOCIAL = {
    access_token: 'access-xyz',
    refresh_token: 'refresh-xyz',
    token_type: 'Bearer' as const,
    new_user: true,
};

async function authClient() {
    return await import('@/services/api/auth');
}

describe('第三方登录', () => {
    it('weixin 成功后落盘两 token 并透传 new_user', async () => {
        postMock.mockResolvedValue(SOCIAL);
        const auth = await authClient();
        const res = await auth.loginWithWeixin({ code: 'the-code', app_type: 'mp' });

        expect(postMock).toHaveBeenCalledWith('/auth/weixin', {
            code: 'the-code',
            app_type: 'mp',
        });
        expect(res.new_user).toBe(true);
        expect(store['zukan_token']).toBe('access-xyz');
        expect(store['zukan_refresh_token']).toBe('refresh-xyz');
    });

    it('apple 503 + UPSTREAM_UNAVAILABLE → 映射为上游不可用', async () => {
        postMock.mockRejectedValue(
            new MockRestError('fail', 503, { error: '稍后重试', code: 'UPSTREAM_UNAVAILABLE' }),
        );
        const auth = await authClient();
        await expect(auth.loginWithApple({ identity_token: 't', nonce: 'n' })).rejects.toMatchObject({
            statusCode: 503,
            code: 'UPSTREAM_UNAVAILABLE',
        });
    });

    it('phone 503 缺 code 也兜底为上游不可用', async () => {
        postMock.mockRejectedValue(new MockRestError('fail', 503, { error: '忙' }));
        const auth = await authClient();
        await expect(auth.loginWithPhone({ access_token: 'tok' })).rejects.toMatchObject({
            code: 'UPSTREAM_UNAVAILABLE',
        });
    });

    it('weixin code 被上游拒绝 → 401 INVALID_CREDENTIALS', async () => {
        postMock.mockRejectedValue(
            new MockRestError('fail', 401, { code: 'INVALID_CREDENTIALS' }),
        );
        const auth = await authClient();
        await expect(auth.loginWithWeixin({ code: 'bad' })).rejects.toMatchObject({
            statusCode: 401,
            code: 'INVALID_CREDENTIALS',
        });
    });
});

describe('绑定 / 解绑', () => {
    // 绑定需登录：预置 access token。
    beforeEach(() => {
        store['zukan_token'] = 'existing-access';
    });

    it('bindIdentity 带 Bearer 提交并返回 identities', async () => {
        postMock.mockResolvedValue({ identities: ['password', 'weixin'] });
        const auth = await authClient();
        const res = await auth.bindIdentity('weixin', { code: 'c', app_type: 'mp' });

        const [path, , opts] = postMock.mock.calls[0];
        expect(path).toBe('/auth/bind/weixin');
        expect(opts.header.Authorization).toBe('Bearer existing-access');
        expect(res.identities).toEqual(['password', 'weixin']);
    });

    it('身份已绑其他账号 → 409 CONFLICT，不静默合并', async () => {
        postMock.mockRejectedValue(
            new MockRestError('fail', 409, { error: '已绑定', code: 'CONFLICT' }),
        );
        const auth = await authClient();
        await expect(auth.bindIdentity('apple', { identity_token: 't', nonce: 'n' })).rejects.toMatchObject({
            statusCode: 409,
            code: 'CONFLICT',
        });
    });

    it('unbindIdentity 以 text 接收 204', async () => {
        postMock.mockResolvedValue(undefined);
        const auth = await authClient();
        await auth.unbindIdentity('weixin');
        const [path, , opts] = postMock.mock.calls[0];
        expect(path).toBe('/auth/unbind/weixin');
        expect(opts.dataType).toBe('text');
    });

    it('未登录绑定直接抛 UNAUTHORIZED，不发请求', async () => {
        delete store['zukan_token'];
        const auth = await authClient();
        await expect(auth.bindIdentity('weixin', { code: 'c' })).rejects.toMatchObject({
            code: 'UNAUTHORIZED',
        });
        expect(postMock).not.toHaveBeenCalled();
    });
});
