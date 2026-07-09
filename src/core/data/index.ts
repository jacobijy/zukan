// ============= 原始 TypeScript 数据文件（向后兼容）=============
export { Natures } from './natures';
export { TypeChart } from './typechart';
export { Scripts } from './scripts';
export { Tags } from './tags';
export { Conditions } from './conditions';
export { Items } from './items';
export { Abilities } from './abilities';
export { Rulesets } from './rulesets';
export { FormatsData } from './formats-data';
export { Moves } from './moves';

// ============= 纯 JSON 数据文件（新结构）=============
import naturesData from './json/natures.json';
import typechartData from './json/typechart.json';
import scriptsData from './json/scripts.json';
import tagsData from './json/tags.json';
import conditionsData from './json/conditions.json';
import itemsData from './json/items.json';
import abilitiesData from './json/abilities.json';
import rulesetsData from './json/rulesets.json';
import formatsData from './json/formats-data.json';
import movesData from './json/moves.json';

// 类型定义
import type { NatureDataTable } from '../sim/dex-data';
import type { TypeDataTable } from '../sim/dex-data';
import type { BattleScriptsData } from '../sim/dex-conditions';
import type { ConditionDataTable } from '../sim/dex-conditions';
import type { ItemDataTable } from '../sim/dex-items';
import type { AbilityDataTable } from '../sim/dex-abilities';
import type { RulesetDataTable } from '../sim/dex-rulesets';
import type { FormatDataTable } from '../sim/dex-formats';
import type { MoveDataTable } from '../sim/dex-moves';

// 导出纯 JSON 数据
export const NaturesJSON = naturesData as NatureDataTable;
export const TypeChartJSON = typechartData as TypeDataTable;
export const ScriptsJSON = scriptsData as BattleScriptsData;
export const TagsJSON = tagsData;
export const ConditionsJSON = conditionsData as ConditionDataTable;
export const ItemsJSON = itemsData as ItemDataTable;
export const AbilitiesJSON = abilitiesData as AbilityDataTable;
export const RulesetsJSON = rulesetsData as RulesetDataTable;
export const FormatsDataJSON = formatsData as FormatDataTable;
export const MovesJSON = movesData as MoveDataTable;

// ============= 枚举类型定义 =============
export { PokemonType } from './enums/PokemonType';
export { MoveId } from './enums/MoveId';
export { AbilityId } from './enums/AbilityId';
export { ItemId } from './enums/ItemId';
export { NatureId } from './enums/NatureId';
export { PokemonId } from './enums/PokemonId';

// ============= 效果处理函数（方案设计阶段）=============
// Effects 目录将存放各数据类型的回调函数
// 详见 CONVERSION_SCHEME.md 文档
// 下一阶段：提取回调函数到独立 effects/*.ts 文件
