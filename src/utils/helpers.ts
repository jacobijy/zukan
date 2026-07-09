import { Types } from '@/model/TypesDefine';

// 格式化ID
export const padId = (id: number) => {
    return id.toString().padStart(3, '0');
};

// 根据能力值获取颜色
export const statColor = (value: number) => {
    if (value >= 150) return '#ff4d4d';
    if (value >= 100) return '#ff9e4d';
    if (value >= 80) return '#ffd24d';
    if (value >= 60) return '#b0d84d';
    if (value >= 40) return '#4db0d8';
    return '#4d7cd8';
};

// ─── 属性颜色（字符串键名）───
export const typeColorStrs: Record<string, string> = {
    normal: '#A8A878', fire: '#F08030', water: '#6890F0', electric: '#F8D030',
    grass: '#78C850', ice: '#98D8D8', fighting: '#C03028', poison: '#A040A0',
    ground: '#E0C068', flying: '#A890F0', psychic: '#F85888', bug: '#A8B820',
    rock: '#B8A038', ghost: '#705898', dragon: '#7038F8', dark: '#705848',
    steel: '#B8B8D0', fairy: '#EE99AC',
};
export const typeLabelStrs: Record<string, string> = {
    normal: '普', fire: '火', water: '水', electric: '电', grass: '草', ice: '冰',
    fighting: '斗', poison: '毒', ground: '地', flying: '飞', psychic: '超',
    bug: '虫', rock: '岩', ghost: '鬼', dragon: '龙', dark: '恶', steel: '钢', fairy: '妖',
};
export const getTypeColor = (t: string) => typeColorStrs[t.toLowerCase()] || '#9da2ad';
export const getTypeLabel = (t: string) => typeLabelStrs[t.toLowerCase()] || t;

// ─── 属性颜色（数字枚举键名）───
export const typeColors: { [type: number]: string } = {
    [Types.Normal]: '#A8A878',
    [Types.Fire]: '#F08030',
    [Types.Water]: '#6890F0',
    [Types.Electric]: '#F8D030',
    [Types.Grass]: '#78C850',
    [Types.Ice]: '#98D8D8',
    [Types.Fighting]: '#C03028',
    [Types.Poison]: '#A040A0',
    [Types.Ground]: '#E0C068',
    [Types.Flying]: '#A890F0',
    [Types.Psychic]: '#F85888',
    [Types.Bug]: '#A8B820',
    [Types.Rock]: '#B8A038',
    [Types.Ghost]: '#705898',
    [Types.Dragon]: '#7038F8',
    [Types.Dark]: '#705848',
    [Types.Steel]: '#B8B8D0',
    [Types.Fairy]: '#EE99AC'
};

export const str2Types: { [str: string]: number } = {
    'normal': Types.Normal,
    'fire': Types.Fire,
    'water': Types.Water,
    'electric': Types.Electric,
    'grass': Types.Grass,
    'ice': Types.Ice,
    'fighting': Types.Fighting,
    'poison': Types.Poison,
    'ground': Types.Ground,
    'flying': Types.Flying,
    'psychic': Types.Psychic,
    'bug': Types.Bug,
    'rock': Types.Rock,
    'ghost': Types.Ghost,
    'dragon': Types.Dragon,
    'dark': Types.Dark,
    'steel': Types.Steel,
    'fairy': Types.Fairy
}

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
}

export const stat2Entity = (p: IPokemonBase): IPokemonBaseModel => {
    let d: IPokemonBaseModel = {
        id: 1,
        name: "妙蛙种子",
        types: ["草", "毒"],
        abilities: ["茂盛", ],
        hiddenAbility: "叶绿素",
        image: "/static/pokemon/1.png",
        stats: [
            { name: "HP", value: 45 },
            { name: "攻击", value: 49 },
            { name: "防御", value: 49 },
            { name: "特攻", value: 65 },
            { name: "特防", value: 65 },
            { name: "速度", value: 45 }
        ],
        moves: [],
        evolutionChain: [],
        description: "妙蛙种子出生时背上就背着种子。种子会随着它的成长而逐渐变大并开花。",
    }
    return d;
}
