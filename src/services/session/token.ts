/**
 * JWT token 存取 + 会话状态
 *
 * access / refresh token 通过 `uni.getStorageSync` 存取，兼容 H5 与 MP。
 * DEK 缓存清空委托给 `session/key.ts::clearKeyCache`（登出时一并清）。
 */
import { clearKeyCache } from '@/services/session/key';

const TOKEN_KEY = 'zukan_token';
const REFRESH_TOKEN_KEY = 'zukan_refresh_token';

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
 * 清空登录会话：access token + refresh token + DEK 缓存。
 * 登出、改密后、或 refresh 失败时调用。
 */
export function clearSession(): void {
    setToken(null);
    setRefreshToken(null);
    clearKeyCache();
}
