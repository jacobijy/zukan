/**
 * 对战数据 adapter：后端 DTO → UI 模型。
 *
 * 纯函数、零平台依赖（不 import uni / pinia / http），可在 node 测试环境直接运行。
 * 后端返回的字段 / 口径若有调整，只改本文件。
 */
import type {
    CategoryUsageEntryDTO,
    CategoryUsageItem,
    MetaSeason,
    PokemonMetaResponseDTO,
    PokemonUsageMeta,
    SeasonDTO,
    UsageResponseDTO,
    UsageRankingItem,
} from './types';

/** 保留 1 位小数 */
function round1(n: number): number {
    return Math.round(n * 10) / 10;
}

/**
 * 构建使用率排行榜：
 * - 滤掉无效行（species_id<=0 / usage_rate 为负或非有限值）；
 * - 按使用率**降序**；
 * - usage_rate 0..1 → 百分比；进度条宽度相对榜首（榜首=100%）。
 */
export function toUsageRanking(dto: UsageResponseDTO): UsageRankingItem[] {
    const valid = dto.entries
        .filter((e) => e.species_id > 0 && Number.isFinite(e.usage_rate) && e.usage_rate >= 0)
        .toSorted((a, b) => b.usage_rate - a.usage_rate);

    const max = valid.length ? valid[0].usage_rate : 0;
    return valid.map((e) => ({
        speciesId: e.species_id,
        usageRate: round1(e.usage_rate * 100),
        barWidth: max > 0 ? round1((e.usage_rate / max) * 100) : 0,
    }));
}

/**
 * 构建赛季列表：当前赛季置顶，其余保持输入顺序。
 */
export function toSeasonList(dtos: SeasonDTO[]): MetaSeason[] {
    return dtos
        .map((s) => ({ id: s.id, label: s.label, isCurrent: s.is_current }))
        .toSorted((a, b) => Number(b.isCurrent) - Number(a.isCurrent));
}

// ── 宝可梦对战配置（招式 / 道具 / 特性）──

/**
 * 构建某类别（招式/道具/特性）的选用率：
 * - 滤掉无效行（id<=0 / usage_rate 为负或非有限值）；
 * - 按选用率**降序**；
 * - usage_rate 0..1 → 百分比；进度条宽度相对该类别榜首（榜首=100%）。
 */
export function toCategoryUsage(entries: CategoryUsageEntryDTO[]): CategoryUsageItem[] {
    const valid = entries
        .filter((e) => e.id > 0 && Number.isFinite(e.usage_rate) && e.usage_rate >= 0)
        .toSorted((a, b) => b.usage_rate - a.usage_rate);

    const max = valid.length ? valid[0].usage_rate : 0;
    return valid.map((e) => ({
        id: e.id,
        usageRate: round1(e.usage_rate * 100),
        barWidth: max > 0 ? round1((e.usage_rate / max) * 100) : 0,
    }));
}

/** 构建宝可梦对战配置：三个类别各自转换、各自相对榜首。 */
export function toPokemonUsageMeta(dto: PokemonMetaResponseDTO): PokemonUsageMeta {
    return {
        speciesId: dto.species_id,
        abilities: toCategoryUsage(dto.abilities),
        items: toCategoryUsage(dto.items),
        moves: toCategoryUsage(dto.moves),
    };
}
