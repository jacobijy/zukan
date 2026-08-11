/**
 * DEK 密钥缓存、并发去重与未登录恢复
 *
 * `getKey()` 是全 app 拿 DEK 的唯一入口（`boot.ts`、`resourceManager`、
 * `spriteCache` 共 3 个调用点，403 重试时各再调一次）。鉴权失败的恢复逻辑收敛在这里，
 * 而不是散在每个调用点 —— 否则同样的分支要重复 6 遍且容易漏。
 *
 * ## 401 恢复策略
 * ```
 * 401 UNAUTHENTICATED
 *   ├─ 本地有 refresh token → authApi.refresh() → 重试一次
 *   │    └─ refresh 也失败 → clearSession() → 弹登录层
 *   └─ 无 refresh token     → 弹登录层 → 登录成功后重试
 * ```
 * 用户关闭登录层则抛 `LoginDismissedError`，调用方据此静默降级
 * （不该再重试，也不该当成网络错误报错）。
 */
import { fetchKey } from '@/services/api/zukanKey';
import { RestRequestError } from '@/services/http';
import { authGate, LoginDismissedError } from './authGate';
import { getRefreshToken, clearSession } from './token';
import type { DekResponse } from './types';

let keyCache: DekResponse | null = null;
let keyPromise: Promise<DekResponse> | null = null;

/** 进行中的 refresh。6 个 getKey 调用点并发时只打一次 `/auth/refresh`。 */
let refreshPromise: Promise<void> | null = null;

/**
 * 是否为"未认证"错误。
 *
 * 优先信服务端下发的 `code`（区分了 UNAUTHENTICATED 与 INVALID_CREDENTIALS），
 * 回退到裸状态码以兼容旧后端。
 */
function isUnauthenticated(err: unknown): boolean {
    if (!(err instanceof RestRequestError)) return false;
    const code = (err.data as { code?: string } | undefined)?.code;
    if (code) return code === 'UNAUTHENTICATED';
    return err.statusCode === 401;
}

/**
 * 用 refresh token 换新 access token；并发共享同一次请求。
 * 成功 resolve，失败 reject（调用方负责 clearSession + 引导登录）。
 */
function refreshOnce(): Promise<void> {
    if (refreshPromise) return refreshPromise;

    // 动态 import 打断循环依赖：api/auth.ts → session/token.ts，
    // 若在模块顶层 import 会形成 session ⇄ api 环。
    const p = import('@/services/api/auth').then((m) => m.refresh()).then(() => undefined);

    refreshPromise = p;
    // 无论成败都要清掉，否则第二次过期时会复用已 settle 的 promise
    p.catch(() => undefined).then(() => {
        if (refreshPromise === p) refreshPromise = null;
    });

    return p;
}

/**
 * 真正取密钥：首次失败于未认证时，按策略恢复后重试一次。
 * `allowRecovery=false` 用于恢复后的那一次重试，避免无限递归。
 */
async function fetchWithRecovery(allowRecovery = true): Promise<DekResponse> {
    try {
        return await fetchKey();
    } catch (err) {
        if (!allowRecovery || !isUnauthenticated(err)) throw err;

        if (getRefreshToken()) {
            try {
                await refreshOnce();
                return await fetchKey();
            } catch (refreshErr) {
                // refresh token 也失效了（过期 / 改密作废）——
                // 清掉无效会话，转入登录流程。
                if (refreshErr instanceof LoginDismissedError) throw refreshErr;
                clearSession();
            }
        }

        // 无 refresh token，或 refresh 失败：要求用户登录后重试。
        // requireLogin() 在用户关闭弹层时 reject，错误直接冒泡给调用方。
        await authGate.requireLogin();
        return await fetchKey();
    }
}

/**
 * 获取 DEK 密钥。并发调用共享同一 promise。
 *
 * 未登录 / token 失效由内部恢复（自动 refresh 或弹登录层），调用方通常
 * 无需处理 401；但应捕获 `LoginDismissedError` 以静默降级。
 */
export function getKey(): Promise<DekResponse> {
    if (keyCache) return Promise.resolve(keyCache);
    if (keyPromise) return keyPromise;

    // 注意 keyPromise 的清理必须挂在**主链**上（下面的 finally），
    // 不能写成 `keyPromise.catch(() => keyPromise = null)`：
    // 那样 .catch 返回的是新 promise，回调在微任务里才跑，
    // 期间进来的并发调用者会复用那个注定 reject 的 promise。
    const p = fetchWithRecovery()
        .then((res) => {
            keyCache = res;
            return res;
        })
        .finally(() => {
            // 失败时清空以允许下次重试；成功时 keyCache 已命中，
            // 清掉 promise 引用也不影响后续读取。
            if (keyPromise === p) keyPromise = null;
        });

    keyPromise = p;
    return p;
}

/**
 * 清空密钥缓存。登出、DEK 轮换、CDN 403 重签路径调用；
 * 下次 `getKey()` 会重新请求。
 */
export function clearKeyCache(): void {
    keyCache = null;
    keyPromise = null;
}
