import { getTypeColor, getTypeShort, typeStrs } from '@/constants/pokemonTypes';

// 格式化ID
export const padId = (id: number) => {
    return id.toString().padStart(3, '0');
};

/**
 * 展示用全国图鉴编号：非默认形态（id 10001+）也显示其本体物种编号。
 * `speciesId` 缺席（单形态/其它构造路径）时视为等于 id。
 */
export const dexNumber = (p: { id: number; speciesId?: number }): number => p.speciesId ?? p.id;

// ─── 属性颜色 / 标签 ───
// 数据源在 @/constants/pokemonTypes，这里只做转发以兼容现有 import。
export { getTypeColor, typeStrs };
/** @deprecated 用 getTypeShort（@/constants/pokemonTypes） */
export const getTypeLabel = getTypeShort;
