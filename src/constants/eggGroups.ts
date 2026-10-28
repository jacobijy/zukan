/**
 * 蛋组元数据（PokeAPI `egg_groups` 标准 id 1..15）。
 *
 * 蛋组 id 来自 PKMB bundle 的 eggGroupEntries（eggGroup1Id/eggGroup2Id），
 * 蛋组**内容名**走 PKNM i18n 名称表（`i18nStore.eggGroupName(id)`，随内容语言切换）；
 * 这里的 name 只是 i18n 未就绪时的中文兜底，与 pokemonTypes.ts 的兜底名同口径。
 *
 * 与属性不同：蛋组没有配色/相克数据，UI 一律使用统一中性色。
 */

export interface EggGroupMeta {
    /** PokeAPI egg_groups id（PKMB eggGroupEntries 直接使用） */
    id: number;
    /** PokeAPI 英文 slug，调试/未来语义用；当前路由用 id */
    slug: string;
    /** 简中官方译名，仅作 i18n 未就绪时的兜底 */
    name: string;
}

export const EGG_GROUPS: readonly EggGroupMeta[] = [
    { id: 1, slug: 'monster', name: '怪兽' },
    { id: 2, slug: 'water1', name: '水1' },
    { id: 3, slug: 'bug', name: '虫' },
    { id: 4, slug: 'flying', name: '飞行' },
    { id: 5, slug: 'field', name: '陆上' },
    { id: 6, slug: 'fairy', name: '妖精' },
    { id: 7, slug: 'grass', name: '植物' },
    { id: 8, slug: 'human-like', name: '人型' },
    { id: 9, slug: 'water3', name: '水3' },
    { id: 10, slug: 'mineral', name: '矿物' },
    { id: 11, slug: 'amorphous', name: '不定形' },
    { id: 12, slug: 'water2', name: '水2' },
    { id: 13, slug: 'ditto', name: '百变怪' },
    { id: 14, slug: 'dragon', name: '龙' },
    { id: 15, slug: 'undiscovered', name: '未发现' },
];

const EGG_GROUP_BY_ID: ReadonlyMap<number, EggGroupMeta> = new Map(EGG_GROUPS.map((g) => [g.id, g]));

/** 按 id 取蛋组元数据；未知 id 返回 undefined。 */
export function getEggGroupMeta(id: number): EggGroupMeta | undefined {
    return EGG_GROUP_BY_ID.get(id);
}
