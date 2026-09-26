/**
 * 对战数据（Pokémon Champions 使用率）公开 API。
 */
export type {
    BattleFormat,
    BattleI18nEntry,
    BattleMetaJson,
    LeaderboardRowVM,
    LinkEntry,
    NatureRowJson,
    PokemonConfigVM,
    RateRowJson,
    RateRowVM,
    SpreadRowJson,
    SpreadRowVM,
    TeammateRowVM,
} from './types';
export { capFormat, toRateRows, toSpreadRows, toTeammateNames } from './adapter';
export { toBattleLang, statKeyByEnglish, type BattleLang } from './battleLang';
export { ensureDict, entryForm, entryName, type BattleDict, type BattleDictCategory } from './battleDict';
export { loadBattleMeta, loadLeaderboardSlugs, loadLinkMap, loadPokemonConfig } from './service';
