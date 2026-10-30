/**
 * 会话恢复（401 → refresh → 重试一次）的共享实现
 *
 * 全仓所有「401 自动恢复」共用同一份并发去重的 refresh promise：
 * - `getKey()`（加密资源）路径（见 `key.ts`）与
 * - http REST 恢复路径（显式 `recoverUnauthorized` 的请求，见 `http/request.ts`）
 * 并发触发时只打一次 `/auth/refresh`。恢复失败统一 `clearSession()`
 * （access + refresh 全清，界面随之转未登录）。
 *
 * 依赖方向：本模块（session 层）→ `api/auth` → `http/request`，http 不反向
 * import session —— request 暴露 `setUnauthorizedHandler`，本模块加载即注册，
 * 与 `token.ts` 的 `onSessionClear` 注入同一套断环手法。
 */

import { refresh } from '@/services/api/auth';
import { setUnauthorizedHandler } from '@/services/http';
import { clearSession, getRefreshToken, getToken } from './token';
import { jwtExpiresAt } from '@/utils/jwt';

let inFlight: Promise<boolean> | null = null;

/** 提前 60s 视为过期：避免请求在途中跨过 exp 边界。 */
const EXPIRY_SKEW_SECONDS = 60;

/**
 * 用 refresh token 换新 access token；并发共享同一次请求。
 *
 * @returns true = 已恢复（调用方可重试原请求）；false = 无法恢复
 *   （本地无 refresh token，或 refresh 失败——此时会话已清空）。
 */
export function refreshSessionOnce(): Promise<boolean> {
    if (!getRefreshToken()) return Promise.resolve(false);
    if (inFlight) return inFlight;

    // 成败都要清引用；清理挂主链（finally），不能挂在 catch 分支——
    // 否则 settle 后进来的并发调用者会复用那个注定 settle 的 promise。
    const p = refresh()
        .then(() => true)
        .catch(() => {
            clearSession();
            return false;
        })
        .finally(() => {
            if (inFlight === p) inFlight = null;
        });
    inFlight = p;
    return p;
}

/**
 * 在打「需要登录」的请求前确保 access token 未过期：
 * - 未登录 / 解析不出 exp → false / true（前者不请求，后者交给 401 恢复兜底）；
 * - 仍有效 → true，不发任何请求；
 * - 已过期（或 60s 内过期）→ 主动 refresh，避免先打一发必 401 的请求再重试。
 *
 * 用于启动时的收藏拉取：浏览器刷新后 access 往往已过期，不提前刷新会在
 * Network 里留下一次 401。refresh 失败会清会话并返回 false。
 */
export async function ensureFreshSession(): Promise<boolean> {
    const token = getToken();
    if (!token) return false;
    const exp = jwtExpiresAt(token);
    if (exp === null) return true;

    const now = Math.floor(Date.now() / 1000);
    if (exp - now > EXPIRY_SKEW_SECONDS) return true;

    const refreshed = await refreshSessionOnce();
    if (!refreshed) clearSession();
    return refreshed;
}

// http REST 层遇 401 时自动走这里的恢复；模块被任一会话入口 import 即生效。
setUnauthorizedHandler(refreshSessionOnce);
