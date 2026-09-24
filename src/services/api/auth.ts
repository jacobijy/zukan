/**
 * 认证 API（`/api/v1/auth/*`）
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
import type { AuthProvider } from '@/infra/platform';
import { i18n } from '@/services/i18n/ui-i18n';

// ─────────────────────────────────────────────────────────
// 类型
// ─────────────────────────────────────────────────────────

interface RegisterRequest {
    username: string;
    email: string;
    password: string;
}

interface RegisterResponse {
    id: string;
    username: string;
    email: string;
}

interface LoginRequest {
    /** 用户名或邮箱 */
    identifier: string;
    password: string;
}

interface TokenPair {
    access_token: string;
    refresh_token: string;
    token_type: 'Bearer';
}

interface RefreshResponse {
    access_token: string;
    token_type: 'Bearer';
}

interface ChangePasswordRequest {
    old_password: string;
    new_password: string;
}

// ─────────────────────────────────────────────────────────
// 第三方快捷登录（契约见 zukan-server docs/account-auth-design.md）
// ─────────────────────────────────────────────────────────

interface WeixinLoginRequest {
    /** uni.login / OAuth 取得的一次性授权 code */
    code: string;
    /** 来源：mp（缺省）/ app / web；决定后端选用的 appid/secret */
    app_type?: 'mp' | 'app' | 'web';
    /** 自动建号时的初始展示名（可选） */
    display_name?: string;
}

interface AppleLoginRequest {
    identity_token: string;
    nonce: string;
    authorization_code?: string;
}

interface PhoneLoginRequest {
    /** 运营商 / uniVerify 本机号授权 token */
    access_token: string;
}

/** 第三方登录响应：现有 TokenPair + 是否新建账号。 */
interface SocialTokenPair {
    access_token: string;
    refresh_token: string;
    token_type: 'Bearer';
    new_user: boolean;
}

/** 绑定/解绑成功后返回的当前登录方式列表。 */
interface IdentitiesResponse {
    identities: string[];
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
        | 'UPSTREAM_UNAVAILABLE'
        | 'PROVIDER_DISABLED'
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
    /**
     * 服务端错误码（`AppError::code()`）。比状态码精确：401 既可能是
     * `UNAUTHENTICATED`（未登录/失效，应引导登录）也可能是
     * `INVALID_CREDENTIALS`（密码错误，应留在当前表单）。
     */
    code?: string;
}

/** 服务端 code → 本地 AuthApiError.code。未知值回退 null 交给状态码推断。 */
function mapServerCode(code: string | undefined): AuthApiError['code'] | null {
    switch (code) {
        case 'INVALID_INPUT':
            return 'INVALID_INPUT';
        case 'INVALID_CREDENTIALS':
            return 'INVALID_CREDENTIALS';
        case 'UNAUTHENTICATED':
            return 'UNAUTHORIZED';
        case 'CONFLICT':
            return 'CONFLICT';
        case 'UPSTREAM_UNAVAILABLE':
            return 'UPSTREAM_UNAVAILABLE';
        case 'PROVIDER_DISABLED':
            return 'PROVIDER_DISABLED';
        default:
            return null;
    }
}

/**
 * 端点类型，决定 401 的语义：
 * - 登录类（密码 / 第三方换取 token）：401 是凭据无效 → INVALID_CREDENTIALS
 * - 其余（含需鉴权的 bind/unbind）：401 是会话失效 → UNAUTHORIZED
 */
type MapKind = 'login' | 'register' | 'refresh' | 'change_password' | 'weixin' | 'apple' | 'phone' | 'bind' | 'unbind';

const LOGIN_KINDS: ReadonlySet<MapKind> = new Set(['login', 'weixin', 'apple', 'phone']);

