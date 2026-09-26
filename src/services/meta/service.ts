/**
 * 对战数据 service：赛季列表与使用率排行榜的取数 + module 级缓存。
 *
 * 缓存按参数区分（赛制 / 赛季），promise 失败时摘除可重试——范式同
 * `services/pokemon/archive.ts`。
 *
 * ┌─ 后端就绪接入点（唯一需要改动处）──────────────────────────────┐
 * │ 1. 新建 `src/services/api/meta.ts`：用 `rest.get` 拉             │
 * │    `/meta/seasons?format=` 与 `/meta/usage?format=&season=`，    │
 * │    在 `api/index.ts` 注册 `export * as metaApi from './meta'`。  │
 * │ 2. 把下面 `fetchSeasonsDto` / `fetchUsageDto` 改为调 metaApi，    │
 * │    删除 `mock.ts`。页面与 adapter 不动。                          │
 * └──────────────────────────────────────────────────────────────────┘
 */
import { toSeasonList, toUsageRanking } from './adapter';
import { mockSeasons, mockUsageResponse } from './mock';
import type { BattleFormat, MetaSeason, UsageResponseDTO, UsageRankingItem, SeasonDTO } from './types';

/** 仅用于让 mock 期的切换 / loading 态可见；后端就绪后删除 */
const MOCK_LATENCY_MS = 120;
function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchSeasonsDto(format: BattleFormat): Promise<SeasonDTO[]> {
    await delay(MOCK_LATENCY_MS);
    return mockSeasons(format);
}

async function fetchUsageDto(format: BattleFormat, seasonId: string): Promise<UsageResponseDTO> {
    await delay(MOCK_LATENCY_MS);
    return mockUsageResponse(format, seasonId);
}

// ── 赛季列表 ──

const seasonsCache: Partial<Record<BattleFormat, Promise<MetaSeason[]>>> = {};

/** 赛制对应的赛季列表（当前 + 历史）；module 级缓存。 */
export function loadSeasons(format: BattleFormat): Promise<MetaSeason[]> {
    const cached = seasonsCache[format];
    if (cached) return cached;
    const promise = fetchSeasonsDto(format).then(toSeasonList);
    promise.catch(() => {
        delete seasonsCache[format];
    });
    seasonsCache[format] = promise;
    return promise;
}

// ── 使用率排行榜 ──

const usageCache = new Map<string, Promise<UsageRankingItem[]>>();

/** 某赛制 × 赛季的使用率排行榜；按 `${format}:${seasonId}` 缓存。 */
export function loadUsageRanking(format: BattleFormat, seasonId: string): Promise<UsageRankingItem[]> {
    const key = `${format}:${seasonId}`;
    const cached = usageCache.get(key);
    if (cached) return cached;
    const promise = fetchUsageDto(format, seasonId).then(toUsageRanking);
    promise.catch(() => {
        usageCache.delete(key);
    });
    usageCache.set(key, promise);
    return promise;
}
