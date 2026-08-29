/**
 * 二进制 (arraybuffer) HTTP 请求
 *
 * 补齐 `request.ts` 的空缺 —— 后者内部固定 `dataType: 'json'`，无法直接下载
 * 二进制资源。跨平台走 `uni.request({ responseType: 'arraybuffer' })`。
 */

const baseUrl = (import.meta.env.VITE_API_BASE_URL ?? '') as string;

/**
 * dev 下绕开浏览器 HTTP 缓存的 cache-busting 参数。
 *
 * 服务端对 `/assets/encrypted/*` 下发 `immutable, max-age=31536000`，而本地 dev
 * **无 CDN 签名 token**（生产靠 `?sign&t` 换 URL 来 bust 缓存），URL 固定 → 换源
 * 重打包后普通刷新仍可能命中浏览器磁盘缓存里的旧字节，与 dev「应用缓存走内存、
 * 刷新即拉新」（见 `binaryStorage`）相悖。dev 下给 URL 加每次页面加载变化的
 * `_dc` 参数即可；ServeDir 忽略 query string，小程序端同样无害。
 * 模块加载时取一次：会话内恒定（应用缓存本就去重），刷新即变（强制重新校验）。
 */
const devCacheBust = import.meta.env.DEV ? `_dc=${Date.now()}` : '';

/**
 * 注意：这里**不加** `/api/v1` 前缀（`request.ts` 里加）。
 *
 * 二进制资源全部是 `/assets/encrypted/*`，后端刻意把静态资源留在根路径 ——
 * CDN 回源地址与前端资源 URL 不随 API 版本变动。若在此补前缀会 404。
 */
const buildUrl = (path: string): string => {
    if (/^https?:\/\//.test(path)) return path;
    const url = `${baseUrl.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
    // dev 固定 URL + immutable 会卡在浏览器 HTTP 缓存；加一次性参数强制重新校验
    if (!devCacheBust) return url;
    return `${url}${url.includes('?') ? '&' : '?'}${devCacheBust}`;
};

export class BinaryRequestError extends Error {
    statusCode?: number;
    /** 调用方主动取消（`opts.signal`），不是失败 —— 不该重试，也不该报错 */
    aborted: boolean;

    constructor(message: string, statusCode?: number, aborted = false) {
        super(message);
        this.name = 'BinaryRequestError';
        this.statusCode = statusCode;
        this.aborted = aborted;
    }
}

interface BinaryRequestOptions {
    /** 默认 30_000 ms */
    timeout?: number;
    /** 网络错误 / 5xx 重试次数，默认 1（不重试 4xx） */
    retries?: number;
    header?: Record<string, string>;
    /**
     * 取消信号。abort 时调 `RequestTask.abort()` **立刻释放连接槽** ——
     * sprite 调度器靠这个把已划出视口的下载让位给当前视口（见 `spriteCache.ts`）。
     */
    signal?: AbortSignal;
}

/**
 * 判断错误是否可重试：网络失败 (无 statusCode) 或 5xx。
 * 4xx 与主动取消直接抛出。
 */
function isRetryable(err: BinaryRequestError): boolean {
    if (err.aborted) return false;
    if (err.statusCode == null) return true;
    return err.statusCode >= 500;
}

function requestOnce(url: string, opts: BinaryRequestOptions): Promise<Uint8Array> {
    return new Promise<Uint8Array>((resolve, reject) => {
        const { signal } = opts;
        if (signal?.aborted) {
            reject(new BinaryRequestError('Request aborted', undefined, true));
            return;
        }

        let settled = false;
        let onAbort: (() => void) | undefined;

        const cleanup = () => {
            settled = true;
            if (onAbort) signal?.removeEventListener('abort', onAbort);
        };

        const task = uni.request({
            url,
            method: 'GET',
            responseType: 'arraybuffer',
            timeout: opts.timeout ?? 30_000,
            header: opts.header,
            success: (res) => {
                cleanup();
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve(new Uint8Array(res.data as ArrayBuffer));
                } else {
                    reject(new BinaryRequestError(`Request failed with status ${res.statusCode}`, res.statusCode));
                }
            },
            fail: (err) => {
                // abort() 也会走 fail；此时已经 reject 过了，别覆盖成网络错误
                if (settled) return;
                cleanup();
                reject(new BinaryRequestError(err.errMsg));
            },
        });

        if (signal) {
            onAbort = () => {
                if (settled) return;
                cleanup();
                // 部分平台的 request 不返回 task（或无 abort），此时只能让请求跑完自然结束
                if (typeof task?.abort === 'function') task.abort();
                reject(new BinaryRequestError('Request aborted', undefined, true));
            };
            signal.addEventListener('abort', onAbort);
        }
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
