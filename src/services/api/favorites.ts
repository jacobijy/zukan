/**
 * 收藏 API 客户端（收藏纯后端：登录后以服务端为唯一来源，不再落本地）
 *
 * 后端 3 个端点（全部要求 `Authorization: Bearer <access>`）：
 * - `GET /api/v1/favorites`        拿当前用户所有收藏 pokemon_id
 * - `POST /api/v1/favorites`       幂等添加一条
 * - `DELETE /api/v1/favorites/:id` 幂等删除一条
 *
 * 与 `authApi.changePassword` 风格一致：手动读 `getToken()` 拼 Bearer；
 * 无 token 时抛错。store 层先经 `confirmLogin()` 确保已登录再调用写接口。
 */

import { rest, RestRequestError } from '@/services/http';
import { getToken } from '@/services/session/token';

function authHeader(): Record<string, string> {
    const access = getToken();
    if (!access) {
        throw new RestRequestError('未登录', 401);
    }
    return { Authorization: `Bearer ${access}` };
}

interface FavoritesListResponse {
    pokemon_ids: number[];
}

/** 拉取当前用户的全部收藏 pokemon_id；脏数据过滤，异常形状降级为空列表。 */
export async function listFavorites(): Promise<number[]> {
    const res = await rest.get<FavoritesListResponse>('/favorites', {
        header: authHeader(),
    });
    const ids = res?.pokemon_ids;
    if (!Array.isArray(ids)) return [];
    return ids.filter((id): id is number => typeof id === 'number' && Number.isFinite(id));
}

/** 添加一条收藏（幂等） */
export async function addFavorite(pokemonId: number): Promise<void> {
    await rest.post<void, { pokemon_id: number }>(
        '/favorites',
        { pokemon_id: pokemonId },
        {
            header: authHeader(),
            // 204 No Content：跳过 JSON 自动解析（部分平台空 body 解析会失败）
            dataType: 'text',
        },
    );
}

/** 删除一条收藏（幂等） */
export async function removeFavorite(pokemonId: number): Promise<void> {
    await rest.delete<void>(`/favorites/${pokemonId}`, {
        header: authHeader(),
        dataType: 'text',
    });
}
