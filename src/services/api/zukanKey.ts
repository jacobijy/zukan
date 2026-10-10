/**
 * `/api/v1/zukan/key` API 调用
 *
 * 独立文件，因为 endpoint 只有一个而且响应类型与 session 语义耦合。
 * 走通用 `rest` 客户端，失败时抛 `RestRequestError`（含 statusCode）。
 */
import { rest } from '@/services/http';
import { getToken } from '@/services/session/token';
import type { DekResponse } from '@/services/session/types';

const KEY_ENDPOINT = '/zukan/key';

/**
 * GET /api/v1/zukan/key
 *
 * 公开端点：DEK 匿名即可获取（对战图标等加密资产对未登录用户开放）。
 * 缓存与去重在 `session/key.ts` 里；本函数只负责一次真实请求。
 *
 * 仅在本地存在 access token 时才带 Authorization —— 匿名时不发空头，避免发出
 * `Bearer `（空令牌）被网关鉴权中间件在「公开端点」之前就判成 401。
 */
export function fetchKey(): Promise<DekResponse> {
    const token = getToken();
    return rest.get<DekResponse>(KEY_ENDPOINT, {
        header: token ? { Authorization: `Bearer ${token}` } : {},
    });
}
