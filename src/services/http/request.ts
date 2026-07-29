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

const baseUrl = import.meta.env.VITE_API_BASE_URL ?? '';

const buildUrl = (path: string) => {
    if (/^https?:\/\//.test(path)) {
        return path;
    }

    return `${baseUrl.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
};

const request = <TResponse, TData extends RequestData = RequestData>(
    method: HttpMethod,
    path: string,
    options: RestRequestOptions<TData> = {},
): Promise<TResponse> => {
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
                ...options.header,
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
