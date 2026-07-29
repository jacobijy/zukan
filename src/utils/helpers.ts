import { Types } from '@/model/TypesDefine';

// 格式化ID
export const padId = (id: number) => {
    return id.toString().padStart(3, '0');
};

// ─── 属性颜色（字符串键名）───
const typeColorStrs: Record<string, string> = {
    normal: '#A8A878',
    fire: '#F08030',
    water: '#6890F0',
    electric: '#F8D030',
    grass: '#78C850',
    ice: '#98D8D8',
    fighting: '#C03028',
    poison: '#A040A0',
    ground: '#E0C068',
    flying: '#A890F0',
    psychic: '#F85888',
    bug: '#A8B820',
    rock: '#B8A038',
    ghost: '#705898',
    dragon: '#7038F8',
    dark: '#705848',
    steel: '#B8B8D0',
    fairy: '#EE99AC',
};
const typeLabelStrs: Record<string, string> = {
    normal: '普',
    fire: '火',
    water: '水',
    electric: '电',
    grass: '草',
    ice: '冰',
    fighting: '斗',
    poison: '毒',
    ground: '地',
    flying: '飞',
    psychic: '超',
    bug: '虫',
    rock: '岩',
    ghost: '鬼',
    dragon: '龙',
    dark: '恶',
    steel: '钢',
    fairy: '妖',
};
export const getTypeColor = (t: string) => typeColorStrs[t.toLowerCase()] || '#9da2ad';
export const getTypeLabel = (t: string) => typeLabelStrs[t.toLowerCase()] || t;

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
