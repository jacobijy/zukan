/**
 * 二进制 (arraybuffer) HTTP 请求
 *
 * 补齐 `request.ts` 的空缺 —— 后者内部固定 `dataType: 'json'`，无法直接下载
 * 二进制资源。跨平台走 `uni.request({ responseType: 'arraybuffer' })`。
 */

const baseUrl = (import.meta.env.VITE_API_BASE_URL ?? '') as string;

const buildUrl = (path: string): string => {
    if (/^https?:\/\//.test(path)) return path;
    return `${baseUrl.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
};

export class BinaryRequestError extends Error {
    statusCode?: number;

    constructor(message: string, statusCode?: number) {
        super(message);
        this.name = 'BinaryRequestError';
        this.statusCode = statusCode;
    }
}

interface BinaryRequestOptions {
    /** 默认 30_000 ms */
    timeout?: number;
    /** 网络错误 / 5xx 重试次数，默认 1（不重试 4xx） */
    retries?: number;
    header?: Record<string, string>;
}

/**
 * 判断错误是否可重试：网络失败 (无 statusCode) 或 5xx。
 * 4xx 直接抛出。
 */
function isRetryable(err: BinaryRequestError): boolean {
    if (err.statusCode == null) return true;
    return err.statusCode >= 500;
}

function requestOnce(url: string, opts: BinaryRequestOptions): Promise<Uint8Array> {
    return new Promise<Uint8Array>((resolve, reject) => {
        uni.request({
            url,
            method: 'GET',
            responseType: 'arraybuffer',
            timeout: opts.timeout ?? 30_000,
            header: opts.header,
            success: (res) => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve(new Uint8Array(res.data as ArrayBuffer));
                } else {
                    reject(new BinaryRequestError(`Request failed with status ${res.statusCode}`, res.statusCode));
                }
            },
            fail: (err) => reject(new BinaryRequestError(err.errMsg)),
        });
    });
}

/**
 * 下载二进制资源。
 * - 支持相对路径（前缀 `VITE_API_BASE_URL`）与绝对 URL
 * - 网络错误 / 5xx 自动重试 `retries` 次；4xx 直接抛出
 */
export async function fetchBinary(path: string, opts: BinaryRequestOptions = {}): Promise<Uint8Array> {
    const url = buildUrl(path);
    const retries = opts.retries ?? 1;

    let lastErr: BinaryRequestError | null = null;
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            return await requestOnce(url, opts);
        } catch (err) {
            const binErr = err as BinaryRequestError;
            lastErr = binErr;
            if (!isRetryable(binErr) || attempt === retries) throw binErr;
        }
    }

    // 上面的 for 循环要么 return，要么 throw；仅为满足 TS 控制流
    throw lastErr ?? new BinaryRequestError('fetchBinary: unknown error');
}
