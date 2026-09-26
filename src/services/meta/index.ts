/**
 * 对战数据（使用率排行榜）公开 API。
 */
export type { BattleFormat, MetaSeason, UsageRankingItem } from './types';
export { toSeasonList, toUsageRanking } from './adapter';
export { loadSeasons, loadUsageRanking } from './service';
