/**
 * 对战数据 service：meta / 排行榜 / link / 单只配置的取数与 module 级缓存。
 *
 * 数据源为明文公开 JSON（`/assets/battle/`），**不涉及 DEK/加密**。
 *
 * 缓存：上游约每日刷新，建议先用 `loadBattleMeta().dataVersion` 比对，变化后丢弃下列缓存
 * 重新拉取（后续接入点）；当前做会话内缓存 + 服务端短缓存（max-age）。
 */
import { fetchAssetJson } from '@/services/http';
import { capFormat, toPokemonConfig, toSlugs } from './adapter';
import type {
    BattleFormat,
    BattleMetaJson,
    LeaderboardJson,
    LinkEntry,
    PokemonConfigJson,
    PokemonConfigVM,
} from './types';

// ── 路径约定 ──

/**
 * 明文数据文件路径：历史赛季带 `${season}/` 段（如 `/assets/battle/M5/...`），
 * 当前赛季（null / 空）沿用根路径 `/assets/battle/...`。
 * meta.json 始终在根（声明 seasons 供切换，含历史赛季）。
 */
function battlePath(season: string | null | undefined, suffix: string): string {
    return season ? `assets/battle/${season}/${suffix}` : `assets/battle/${suffix}`;
}

// ── meta ──

let metaPromise: Promise<BattleMetaJson> | null = null;

/** 数据 meta（当前赛季 / seasons 列表 / dataVersion）；module 级缓存。 */
export function loadBattleMeta(): Promise<BattleMetaJson> {
    if (metaPromise) return metaPromise;
    metaPromise = fetchAssetJson<BattleMetaJson>('assets/battle/meta.json');
    metaPromise.catch(() => {
        metaPromise = null;
    });
    return metaPromise;
}

// ── 排行榜 ──

const leaderboardPromises = new Map<string, Promise<LeaderboardJson>>();

function loadLeaderboardJson(season?: string | null): Promise<LeaderboardJson> {
    const key = season ?? '';
    const cached = leaderboardPromises.get(key);
    if (cached) return cached;
    const promise = fetchAssetJson<LeaderboardJson>(battlePath(season, 'leaderboard.json'));
    promise.catch(() => {
        leaderboardPromises.delete(key);
    });
    leaderboardPromises.set(key, promise);
    return promise;
}

/** 某赛制 × 赛季的有序 slug 列表（season 缺省 = 当前赛季）。 */
export async function loadLeaderboardSlugs(
    format: BattleFormat,
    season?: string | null,
): Promise<string[]> {
    const json = await loadLeaderboardJson(season);
    return toSlugs(json[capFormat(format)]);
}

// ── link ──

const linkPromises = new Map<string, Promise<Map<string, LinkEntry>>>();

/** slug → 图鉴物种 link 映射（season 缺省 = 当前赛季）；module 级缓存。 */
export function loadLinkMap(season?: string | null): Promise<Map<string, LinkEntry>> {
    const key = season ?? '';
    const cached = linkPromises.get(key);
    if (cached) return cached;
    const promise = fetchAssetJson<Record<string, LinkEntry>>(battlePath(season, 'link.json')).then(
        (obj) => new Map(Object.entries(obj)),
    );
    promise.catch(() => {
        linkPromises.delete(key);
    });
    linkPromises.set(key, promise);
    return promise;
}

// ── 单只配置 ──

const configCache = new Map<string, Promise<PokemonConfigVM>>();

/** 某赛制 × 赛季 × slug 的完整对战配置（按需拉取）；按 `${season}:${format}:${slug}` 缓存。 */
export function loadPokemonConfig(
    format: BattleFormat,
    slug: string,
    season?: string | null,
): Promise<PokemonConfigVM> {
    const key = `${season ?? ''}:${format}:${slug}`;
    const cached = configCache.get(key);
    if (cached) return cached;
    const path = battlePath(season, `p/${capFormat(format)}/${slug}.json`);
    const promise = fetchAssetJson<PokemonConfigJson>(path).then(toPokemonConfig);
    promise.catch(() => {
        configCache.delete(key);
    });
    configCache.set(key, promise);
    return promise;
}
