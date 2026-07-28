/**
 * 鉴权与 DEK 密钥管理
 *
 * 从 `EncryptedSprite.vue` 抽出，供 sprite 与 resourceManager 共享，
 * 避免两处各自维护 keyPromise 导致重复请求 `/zukan/key`。
 */

const TOKEN_KEY = 'zukan_token';
const REFRESH_TOKEN_KEY = 'zukan_refresh_token';
const KEY_ENDPOINT = '/zukan/key';

const baseUrl = (import.meta.env.VITE_API_BASE_URL ?? '') as string;

export interface DekResponse {
  dek: string;
  version?: number;
  algorithm?: string;
}

// ── 全局密钥缓存（模块级） ──
let keyCache: DekResponse | null = null;
let keyPromise: Promise<DekResponse> | null = null;

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
    console.warn('[auth] 写入 access token 失败', err);
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
    console.warn('[auth] 写入 refresh token 失败', err);
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

/**
 * 获取 DEK 密钥；模块级 `keyPromise` 去重并发调用。
 * 401 需要调用方 `clearKeyCache()` 后重试。
 */
export function getKey(): Promise<DekResponse> {
  if (keyCache) return Promise.resolve(keyCache);
  if (keyPromise) return keyPromise;

  keyPromise = new Promise<DekResponse>((resolve, reject) => {
    uni.request({
      url: `${baseUrl}${KEY_ENDPOINT}`,
      method: 'GET',
      header: {
        Authorization: `Bearer ${getToken()}`,
      },
      success: res => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          keyCache = res.data as DekResponse;
          resolve(keyCache);
        } else {
          reject(new Error(`获取密钥失败: ${res.statusCode}`));
        }
      },
      fail: err => reject(new Error(err.errMsg)),
    });
  });

  // 请求失败时清理 keyPromise，允许下次重试
  keyPromise.catch(() => {
    keyPromise = null;
  });

  return keyPromise;
}

/**
 * 清空密钥缓存。401 恢复路径调用；下次 `getKey()` 会重新请求。
 */
export function clearKeyCache(): void {
  keyCache = null;
  keyPromise = null;
}
