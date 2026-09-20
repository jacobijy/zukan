/**
 * 招式伤害分类（物理 / 特殊 / 变化）单一数据源。
 *
 * 存在两套 id，**不要混用**：
 * - 规范 id（本文件，HOME `waza` 口径）：**1=物理 2=特殊 3=变化**，也是
 *   `src/static/img/waza_category/waza_0X{l,m,s}.png` 的图标编号（X = 规范 id）；
 * - PokeAPI `move_damage_classes` id（后端 bundle / i18n 名称表的键）：
 *   **1=状态(变化) 2=物理 3=特殊**。
 *
 * 数据层（`Move.damageClassId`、`MoveRecord.categoryId`、i18n `moveDamageClasses`
 * 表、资料页筛选）一律仍是 PokeAPI id；要在 UI 上用规范 id / slug / 图标时，
 * 经 `getMoveCategoryByPokeapiId()` 换算。改分类口径只动这一处。
 */

export type MoveCategorySlug = 'physical' | 'special' | 'status';

/** 图标尺寸后缀：l / m / s（对应 waza_0X 后的 L/M/S） */
export type MoveCategoryIconSize = 'l' | 'm' | 's';

export interface MoveCategory {
    /** 规范 id（HOME waza 口径）：1物理 2特殊 3变化；= waza_0X 图标编号 */
    id: 1 | 2 | 3;
    /** 稳定 slug，配色 / 计算引擎分类用 */
    slug: MoveCategorySlug;
    /** PokeAPI move_damage_classes id：物理 2 / 特殊 3 / 变化 1 */
    pokeapiId: number;
}

/** 按规范 id（物理 → 特殊 → 变化）排列，即 UI / 图标的展示顺序。 */
export const MOVE_CATEGORIES: readonly MoveCategory[] = [
    { id: 1, slug: 'physical', pokeapiId: 2 },
    { id: 2, slug: 'special', pokeapiId: 3 },
    { id: 3, slug: 'status', pokeapiId: 1 },
];

const BY_POKEAPI: Readonly<Record<number, MoveCategory>> = Object.fromEntries(
    MOVE_CATEGORIES.map((c) => [c.pokeapiId, c]),
);
const BY_SLUG: Readonly<Record<MoveCategorySlug, MoveCategory>> = Object.fromEntries(
    MOVE_CATEGORIES.map((c) => [c.slug, c]),
) as Record<MoveCategorySlug, MoveCategory>;

/** PokeAPI damageClassId → 规范分类；未知（0 等）返回 undefined。 */
export function getMoveCategoryByPokeapiId(pokeapiId: number): MoveCategory | undefined {
    return BY_POKEAPI[pokeapiId];
}

/** slug → 规范分类。 */
export function getMoveCategory(slug: MoveCategorySlug): MoveCategory {
    return BY_SLUG[slug];
}

/** 资料页分类筛选 / i18n 取名用的 PokeAPI id 顺序：物理、特殊、变化 → [2,3,1]。 */
export const MOVE_CATEGORY_POKEAPI_IDS: readonly number[] = MOVE_CATEGORIES.map((c) => c.pokeapiId);

export const WAZA_CATEGORY_ICON_BASE = '/static/img/waza_category';

/**
 * 规范分类 id → waza 分类图标的静态绝对路径：
 * `moveCategoryIconPath(1,'m')` → `/static/img/waza_category/waza_01m.png`。
 * id 越界返回 undefined（调用方自行回落）。
 */
export function moveCategoryIconPath(categoryId: number, size: MoveCategoryIconSize = 'm'): string | undefined {
    if (!MOVE_CATEGORIES.some((c) => c.id === categoryId)) return undefined;
    const num = String(categoryId).padStart(2, '0');
    return `${WAZA_CATEGORY_ICON_BASE}/waza_${num}${size}.png`;
}

/**
 * 计算引擎口径：PokeAPI damageClassId → `'physical' | 'special'`；
 * 变化（status）/ 未知（0 等）返回 null（伤害招式才进计算器）。
 */
export function damageEngineCategory(pokeapiId: number): 'physical' | 'special' | null {
    const cat = BY_POKEAPI[pokeapiId];
    if (!cat || cat.slug === 'status') return null;
    return cat.slug;
}
