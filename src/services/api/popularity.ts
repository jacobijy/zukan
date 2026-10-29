/**
 * 收藏热度榜 API 客户端（**公开匿名**，无需 token）。
 *
 * 端点（`/api/v1` 前缀由 rest 统一补）：
 * - GET /popularity/pokemon?limit=&offset=  人气榜（收藏数降序，同数按 pokemon_id 升序）
 * - GET /popularity/pokemon/:pokemon_id      单只收藏数与名次（当前前端未使用）
 *
 * 数据来自 Postgres 物化视图，服务端每天 00/06/12/18 点（UTC+8）重建，
 * 不是实时数据。协议权威见 docs/data/popularity.md。
 */

import { rest } from '@/services/http';

export interface PopularityItem {
    /** 全局名次，从 1 开始连续编号 */
    rank: number;
    /** 形态 id（与收藏 / 立绘 / 详情路由同一 id 空间） */
    pokemonId: number;
    /** 收藏该宝可梦的去重用户数 */
    favoriteCount: number;
}

export interface PopularityList {
    /** 服务端重建时间（RFC 3339） */
    updatedAt: string;
    /** 榜单总条数（有收藏记录的宝可梦去重总数） */
    total: number;
    items: PopularityItem[];
}

interface RawItem {
    rank?: unknown;
    pokemon_id?: unknown;
    favorite_count?: unknown;
}

interface RawList {
    updated_at?: unknown;
    total?: unknown;
    items?: unknown;
}

const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** 单条脏数据（字段缺失 / 非有限数）降级为 null，由调用方过滤。 */
const toItem = (raw: RawItem): PopularityItem | null => {
    const { rank, pokemon_id, favorite_count } = raw;
    if (isFiniteNumber(rank) && isFiniteNumber(pokemon_id) && isFiniteNumber(favorite_count)) {
        return { rank, pokemonId: pokemon_id, favoriteCount: favorite_count };
    }
    return null;
};

/**
 * 拉取人气榜一页。limit/offset 越界由服务端判 400 INVALID_INPUT；
 * 响应整体形状异常（items 不是数组）时降级为空列表，不抛脏数据进 UI。
 */
export async function listPokemonPopularity(limit = 20, offset = 0): Promise<PopularityList> {
    const q = `limit=${limit}&offset=${offset}`;
    const res = await rest.get<RawList>(`/popularity/pokemon?${q}`);
    const rawItems = Array.isArray(res?.items) ? (res.items as RawItem[]) : [];
    return {
        updatedAt: typeof res?.updated_at === 'string' ? res.updated_at : '',
        total: typeof res?.total === 'number' ? res.total : rawItems.length,
        items: rawItems.map(toItem).filter((x): x is PopularityItem => x !== null),
    };
}
