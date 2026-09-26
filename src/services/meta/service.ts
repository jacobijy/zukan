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

// ── meta ──

let metaPromise: Promise<BattleMetaJson> | null = null;

/** 数据 meta（当前赛季 / dataVersion）；module 级缓存。 */
export function loadBattleMeta(): Promise<BattleMetaJson> {
    if (metaPromise) return metaPromise;
    metaPromise = fetchAssetJson<BattleMetaJson>('assets/battle/meta.json');
    metaPromise.catch(() => {
        metaPromise = null;
    });
    return metaPromise;
}

// ── 排行榜 ──

let leaderboardPromise: Promise<LeaderboardJson> | null = null;

function loadLeaderboardJson(): Promise<LeaderboardJson> {
    if (leaderboardPromise) return leaderboardPromise;
    leaderboardPromise = fetchAssetJson<LeaderboardJson>('assets/battle/leaderboard.json');
    leaderboardPromise.catch(() => {
        leaderboardPromise = null;
    });
    return leaderboardPromise;
}

/** 某赛制的有序 slug 列表（排行榜两个列表同处 leaderboard.json）。 */
export async function loadLeaderboardSlugs(format: BattleFormat): Promise<string[]> {
    const json = await loadLeaderboardJson();
    return toSlugs(json[capFormat(format)]);
}

// ── link ──

let linkPromise: Promise<Map<string, LinkEntry>> | null = null;

/** slug → 图鉴物种 link 映射；module 级缓存。 */
export function loadLinkMap(): Promise<Map<string, LinkEntry>> {
    if (linkPromise) return linkPromise;
    linkPromise = fetchAssetJson<Record<string, LinkEntry>>('assets/battle/link.json').then(
        (obj) => new Map(Object.entries(obj)),
    );
    linkPromise.catch(() => {
        linkPromise = null;
    });
    return linkPromise;
}

// ── 单只配置 ──

const configCache = new Map<string, Promise<PokemonConfigVM>>();

/** 某赛制 × slug 的完整对战配置（按需拉取）；按 `${format}:${slug}` 缓存。 */
export function loadPokemonConfig(format: BattleFormat, slug: string): Promise<PokemonConfigVM> {
    const key = `${format}:${slug}`;
    const cached = configCache.get(key);
    if (cached) return cached;
    const path = `assets/battle/p/${capFormat(format)}/${slug}.json`;
    const promise = fetchAssetJson<PokemonConfigJson>(path).then(toPokemonConfig);
    promise.catch(() => {
        configCache.delete(key);
    });
    configCache.set(key, promise);
    return promise;
}
