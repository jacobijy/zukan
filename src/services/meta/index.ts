/**
 * 对战数据（使用率排行榜 / 宝可梦对战配置）公开 API。
 */
export type {
    BattleFormat,
    CategoryUsageItem,
    MetaRateRowVM,
    MetaSeason,
    PokemonUsageMeta,
    UsageRankingItem,
} from './types';
export { toCategoryUsage, toPokemonUsageMeta, toSeasonList, toUsageRanking } from './adapter';
export { loadPokemonUsageMeta, loadSeasons, loadUsageRanking } from './service';
