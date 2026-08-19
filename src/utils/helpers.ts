import { getTypeColor, getTypeShort, typeStrs } from '@/constants/pokemonTypes';

// 格式化ID
export const padId = (id: number) => {
    return id.toString().padStart(3, '0');
};

// ─── 属性颜色 / 标签 ───
// 数据源在 @/constants/pokemonTypes，这里只做转发以兼容现有 import。
export { getTypeColor, typeStrs };
/** @deprecated 用 getTypeShort（@/constants/pokemonTypes） */
export const getTypeLabel = getTypeShort;
