/**
 * 世代号段单一数据源。
 *
 * 曾经在 index.vue 里存了两份：一份带 range 显示串给抽屉用，
 * 一份 genRanges 数组给筛选用。改一个号段要动两处——收敛到此。
 */

export interface Generation {
    /** 筛选用 key：'gen1' */
    value: string;
    /** 罗马数字标记：'I' */
    label: string;
    /** 显示名：'第一世代' */
    name: string;
    /** 全国编号起（含） */
    start: number;
    /** 全国编号止（含） */
    end: number;
}

export const GENERATIONS: Generation[] = [
    { value: 'gen1', label: 'I', name: '第一世代', start: 1, end: 151 },
    { value: 'gen2', label: 'II', name: '第二世代', start: 152, end: 251 },
    { value: 'gen3', label: 'III', name: '第三世代', start: 252, end: 386 },
    { value: 'gen4', label: 'IV', name: '第四世代', start: 387, end: 493 },
    { value: 'gen5', label: 'V', name: '第五世代', start: 494, end: 649 },
    { value: 'gen6', label: 'VI', name: '第六世代', start: 650, end: 721 },
    { value: 'gen7', label: 'VII', name: '第七世代', start: 722, end: 809 },
    { value: 'gen8', label: 'VIII', name: '第八世代', start: 810, end: 905 },
    { value: 'gen9', label: 'IX', name: '第九世代', start: 906, end: 1010 },
];

/** 抽屉里显示的号段串：'#001 - #151' */
export const formatGenerationRange = (gen: Generation) =>
    `#${String(gen.start).padStart(3, '0')} - #${String(gen.end).padStart(3, '0')}`;

/** 按 value 取世代；未命中返回 undefined */
export const findGeneration = (value: string | null) =>
    value ? GENERATIONS.find(g => g.value === value) : undefined;

/** 该 id 是否落在指定世代号段内 */
export const isInGeneration = (id: number, value: string | null): boolean => {
    const gen = findGeneration(value);
    if (!gen) return true;
    return id >= gen.start && id <= gen.end;
};
