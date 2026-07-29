/**
 * 认证 API（`/auth/*`）
 *
 * 端点契约参见 zukan-server 的 `docs/auth-api.md`：
 *
 * - `POST /auth/register` — 注册；201 + `{ id, username, email }`；400 校验失败；409 冲突
 * - `POST /auth/login`    — 登录；200 + `{ access_token, refresh_token, token_type }`；401
 * - `POST /auth/refresh`  — 刷新；200 + `{ access_token, token_type }`；401
 * - `POST /auth/change-password` — 改密（Bearer）；204；400 强度；401
 *
 * 全部错误响应统一为 `{ "error": "<中文提示>" }`，由 `AuthApiError` 承载。
 */

import { rest, RestRequestError } from '@/services/http';
import { setToken, setRefreshToken, getRefreshToken, clearSession, getToken } from '@/services/session/token';

// ─────────────────────────────────────────────────────────
// 类型
// ─────────────────────────────────────────────────────────

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
}

export interface RegisterResponse {
  id: string;
  username: string;
  email: string;
}

export interface LoginRequest {
  /** 用户名或邮箱 */
  identifier: string;
  password: string;
}

export interface TokenPair {
  access_token: string;
  refresh_token: string;
  token_type: 'Bearer';
}

export interface RefreshResponse {
  access_token: string;
  token_type: 'Bearer';
}

export interface ChangePasswordRequest {
  old_password: string;
  new_password: string;
}

/**
 * 认证 API 抛出的错误。`message` 直接使用服务端返回的 `{"error": "..."}`
 * 文案，便于 UI 直接展示；`statusCode` 与 `code` 供调用方分支处理。
 */
export class AuthApiError extends Error {
  statusCode: number;
  /** 语义化错误码，由 status + 端点推导，便于 UI 分支处理 */
  code:
    | 'INVALID_INPUT'
    | 'INVALID_CREDENTIALS'
    | 'CONFLICT'
    | 'UNAUTHORIZED'
    | 'NETWORK'
    | 'UNKNOWN';

  constructor(message: string, statusCode: number, code: AuthApiError['code']) {
    super(message);
    this.name = 'AuthApiError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

// ─────────────────────────────────────────────────────────
// 错误映射
// ─────────────────────────────────────────────────────────

interface ServerError {
  error?: string;
}

function mapError(err: unknown, kind: 'login' | 'register' | 'refresh' | 'change_password'): never {
  if (!(err instanceof RestRequestError)) {
    // 非 HTTP 错误：网络中断、超时等
    throw new AuthApiError((err as Error)?.message ?? '网络请求失败', 0, 'NETWORK');
  }

  const status = err.statusCode ?? 0;
  const body = (err.data ?? {}) as ServerError;
  const message = body.error ?? err.message ?? '请求失败';

  let code: AuthApiError['code'] = 'UNKNOWN';
  if (status === 400) code = 'INVALID_INPUT';
  else if (status === 401) code = kind === 'login' ? 'INVALID_CREDENTIALS' : 'UNAUTHORIZED';
  else if (status === 409) code = 'CONFLICT';

  throw new AuthApiError(message, status, code);
}

// ─────────────────────────────────────────────────────────
// API
// ─────────────────────────────────────────────────────────

/**
 * 注册新用户。成功后返回用户信息；**不自动登录**（调用方按需再调 `login`）。
 *
 * @throws {AuthApiError}
 *   - `INVALID_INPUT` (400) — 用户名/邮箱为空、密码强度不足
 *   - `CONFLICT` (409) — 用户名或邮箱已被占用
 */
export async function register(req: RegisterRequest): Promise<RegisterResponse> {
  try {
    return await rest.post<RegisterResponse, RegisterRequest>('/auth/register', req);
  } catch (err) {
    mapError(err, 'register');
  }
}

/**
 * 登录：用用户名或邮箱 + 密码换取 token。
 * 成功后自动把 access token + refresh token 写入本地存储。
 *
 * @throws {AuthApiError} `INVALID_CREDENTIALS` (401) — 凭据错误
 */
export async function login(req: LoginRequest): Promise<TokenPair> {
  try {
    const pair = await rest.post<TokenPair, LoginRequest>('/auth/login', req);
    setToken(pair.access_token);
    setRefreshToken(pair.refresh_token);
    return pair;
  } catch (err) {
    mapError(err, 'login');
  }
}

/**
 * 用当前存储的 refresh token 换取新 access token；成功后覆盖存储。
 *
 * @throws {AuthApiError}
 *   - `UNAUTHORIZED` (401) — refresh token 失效（过期 / 改密作废 / 签名错误）；
 *     调用方通常应 `clearSession()` 并引导重新登录
 *   - `UNAUTHORIZED` (0 in-app) — 本地没有 refresh token
 */
export async function refresh(): Promise<RefreshResponse> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    throw new AuthApiError('本地无 refresh token', 0, 'UNAUTHORIZED');
  }
  try {
    const res = await rest.post<RefreshResponse, { refresh_token: string }>(
      '/auth/refresh',
      { refresh_token: refreshToken },
    );
    setToken(res.access_token);
    return res;
  } catch (err) {
    mapError(err, 'refresh');
  }
}

/**
 * 修改密码（需已登录）。成功后服务端会作废所有已签发的 refresh token；
 * 本函数会本地 `clearSession()`，UI 应引导用户重新登录。
 *
 * @throws {AuthApiError}
 *   - `INVALID_INPUT` (400) — 新密码强度不足
 *   - `UNAUTHORIZED` (401) — access token 无效 / 旧密码错误
 */
export async function changePassword(req: ChangePasswordRequest): Promise<void> {
  const access = getToken();
  if (!access) {
    throw new AuthApiError('未登录', 0, 'UNAUTHORIZED');
  }
  try {
    // 204 No Content：body 为空，绕开 JSON 自动解析（部分平台会失败）
    await rest.post<void, ChangePasswordRequest>('/auth/change-password', req, {
      header: { Authorization: `Bearer ${access}` },
      dataType: 'text',
    });
    // 服务端已作废所有 refresh token；本地清空，UI 引导重登
    clearSession();
  } catch (err) {
    mapError(err, 'change_password');
  }
}

/**
 * 本地登出：仅清空 access + refresh token 与 DEK 缓存。
 * 服务端无对应端点（JWT 无状态）；如需服务端会话失效，请调用 `changePassword`。
 */
export function logout(): void {
  clearSession();
}
