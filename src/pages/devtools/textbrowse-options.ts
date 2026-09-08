/**
 * 文本浏览器的表清单 —— 只服务开发者工具。
 *
 * 名称组约 30 张表、结构分六类（named / species / forms / prose / solo / location…），
 * 描述组 6 张（flavor ×4 + effect ×2）。这里把「表名 → 怎么取行」集中成两张表，
 * 组件里就不用写六套渲染分支。
 *
 * 表的顺序按**排查时的使用频率**排，不按 bundle 里的字段顺序 —— species / moves /
 * abilities / items 是九成场合要看的，排前面。
 *
 * 两组的表清单**各自保持自己的 bundle 类型**，不合并成一个 `TextTable<union>`：
 * 合并就得在取行函数里做窄化断言，而两组恰好都有一张叫 `species` 的表、结构却不同，
 * 断言错了 TypeScript 一声不吭。调用方按组分派（见 `DevTextBrowser.vue`）。
 */
import { cleanFlavorText } from '@/services/i18n/flavor';
import {
    fromEffects,
    fromFlavor,
    fromForms,
    fromLocations,
    fromNamed,
    fromProse,
    fromShapes,
    fromSolo,
    fromSpecies,
    type TextRow,
} from '@/services/devtools/textBrowse';
import type { I18nFlavorBundle, I18nNamesBundle } from '@/infra/wasm';

/** 两个 bundle 各是一「组」 */
export type TextGroupId = 'names' | 'flavor';

export const TEXT_GROUPS: readonly { id: TextGroupId; label: string }[] = [
    { id: 'names', label: '名称组' },
    { id: 'flavor', label: '描述组' },
];

export interface TextTable<B> {
    /** bundle 里的字段名，同时用作选择器的值 */
    id: string;
    label: string;
    rows: (bundle: B) => TextRow[];
}

/** 名称组的表。`id` 与 `I18nNamesBundle` 的字段名一一对应。 */
const NAMES_TABLES: readonly TextTable<I18nNamesBundle>[] = [
    { id: 'species', label: '物种', rows: (b) => fromSpecies(b.species) },
    { id: 'forms', label: '形态', rows: (b) => fromForms(b.forms) },
    { id: 'moves', label: '招式', rows: (b) => fromNamed(b.moves) },
    { id: 'abilities', label: '特性', rows: (b) => fromNamed(b.abilities) },
    { id: 'items', label: '道具', rows: (b) => fromNamed(b.items) },
    { id: 'types', label: '属性', rows: (b) => fromNamed(b.types) },
    { id: 'natures', label: '性格', rows: (b) => fromNamed(b.natures) },
    { id: 'stats', label: '能力', rows: (b) => fromNamed(b.stats) },
    { id: 'eggGroups', label: '蛋组', rows: (b) => fromNamed(b.eggGroups) },
    { id: 'regions', label: '地区', rows: (b) => fromNamed(b.regions) },
    { id: 'versions', label: '游戏版本', rows: (b) => fromNamed(b.versions) },
    { id: 'generations', label: '世代', rows: (b) => fromNamed(b.generations) },
    { id: 'locations', label: '地点', rows: (b) => fromLocations(b.locations) },
    { id: 'shapes', label: '体型', rows: (b) => fromShapes(b.shapes) },
    { id: 'growthRates', label: '经验组', rows: (b) => fromNamed(b.growthRates) },
    { id: 'itemCategories', label: '道具分类', rows: (b) => fromNamed(b.itemCategories) },
    { id: 'itemPockets', label: '道具口袋', rows: (b) => fromNamed(b.itemPockets) },
    { id: 'colors', label: '颜色', rows: (b) => fromNamed(b.colors) },
    { id: 'habitats', label: '栖息地', rows: (b) => fromNamed(b.habitats) },
    { id: 'moveAilments', label: '异常状态', rows: (b) => fromNamed(b.moveAilments) },
    { id: 'moveBattleStyles', label: '对战风格', rows: (b) => fromNamed(b.moveBattleStyles) },
    { id: 'encounterMethods', label: '遭遇方式', rows: (b) => fromNamed(b.encounterMethods) },
    { id: 'evolutionTriggers', label: '进化触发', rows: (b) => fromNamed(b.evolutionTriggers) },
    { id: 'berryFirmnesses', label: '树果硬度', rows: (b) => fromNamed(b.berryFirmnesses) },
    { id: 'languages', label: '语言', rows: (b) => fromNamed(b.languages) },
    { id: 'pokedexes', label: '图鉴', rows: (b) => fromProse(b.pokedexes) },
    { id: 'moveDamageClasses', label: '伤害分类', rows: (b) => fromProse(b.moveDamageClasses) },
    { id: 'moveTargets', label: '招式目标', rows: (b) => fromProse(b.moveTargets) },
    { id: 'itemFlags', label: '道具标记', rows: (b) => fromProse(b.itemFlags) },
    { id: 'moveFlags', label: '招式标记', rows: (b) => fromProse(b.moveFlags) },
    { id: 'moveCategories', label: '招式类别', rows: (b) => fromSolo(b.moveCategories) },
    { id: 'itemFlingEffects', label: '投掷效果', rows: (b) => fromSolo(b.itemFlingEffects) },
    { id: 'characteristics', label: '特征', rows: (b) => fromSolo(b.characteristics) },
];

/** 描述组的表。`id` 与 `I18nFlavorBundle` 的字段名一一对应。 */
const FLAVOR_TABLES: readonly TextTable<I18nFlavorBundle>[] = [
    { id: 'species', label: '图鉴描述', rows: (b) => fromFlavor(b.species, cleanFlavorText) },
    { id: 'moves', label: '招式说明', rows: (b) => fromFlavor(b.moves, cleanFlavorText) },
    { id: 'abilities', label: '特性说明', rows: (b) => fromFlavor(b.abilities, cleanFlavorText) },
    { id: 'items', label: '道具说明', rows: (b) => fromFlavor(b.items, cleanFlavorText) },
    { id: 'abilityEffects', label: '特性效果（仅 en）', rows: (b) => fromEffects(b.abilityEffects, cleanFlavorText) },
    { id: 'moveEffects', label: '招式效果（仅 en）', rows: (b) => fromEffects(b.moveEffects, cleanFlavorText) },
];

/** 表选择器的选项（只要 id/label，不带 bundle 类型，组件用这个渲染） */
export function tableOptions(group: TextGroupId): { id: string; label: string }[] {
    const list = group === 'names' ? NAMES_TABLES : FLAVOR_TABLES;
    return list.map((t) => ({ id: t.id, label: t.label }));
}

/** 找名称组的表；表名对不上（切组时残留的旧选择）回落第一张 */
export function namesTable(id: string): TextTable<I18nNamesBundle> {
    return NAMES_TABLES.find((t) => t.id === id) ?? NAMES_TABLES[0]!;
}

/** 找描述组的表；同上 */
export function flavorTable(id: string): TextTable<I18nFlavorBundle> {
    return FLAVOR_TABLES.find((t) => t.id === id) ?? FLAVOR_TABLES[0]!;
}

/** 默认停在最常看的物种表（两组都有这个 id，切组时不会落空） */
export const DEFAULT_TEXT_TABLE = 'species';

/** 一次最多渲染多少条（理由见 textBrowse.pageRows） */
export const TEXT_ROW_LIMIT = 200;
