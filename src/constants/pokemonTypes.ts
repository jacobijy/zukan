/**
 * 属性（Type）单一数据源。
 *
 * 全站属性的中文名、单字缩写、纯色、渐变 class 都从这里取。
 * 曾经散落在 PokemonCard / detail / MoveCard / FilterBar / helpers 五处，
 * 改动一个颜色要找五个文件——收敛到此。
 *
 * 属性 id 采用 PokeApi / 服务端 `Types` 枚举的标准编号（normal=1, fire=10…），
 * 与 i18n bundle 的 `types` 名称表同键。本地化名称见 `useI18nStore().typeName`。
 */

import { Types } from '@/model/TypesDefine';

export interface TypeMeta {
    /** pokeapi slug：'fire' */
    slug: string;
    /** 全名：'火' / '超能力' */
    name: string;
    /** 单字缩写：'火' / '超'，用于空间紧张的徽章 */
    short: string;
    /** 纯色 hex，用于 inline style 背景 */
    color: string;
    /** tailwind 渐变 class（含必要的文字色覆盖） */
    gradient: string;
}

const META: Record<string, TypeMeta> = {
    normal: { slug: 'normal', name: '一般', short: '普', color: '#A8A878', gradient: 'bg-gradient-to-br from-[#A8A77A] to-[#72714d]' },
    fire: { slug: 'fire', name: '火', short: '火', color: '#F08030', gradient: 'bg-gradient-to-br from-[#f58b38] to-[#c84b22]' },
    water: { slug: 'water', name: '水', short: '水', color: '#6890F0', gradient: 'bg-gradient-to-br from-[#5b95f0] to-[#2763c8]' },
    electric: { slug: 'electric', name: '电', short: '电', color: '#F8D030', gradient: 'bg-gradient-to-br from-[#ffd84a] to-[#d99b00] text-[#2f2a12]' },
    grass: { slug: 'grass', name: '草', short: '草', color: '#78C850', gradient: 'bg-gradient-to-br from-[#83c85a] to-[#3f8f3d]' },
    ice: { slug: 'ice', name: '冰', short: '冰', color: '#98D8D8', gradient: 'bg-gradient-to-br from-[#9adfdc] to-[#50a7aa] text-[#17383a]' },
    fighting: { slug: 'fighting', name: '格斗', short: '斗', color: '#C03028', gradient: 'bg-gradient-to-br from-[#c83a30] to-[#7f211d]' },
    poison: { slug: 'poison', name: '毒', short: '毒', color: '#A040A0', gradient: 'bg-gradient-to-br from-[#a44ab0] to-[#682672]' },
    ground: { slug: 'ground', name: '地面', short: '地', color: '#E0C068', gradient: 'bg-gradient-to-br from-[#e4bf67] to-[#9b7332] text-[#2f2414]' },
    flying: { slug: 'flying', name: '飞行', short: '飞', color: '#A890F0', gradient: 'bg-gradient-to-br from-[#a996f2] to-[#6a55c7]' },
    psychic: { slug: 'psychic', name: '超能力', short: '超', color: '#F85888', gradient: 'bg-gradient-to-br from-[#ff6794] to-[#c82e63]' },
    bug: { slug: 'bug', name: '虫', short: '虫', color: '#A8B820', gradient: 'bg-gradient-to-br from-[#a9bd24] to-[#687b11]' },
    rock: { slug: 'rock', name: '岩石', short: '岩', color: '#B8A038', gradient: 'bg-gradient-to-br from-[#bba33d] to-[#756527]' },
    ghost: { slug: 'ghost', name: '幽灵', short: '鬼', color: '#705898', gradient: 'bg-gradient-to-br from-[#725799] to-[#3d2b62]' },
    dragon: { slug: 'dragon', name: '龙', short: '龙', color: '#7038F8', gradient: 'bg-gradient-to-br from-[#7042ff] to-[#3519a8]' },
    dark: { slug: 'dark', name: '恶', short: '恶', color: '#705848', gradient: 'bg-gradient-to-br from-[#715847] to-[#35261f]' },
    steel: { slug: 'steel', name: '钢', short: '钢', color: '#B8B8D0', gradient: 'bg-gradient-to-br from-[#bfc0d4] to-[#797b96] text-[#242638]' },
    fairy: { slug: 'fairy', name: '妖精', short: '妖', color: '#EE99AC', gradient: 'bg-gradient-to-br from-[#df8bb6] to-[#a94f7c]' },
};

/** 未知 slug 兜底：显示原始 slug，中性配色 */
const FALLBACK: TypeMeta = {
    slug: 'unknown',
    name: '未知',
    short: '?',
    color: '#9da2ad',
    gradient: 'bg-gradient-to-br from-[#78906a] to-[#43543a]',
};

export const TYPE_META = META;

/** 18 个标准属性 slug，按图鉴常见顺序（筛选面板依赖此顺序） */
export const ALL_TYPE_SLUGS = Object.keys(META);

/** 取 meta；未知 slug 返回兜底（name/short 替换为原始 slug 以便排查） */
export const getTypeMeta = (slug: string): TypeMeta => {
    const key = (slug || '').toLowerCase();
    return META[key] ?? { ...FALLBACK, slug: key, name: key || FALLBACK.name, short: key || FALLBACK.short };
};

export const getTypeName = (slug: string) => getTypeMeta(slug).name;
export const getTypeShort = (slug: string) => getTypeMeta(slug).short;
export const getTypeColor = (slug: string) => getTypeMeta(slug).color;
export const getTypeGradient = (slug: string) => getTypeMeta(slug).gradient;

// ─── id ↔ slug ───
// `Types` 枚举数字 id → slug，服务端 typeEntries 与 i18n types 表都用这个 id 键控。

/** 数字 type id → slug（与服务端 `Types` 枚举 / i18n types 表同键） */
export const typeStrs: { [type: number]: string } = {
    [Types.Normal]: 'normal',
    [Types.Fire]: 'fire',
    [Types.Water]: 'water',
    [Types.Electric]: 'electric',
    [Types.Grass]: 'grass',
    [Types.Ice]: 'ice',
    [Types.Fighting]: 'fighting',
    [Types.Poison]: 'poison',
    [Types.Ground]: 'ground',
    [Types.Flying]: 'flying',
    [Types.Psychic]: 'psychic',
    [Types.Bug]: 'bug',
    [Types.Rock]: 'rock',
    [Types.Ghost]: 'ghost',
    [Types.Dragon]: 'dragon',
    [Types.Dark]: 'dark',
    [Types.Steel]: 'steel',
    [Types.Fairy]: 'fairy',
};

/** slug → 数字 type id；未知 slug 返回 undefined */
export const TYPE_ID_BY_SLUG: Readonly<Record<string, number>> = Object.fromEntries(
    Object.entries(typeStrs).map(([id, slug]) => [slug, Number(id)])
);
