import { getToken } from '@/services/session/token';

type HttpMethod = NonNullable<UniNamespace.RequestOptions['method']>;

type RequestData = NonNullable<UniNamespace.RequestOptions['data']>;
type RequestHeader = UniNamespace.RequestOptions['header'];

interface RestRequestOptions<TData extends RequestData = RequestData> {
    data?: TData;
    header?: RequestHeader;
    timeout?: number;
    dataType?: string;
    responseType?: string;
    withCredentials?: boolean;
    /**
     * 401（access 过期 / 会话失效）时自动走「refresh → 重试一次」恢复。
     * 由需要鉴权的数据端点开启；登录 / 改密等 401 语义不同的请求**不要**开。
     * 恢复逻辑（并发去重、失败清会话）由 session 层经 `setUnauthorizedHandler` 注入。
     */
    recoverUnauthorized?: boolean;
}

export class RestRequestError extends Error {
    statusCode?: number;
    data?: unknown;

    constructor(message: string, statusCode?: number, data?: unknown) {
        super(message);
        this.name = 'RestRequestError';
        this.statusCode = statusCode;
        this.data = data;
    }
}

/** 401 恢复钩子：返回 true = 已恢复可重试原请求；false = 未恢复（原 401 照常抛出）。 */
type UnauthorizedRecovery = () => Promise<boolean>;

let unauthorizedRecovery: UnauthorizedRecovery | null = null;

/**
 * 注册 401 恢复钩子。由 session 层注入（`session/refresh.ts` 加载即注册），
 * 依赖方向 session → http，保证 http 不反向 import session（断环）。
 */
export function setUnauthorizedHandler(handler: UnauthorizedRecovery | null): void {
    unauthorizedRecovery = handler;
}

const baseUrl = import.meta.env.VITE_API_BASE_URL ?? '';

/**
 * JSON API 版本前缀。
 *
 * 后端把 JSON API 全部收在 `/api/v1` 下，静态资源（`/assets/*`）与健康检查
 * （`/health`）仍在根路径。本模块只服务 JSON API，故在此统一补前缀 ——
 * 调用方写 `/auth/login` 即可，无需在每个 endpoint 字面量里重复版本号。
 *
 * 静态资源走 `binaryRequest.ts`，那里**不加**前缀。
 * 绝对 URL（如 CDN 签名地址）在 `buildUrl` 里直接透传，不受影响。
 */
const API_PREFIX = '/api/v1';

const buildUrl = (path: string) => {
    if (/^https?:\/\//.test(path)) {
        return path;
    }

    return `${baseUrl.replace(/\/$/, '')}${API_PREFIX}/${path.replace(/^\//, '')}`;
};

const request = <TResponse, TData extends RequestData = RequestData>(
    method: HttpMethod,
    path: string,
    options: RestRequestOptions<TData> = {},
): Promise<TResponse> => {
    // 单次请求（已拼好最终 header）。401 恢复重试时用新 access 覆盖 Authorization。
    const perform = (header: RequestHeader): Promise<TResponse> => {
        return new Promise((resolve, reject) => {
            // 在 uni-app H5 平台上，uni.request 的 data 参数需要手动序列化
            // 为 JSON 字符串，否则某些浏览器版本会因 Content-Type 与 payload 类型
            // 不匹配而触发 CORS 预检失败或未知的 request:fail 错误。
            const serializedData =
                options.data != null
                    ? typeof options.data === 'string'
                        ? options.data
                        : JSON.stringify(options.data)
                    : undefined;

            uni.request({
                url: buildUrl(path),
                method,
                data: serializedData,
                header: {
                    'Content-Type': 'application/json',
                    ...header,
                },
                timeout: options.timeout,
                dataType: options.dataType ?? 'json',
                responseType: options.responseType,
                withCredentials: options.withCredentials,
                success: (response) => {
                    if (response.statusCode >= 200 && response.statusCode < 300) {
                        resolve(response.data as TResponse);
                        return;
                    }

                    reject(
                        new RestRequestError(
                            `Request failed with status ${response.statusCode}`,
                            response.statusCode,
                            response.data,
                        ),
                    );
                },
                fail: (error) => {
                    console.warn('[request] uni.request fail', error.errMsg, 'url:', buildUrl(path));
                    reject(new RestRequestError(error.errMsg));
                },
            });
        });
    };

    // 401 已恢复过一次即不再重试（防止恢复失败时死循环）；仅在显式开启时生效。
    const attempt = async (header: RequestHeader, retried: boolean): Promise<TResponse> => {
        try {
            return await perform(header);
        } catch (err) {
            const recovery = unauthorizedRecovery;
            const recoverable =
                options.recoverUnauthorized &&
                !retried &&
                recovery !== null &&
                err instanceof RestRequestError &&
                err.statusCode === 401;
            if (!recoverable) throw err;

            const recovered = await recovery();
            if (!recovered) throw err;
            // refresh 已把新 access 写入 storage：重试时用新 token 覆盖 Authorization
            const retryHeader = { ...header } as Record<string, unknown>;
            if (retryHeader.Authorization !== undefined) {
                retryHeader.Authorization = `Bearer ${getToken()}`;
            }
            return await attempt(retryHeader as RequestHeader, true);
        }
    };

    return attempt(options.header ?? {}, false);
};

export const rest = {
    get: <TResponse>(path: string, options?: RestRequestOptions) => request<TResponse>('GET', path, options),
    post: <TResponse, TData extends RequestData = RequestData>(
        path: string,
        data?: TData,
        options?: Omit<RestRequestOptions<TData>, 'data'>,
    ) => request<TResponse, TData>('POST', path, { ...options, data }),
    put: <TResponse, TData extends RequestData = RequestData>(
        path: string,
        data?: TData,
        options?: Omit<RestRequestOptions<TData>, 'data'>,
    ) => request<TResponse, TData>('PUT', path, { ...options, data }),
    delete: <TResponse>(path: string, options?: RestRequestOptions) => request<TResponse>('DELETE', path, options),
};
