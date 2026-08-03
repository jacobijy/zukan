import { Types } from '@/model/TypesDefine';
import { getTypeColor, getTypeShort } from '@/constants/pokemonTypes';

// 格式化ID
export const padId = (id: number) => {
    return id.toString().padStart(3, '0');
};

// ─── 属性颜色 / 标签 ───
// 数据源在 @/constants/pokemonTypes，这里只做转发以兼容现有 import。
export { getTypeColor };
/** @deprecated 用 getTypeShort（@/constants/pokemonTypes） */
export const getTypeLabel = getTypeShort;

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
