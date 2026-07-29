/**
 * 会话状态聚合：token + DEK 缓存 + 类型
 *
 * consumers: `import { getToken, isAuthenticated, getKey } from '@/services/session'`
 */
export {
  getToken,
  setToken,
  getRefreshToken,
  setRefreshToken,
  isAuthenticated,
  clearSession,
} from './token';

export { getKey, clearKeyCache } from './key';

export type { DekResponse, CdnToken } from './types';
