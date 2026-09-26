/**
 * 静态资源 JSON 请求（`/assets/*`，明文、无 `/api/v1` 前缀）。
 *
 * 与 `binaryRequest.fetchBinary` 同源（复用 `buildAssetUrl`），区别仅在响应按 JSON 解析。
 * 用于不加密的明文数据（如对战使用率 `/assets/battle/*.json`）。
 */
import { buildAssetUrl } from './binaryRequest';
import { RestRequestError } from './request';

interface AssetJsonOptions {
    /** 默认 30_000 ms */
    timeout?: number;
    header?: Record<string, string>;
}

function requestOnce<T>(url: string, opts: AssetJsonOptions): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        uni.request({
            url,
            method: 'GET',
            timeout: opts.timeout ?? 30_000,
            header: opts.header,
            dataType: 'json',
            success: (res) => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve(res.data as T);
                } else {
                    reject(
                        new RestRequestError(`Request failed with status ${res.statusCode}`, res.statusCode, res.data),
                    );
                }
            },
            fail: (err) => {
                reject(new RestRequestError(err.errMsg));
            },
        });
    });
}

/** 拉取静态 JSON 资产；网络错误 / 5xx 重试一次，4xx 直接抛出。 */
export async function fetchAssetJson<T>(path: string, opts: AssetJsonOptions = {}): Promise<T> {
    const url = buildAssetUrl(path);
    try {
        return await requestOnce<T>(url, opts);
    } catch (err) {
        const e = err as RestRequestError;
        // 无 statusCode（网络失败）或 5xx 且非 4xx：重试一次
        if (e.statusCode == null || e.statusCode >= 500) {
            return requestOnce<T>(url, opts);
        }
        throw e;
    }
}
