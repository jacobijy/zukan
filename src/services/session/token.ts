/**
 * JWT token 存取 + 会话状态
 *
 * access / refresh token 通过 `uni.getStorageSync` 存取，兼容 H5 与 MP。
 * 本模块是 session 最底层，**不 import key**：清会话时要顺带清 DEK 缓存，
 * 由 `key.ts` 经 `onSessionClear()` 把 `clearKeyCache` 注入进来（依赖反转），
 * 否则 token → key → api/zukanKey → token 会形成环（见 docs/security/auth-session.md）。
 */

const TOKEN_KEY = 'zukan_token';
const REFRESH_TOKEN_KEY = 'zukan_refresh_token';

/** clearSession() 时要触发的副作用（如清 DEK 缓存）；由上层模块注册。 */
const clearHooks: Array<() => void> = [];

/**
 * 注册「会话被清空」时的回调。key 模块用它挂 `clearKeyCache`，
 * 让依赖方向保持 key → token，而不是 token 反向 import key。
 */
export function onSessionClear(hook: () => void): void {
    clearHooks.push(hook);
}

/**
 * 获取 access token。使用 `uni.getStorageSync` 以兼容 H5 与小程序平台。
 */
export function getToken(): string {
    try {
        return (uni.getStorageSync(TOKEN_KEY) as string | undefined) ?? '';
    } catch {
        return '';
    }
}

/**
 * 写入 access token；`null` 或空字符串会清空。
 */
export function setToken(token: string | null): void {
    try {
        if (token) {
            uni.setStorageSync(TOKEN_KEY, token);
        } else {
            uni.removeStorageSync(TOKEN_KEY);
        }
    } catch (err) {
        console.warn('[session] 写入 access token 失败', err);
    }
}

/**
 * 获取 refresh token（可能为空字符串）。
 */
export function getRefreshToken(): string {
    try {
        return (uni.getStorageSync(REFRESH_TOKEN_KEY) as string | undefined) ?? '';
    } catch {
        return '';
    }
}

/**
 * 写入 refresh token；`null` 或空字符串会清空。
 */
export function setRefreshToken(token: string | null): void {
    try {
        if (token) {
            uni.setStorageSync(REFRESH_TOKEN_KEY, token);
        } else {
            uni.removeStorageSync(REFRESH_TOKEN_KEY);
        }
    } catch (err) {
        console.warn('[session] 写入 refresh token 失败', err);
    }
}

/**
 * 是否已登录（仅根据 access token 存在与否判断，不做 JWT 过期校验；
 * 过期由服务端 401 触发前端刷新流程）。
 */
export function isAuthenticated(): boolean {
    return !!getToken();
}

/**
 * 清空登录会话：access token + refresh token，并触发注册的清理回调
 * （key 模块注册的 DEK 缓存清理）。登出、改密后、或 refresh 失败时调用。
 */
export function clearSession(): void {
    setToken(null);
    setRefreshToken(null);
    for (const hook of clearHooks) hook();
}
