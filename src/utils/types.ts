/** 属性颜色映射 */
export const TYPE_COLORS: Record<string, string> = {
    normal: '#A8A878', fire: '#F08030', water: '#6890F0', electric: '#F8D030',
    grass: '#78C850', ice: '#98D8D8', fighting: '#C03028', poison: '#A040A0',
    ground: '#E0C068', flying: '#A890F0', psychic: '#F85888', bug: '#A8B820',
    rock: '#B8A038', ghost: '#705898', dragon: '#7038F8', dark: '#705848',
    steel: '#B8B8D0', fairy: '#EE99AC',
};

/** 属性中文缩写 */
export const TYPE_LABELS: Record<string, string> = {
    normal: '普', fire: '火', water: '水', electric: '电', grass: '草', ice: '冰',
    fighting: '斗', poison: '毒', ground: '地', flying: '飞', psychic: '超',
    bug: '虫', rock: '岩', ghost: '鬼', dragon: '龙', dark: '恶', steel: '钢', fairy: '妖',
};

/** 属性中文全称 */
export const TYPE_NAMES: Record<string, string> = {
    normal: '一般', fire: '火', water: '水', electric: '电', grass: '草', ice: '冰',
    fighting: '格斗', poison: '毒', ground: '地面', flying: '飞行', psychic: '超能力',
    bug: '虫', rock: '岩石', ghost: '幽灵', dragon: '龙', dark: '恶', steel: '钢', fairy: '妖精',
};

export function getTypeColor(type: string): string {
    return TYPE_COLORS[type.toLowerCase()] || '#9da2ad';
}

export function getTypeLabel(type: string): string {
    return TYPE_LABELS[type.toLowerCase()] || type;
}

export function getTypeName(type: string): string {
    return TYPE_NAMES[type.toLowerCase()] || type;
}