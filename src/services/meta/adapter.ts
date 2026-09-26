/**
 * 对战数据 adapter：原始 JSON → VM。
 *
 * 纯函数、零平台 / dict / http 依赖，可在 node 测试环境直接运行。
 * 名称翻译不在此层（英文名保留在结果里，由页面用 battleDict 翻译）。
 * 容错：上游字段可能缺失，无效行（名字为空 / pct 非有限值）一律丢弃，缺组按 [] 处理。
 */
import type {
    BattleFormat,
    LeaderboardEntryJson,
    PokemonConfigJson,
    PokemonConfigVM,
    SpreadRowJson,
    SpreadRowVM,
    TeammateRowJson,
} from './types';

/** 保留 1 位小数 */
function round1(n: number): number {
    return Math.round(n * 10) / 10;
}

/** 内部小写赛制 → 上游大写格式段（路径 / leaderboard 键） */
export function capFormat(format: BattleFormat): 'Singles' | 'Doubles' {
    return format === 'doubles' ? 'Doubles' : 'Singles';
}

/** 排行榜条目 → 有序 slug 列表：丢弃无 id 行，按 rank 升序（缺 rank 排末尾）。 */
export function toSlugs(entries: LeaderboardEntryJson[] | undefined): string[] {
    return (entries ?? [])
        .filter((e) => e && typeof e.id === 'string' && e.id.length > 0)
        .toSorted((a, b) => (a.rank ?? Number.POSITIVE_INFINITY) - (b.rank ?? Number.POSITIVE_INFINITY))
        .map((e) => e.id);
}

interface RateLike {
    rank: number;
    pct: number;
}

/** 选用率（招式/特性/道具）：丢弃无效行，按 rank 升序，barWidth 相对组内榜首。 */
export function toRateRows<T extends RateLike>(rows: T[] | undefined): Array<T & { barWidth: number }> {
    const valid = (rows ?? [])
        .filter((r) => r && Number.isFinite(r.pct) && r.pct >= 0)
        .toSorted((a, b) => (a.rank ?? Number.POSITIVE_INFINITY) - (b.rank ?? Number.POSITIVE_INFINITY));
    const max = valid.length ? valid[0].pct : 0;
    return valid.map((r) => ({
        ...r,
        barWidth: max > 0 ? round1((r.pct / max) * 100) : 0,
    }));
}

/** SP 加点：按 rank 升序，六项取整（缺省 0），barWidth 相对组内榜首。 */
export function toSpreadRows(rows: SpreadRowJson[] | undefined): SpreadRowVM[] {
    return toRateRows(rows).map((r) => ({
        pct: r.pct,
        barWidth: r.barWidth,
        hp: statInt(r.hp),
        atk: statInt(r.atk),
        def: statInt(r.def),
        spa: statInt(r.spa),
        spd: statInt(r.spd),
        spe: statInt(r.spe),
    }));
}

function statInt(v: unknown): number {
    const n = Number(v);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(32, Math.round(n)));
}

/** 常见队友：丢弃无名行，按 rank 升序，返回英文名（页面用 pokemon 字典翻译）。 */
export function toTeammateNames(rows: TeammateRowJson[] | undefined): string[] {
    return (rows ?? [])
        .filter((r) => r && typeof r.name === 'string' && r.name.length > 0)
        .toSorted((a, b) => (a.rank ?? Number.POSITIVE_INFINITY) - (b.rank ?? Number.POSITIVE_INFINITY))
        .map((r) => r.name);
}

/** 单只配置：六组分流，缺组给 []；返回英文名维度，页面再翻译组装。 */
export function toPokemonConfig(json: PokemonConfigJson): PokemonConfigVM {
    const rows = json.rows ?? {};
    return {
        slug: json.id,
        rank: json.rank,
        moves: rows.move ?? [],
        abilities: rows.ability ?? [],
        items: rows.item ?? [],
        natures: rows.nature ?? [],
        spreads: rows.spread ?? [],
        teammates: rows.teammate ?? [],
    };
}