function mapError(err: unknown, kind: MapKind): never {
    if (!(err instanceof RestRequestError)) {
        // 非 HTTP 错误：网络中断、超时等
        throw new AuthApiError((err as Error)?.message ?? i18n.global.t('auth.networkError'), 0, 'NETWORK');
    }

    const status = err.statusCode ?? 0;
    const body = (err.data ?? {}) as ServerError;
    const message = body.error ?? err.message ?? i18n.global.t('auth.requestFailed');

    // 服务端 code 优先；缺失（旧后端）时回退到 status + 端点推断。
    let code = mapServerCode(body.code);
    if (code == null) {
        if (status === 400) code = 'INVALID_INPUT';
        else if (status === 401) code = LOGIN_KINDS.has(kind) ? 'INVALID_CREDENTIALS' : 'UNAUTHORIZED';
        else if (status === 409) code = 'CONFLICT';
        else if (status === 503) code = 'UPSTREAM_UNAVAILABLE';
        else code = 'UNKNOWN';
    }

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
        throw new AuthApiError(i18n.global.t('auth.noRefreshToken'), 0, 'UNAUTHORIZED');
    }
    try {
        const res = await rest.post<RefreshResponse, { refresh_token: string }>('/auth/refresh', {
            refresh_token: refreshToken,
        });
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
        throw new AuthApiError(i18n.global.t('auth.notLoggedIn'), 0, 'UNAUTHORIZED');
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

// ─────────────────────────────────────────────────────────
// 第三方快捷登录 / 绑定（契约：docs/account-auth-design.md §4）
// ─────────────────────────────────────────────────────────

/** 当前 access token 的 Bearer 头；未登录直接抛会话错误。 */
function requireAuthHeader(): Record<string, string> {
    const access = getToken();
    if (!access) {
        throw new AuthApiError(i18n.global.t('auth.notLoggedIn'), 0, 'UNAUTHORIZED');
    }
    return { Authorization: `Bearer ${access}` };
}

/**
 * 微信登录：用授权 code 换取本系统 token。成功后自动落盘 access + refresh。
 *
 * @throws `INVALID_CREDENTIALS` (401) — code 被上游拒绝/过期
 * @throws `UPSTREAM_UNAVAILABLE` (503) — 微信侧暂时不可用
 * @throws `PROVIDER_DISABLED` (503) — 后端未启用微信登录
 */
export async function loginWithWeixin(req: WeixinLoginRequest): Promise<SocialTokenPair> {
    try {
        const pair = await rest.post<SocialTokenPair, WeixinLoginRequest>('/auth/weixin', req);
        setToken(pair.access_token);
        setRefreshToken(pair.refresh_token);
        return pair;
    } catch (err) {
        mapError(err, 'weixin');
    }
}

/**
 * Sign in with Apple：校验 identity token 后换取本系统 token。成功后自动落盘。
 *
 * @throws `INVALID_CREDENTIALS` (401) — identity_token/nonce 无效
 * @throws `UPSTREAM_UNAVAILABLE` (503) / `PROVIDER_DISABLED` (503)
 */
export async function loginWithApple(req: AppleLoginRequest): Promise<SocialTokenPair> {
    try {
        const pair = await rest.post<SocialTokenPair, AppleLoginRequest>('/auth/apple', req);
        setToken(pair.access_token);
        setRefreshToken(pair.refresh_token);
        return pair;
    } catch (err) {
        mapError(err, 'apple');
    }
}

/**
 * 运营商本机号登录：用 univerify/运营商 access_token 换取本系统 token。成功后自动落盘。
 *
 * @throws `INVALID_CREDENTIALS` (401) / `UPSTREAM_UNAVAILABLE` (503) / `PROVIDER_DISABLED` (503)
 */
export async function loginWithPhone(req: PhoneLoginRequest): Promise<SocialTokenPair> {
    try {
        const pair = await rest.post<SocialTokenPair, PhoneLoginRequest>('/auth/phone', req);
        setToken(pair.access_token);
        setRefreshToken(pair.refresh_token);
        return pair;
    } catch (err) {
        mapError(err, 'phone');
    }
}

/**
 * 绑定第三方登录方式到当前账号（需登录）。请求体与对应登录端点一致
 * （如微信 `{ code, app_type }`、Apple `{ identity_token, nonce }`）。
 *
 * @returns 当前账号的登录方式列表
 * @throws `CONFLICT` (409) — 该身份已绑定其他账号（不静默合并）
 */
export async function bindIdentity(
    provider: AuthProvider,
    payload: Record<string, unknown>,
): Promise<IdentitiesResponse> {
    // 鉴权检查放在 try 外：未登录直接抛 UNAUTHORIZED，避免被 mapError 误判为网络错误。
    const header = requireAuthHeader();
    try {
        return await rest.post<IdentitiesResponse, Record<string, unknown>>(`/auth/bind/${provider}`, payload, {
            header,
        });
    } catch (err) {
        mapError(err, 'bind');
    }
}

/**
 * 解绑第三方登录方式（需登录）。解绑后账号须仍保留至少一种登录方式，否则后端 400。
 *
 * @throws `INVALID_INPUT` (400) — 解绑后将无任何登录方式
 */
export async function unbindIdentity(provider: AuthProvider): Promise<void> {
    const header = requireAuthHeader();
    try {
        // 204 No Content：绕开空 body 的 JSON 解析。
        await rest.post<void>(`/auth/unbind/${provider}`, undefined, {
            header,
            dataType: 'text',
        });
    } catch (err) {
        mapError(err, 'unbind');
    }
}
