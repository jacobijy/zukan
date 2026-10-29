/**
 * 热度榜 API 客户端用例（`src/services/api/popularity.ts`）
 *
 * stub uni.request 捕获 options，验证：
 * - 路径 /api/v1/popularity/pokemon 与 limit/offset query；
 * - 公开匿名（不带 Authorization）；
 * - snake_case → camelCase 转换、脏条目过滤、items 非数组时降级空列表。
 */
import { beforeEach, expect, it, vi } from 'vitest';

interface Captured {
    url: string;
    method: string;
    header: Record<string, string>;
}
let captured: Captured | null = null;
let response: { statusCode: number; data: unknown } = { statusCode: 200, data: {} };

vi.stubGlobal('uni', {
    request(opts: Captured & { success: (r: { statusCode: number; data: unknown }) => void }) {
        captured = { url: opts.url, method: opts.method, header: opts.header };
        opts.success({ statusCode: response.statusCode, data: response.data });
    },
});

import { listPokemonPopularity } from '@/services/api/popularity';

beforeEach(() => {
    captured = null;
    response = { statusCode: 200, data: {} };
});

it('GET /popularity/pokemon 带 limit/offset，且不带鉴权头', async () => {
    response.data = { updated_at: '2026-10-29T10:00:00Z', total: 2, items: [] };
    await listPokemonPopularity(3, 0);
    expect(captured!.method).toBe('GET');
    expect(captured!.url).toContain('/api/v1/popularity/pokemon?limit=3&offset=0');
    expect(captured!.header.Authorization).toBeUndefined();
});

it('snake_case 响应转成 camelCase 条目，名次 / id / 收藏数齐全', async () => {
    response.data = {
        updated_at: '2026-10-29T10:00:00Z',
        total: 1010,
        items: [
            { rank: 1, pokemon_id: 25, favorite_count: 42 },
            { rank: 2, pokemon_id: 6, favorite_count: 38 },
        ],
    };
    const list = await listPokemonPopularity();
    expect(list.updatedAt).toBe('2026-10-29T10:00:00Z');
    expect(list.total).toBe(1010);
    expect(list.items).toEqual([
        { rank: 1, pokemonId: 25, favoriteCount: 42 },
        { rank: 2, pokemonId: 6, favoriteCount: 38 },
    ]);
});

it('脏条目（字段缺失 / 非有限数）过滤掉，不污染榜单', async () => {
    response.data = {
        total: 3,
        items: [
            { rank: 1, pokemon_id: 25, favorite_count: 42 },
            { rank: 'x', pokemon_id: 6, favorite_count: 38 },
            { rank: 3, pokemon_id: 9, favorite_count: NaN },
            { rank: 4, favorite_count: 1 },
        ],
    };
    const list = await listPokemonPopularity();
    expect(list.items).toEqual([{ rank: 1, pokemonId: 25, favoriteCount: 42 }]);
});

it('items 不是数组时整体降级为空列表而非抛脏数据', async () => {
    response.data = { total: 0, items: null };
    const list = await listPokemonPopularity();
    expect(list.items).toEqual([]);
    expect(list.total).toBe(0);
});

it('非 2xx 状态抛 RestRequestError', async () => {
    response = { statusCode: 500, data: { error: 'err', code: 'INTERNAL' } };
    await expect(listPokemonPopularity()).rejects.toMatchObject({ name: 'RestRequestError', statusCode: 500 });
});
