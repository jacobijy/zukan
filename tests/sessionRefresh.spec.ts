/**
 * 会话提前刷新用例（`src/services/session/refresh.ts`、`src/utils/jwt.ts`）
 *
 * 覆盖：exp 解析、token 仍有效不 refresh、快过期时并发只 refresh 一次、
 * 无 refresh token 时清会话。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ctrl = vi.hoisted<Record<string, any>>(() => ({}));

vi.mock('@/services/api/auth', () => ({
    refresh: () => ctrl.refresh(),
}));
vi.mock('@/services/http', () => ({
    setUnauthorizedHandler: () => undefined,
}));

import { ensureFreshSession } from '@/services/session/refresh';
import { jwtExpiresAt } from '@/utils/jwt';

function jwt(payload: Record<string, unknown>): string {
    const part = Buffer.from(JSON.stringify(payload)).toString('base64url');
    return `header.${part}.signature`;
}

const now = (): number => Math.floor(Date.now() / 1000);
const TOKEN_KEY = 'zukan_token';
const REFRESH_KEY = 'zukan_refresh_token';

let storage: Map<string, unknown>;

beforeEach(() => {
    storage = new Map();
    vi.stubGlobal('uni', {
        getStorageSync: (k: string) => storage.get(k) ?? '',
        setStorageSync: (k: string, v: unknown) => void storage.set(k, v),
        removeStorageSync: (k: string) => void storage.delete(k),
    });
    ctrl.refresh = vi.fn().mockResolvedValue({});
});

describe('jwtExpiresAt', () => {
    it('读取 exp（Unix 秒）', () => {
        expect(jwtExpiresAt(jwt({ exp: 1700000000 }))).toBe(1700000000);
    });

    it('缺 exp / 非法 token → null', () => {
        expect(jwtExpiresAt(jwt({ sub: 'u' }))).toBeNull();
        expect(jwtExpiresAt(jwt({ exp: 'soon' }))).toBeNull();
        expect(jwtExpiresAt('not-a-jwt')).toBeNull();
        expect(jwtExpiresAt('a.%%%.c')).toBeNull();
    });
});

describe('ensureFreshSession', () => {
    it('未登录 → false，不发请求', async () => {
        expect(await ensureFreshSession()).toBe(false);
        expect(ctrl.refresh).not.toHaveBeenCalled();
    });

    it('token 仍有效 → true，不 refresh', async () => {
        storage.set(TOKEN_KEY, jwt({ exp: now() + 3600 }));
        storage.set(REFRESH_KEY, 'r');

        expect(await ensureFreshSession()).toBe(true);
        expect(ctrl.refresh).not.toHaveBeenCalled();
    });

    it('token 已过期 → 主动 refresh；并发只打一次', async () => {
        storage.set(TOKEN_KEY, jwt({ exp: now() - 10 }));
        storage.set(REFRESH_KEY, 'r');

        const [a, b] = await Promise.all([ensureFreshSession(), ensureFreshSession()]);
        expect([a, b]).toEqual([true, true]);
        expect(ctrl.refresh).toHaveBeenCalledTimes(1);
    });

    it('exp 解析不出 → true（交给 401 恢复兜底）', async () => {
        storage.set(TOKEN_KEY, 'opaque-token');
        expect(await ensureFreshSession()).toBe(true);
        expect(ctrl.refresh).not.toHaveBeenCalled();
    });

    it('无 refresh token 且已过期 → false 并清会话', async () => {
        storage.set(TOKEN_KEY, jwt({ exp: now() - 10 }));

        expect(await ensureFreshSession()).toBe(false);
        expect(ctrl.refresh).not.toHaveBeenCalled();
        expect(storage.has(TOKEN_KEY)).toBe(false);
    });
});
