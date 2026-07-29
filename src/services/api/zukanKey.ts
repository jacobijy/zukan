/**
 * `/zukan/key` API 调用
 *
 * 独立文件，因为 endpoint 只有一个而且响应类型与 session 语义耦合。
 * 走通用 `rest` 客户端，失败时抛 `RestRequestError`（含 statusCode）。
 */
import { rest } from '@/services/http';
import { getToken } from '@/services/session/token';
import type { DekResponse } from '@/services/session/types';

const KEY_ENDPOINT = '/zukan/key';

/**
 * GET /zukan/key
 * 缓存与去重在 `session/key.ts` 里；本函数只负责一次真实请求。
 */
export function fetchKey(): Promise<DekResponse> {
    return rest.get<DekResponse>(KEY_ENDPOINT, {
        header: {
            Authorization: `Bearer ${getToken()}`,
        },
    });
}
