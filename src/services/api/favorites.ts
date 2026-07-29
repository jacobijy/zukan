/**
 * 收藏 API 客户端
 *
 * 后端 4 个端点（全部要求 `Authorization: Bearer <access>`）：
 * - `GET /favorites`             拿当前用户所有收藏 pokemon_id
 * - `POST /favorites`            幂等添加一条
 * - `DELETE /favorites/:id`      幂等删除一条
 * - `POST /favorites/bulk`       并集合并，返回合并后完整列表（登录时同步用）
 *
 * 与 `authApi.changePassword` 风格一致：手动读 `getToken()` 拼 Bearer；
 * 无 token 时抛错，`store` 层判断 `isAuthenticated()` 再调。
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

/** 拉当前用户的收藏列表 */
export async function listFavorites(): Promise<number[]> {
  const res = await rest.get<FavoritesListResponse>('/favorites', {
    header: authHeader(),
  });
  return res?.pokemon_ids ?? [];
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
    }
  );
}

/** 删除一条收藏（幂等） */
export async function removeFavorite(pokemonId: number): Promise<void> {
  await rest.delete<void>(`/favorites/${pokemonId}`, {
    header: authHeader(),
    dataType: 'text',
  });
}

/**
 * 并集合并：把本地 `ids` 合入服务端集合，返回合并后完整列表。
 * 登录成功时调用；空数组也合法（等价于纯 fetch server side）。
 */
export async function mergeFavorites(ids: number[]): Promise<number[]> {
  const res = await rest.post<FavoritesListResponse, { pokemon_ids: number[] }>(
    '/favorites/bulk',
    { pokemon_ids: ids },
    { header: authHeader() }
  );
  return res?.pokemon_ids ?? [];
}
