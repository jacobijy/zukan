/**
 * 对战数据（使用率排行榜）类型与契约。
 *
 * 分两层：
 * - **DTO（*DTO）**：后端接口的原始 JSON 形状（snake_case）。后端就绪时按此契约返回。
 * - **UI 模型**：adapter 转换后供页面 / 组件直接消费的形状。
 *
 * 当前后端未就绪，由 `mock.ts` 产出 DTO，经 `adapter.ts` 转成 UI 模型。
 */

/** 赛制：单人 / 双人 */
export type BattleFormat = 'singles' | 'doubles';

// ── 后端 DTO 契约 ──

/** 单条使用率：species_id 为全国图鉴物种 id（默认形态）；usage_rate 为 0..1 的小数 */
export interface UsageEntryDTO {
    species_id: number;
    usage_rate: number;
}

/** 某赛季的使用率榜响应 */
export interface UsageResponseDTO {
    season_id: string;
    entries: UsageEntryDTO[];
}

/** 赛季元信息 */
export interface SeasonDTO {
    id: string;
    label: string;
    /** 是否为当前赛季 */
    is_current: boolean;
}

// ── UI 模型 ──

/** 排行行：usageRate / barWidth 均为 0..100 的百分数 */
export interface UsageRankingItem {
    speciesId: number;
    /** 使用率百分比（0..100，保留 1 位小数） */
    usageRate: number;
    /** 进度条宽度百分比，相对当前榜单最大值（榜首=100） */
    barWidth: number;
}

/** 赛季（UI） */
export interface MetaSeason {
    id: string;
    label: string;
    isCurrent: boolean;
}

// ── 宝可梦对战配置（招式 / 道具 / 特性选用率）──

/** 某类别（招式/道具/特性）的单条选用率：id 为对应 PokeAPI id */
export interface CategoryUsageEntryDTO {
    id: number;
    usage_rate: number;
}

/** 某宝可梦在某赛制 × 赛季下的配置选用率响应 */
export interface PokemonMetaResponseDTO {
    species_id: number;
    format: BattleFormat;
    season_id: string;
    abilities: CategoryUsageEntryDTO[];
    items: CategoryUsageEntryDTO[];
    moves: CategoryUsageEntryDTO[];
}

/** 类别内单条选用率（UI）：usageRate / barWidth 均为百分数 */
export interface CategoryUsageItem {
    id: number;
    usageRate: number;
    /** 进度条宽度百分比，相对该类别榜首（榜首=100） */
    barWidth: number;
}

/** 宝可梦对战配置（UI） */
export interface PokemonUsageMeta {
    speciesId: number;
    abilities: CategoryUsageItem[];
    items: CategoryUsageItem[];
    moves: CategoryUsageItem[];
}

/** 通用选用率行视图模型：name 在页面层解析，typeSlug 供招式属性图标使用 */
export interface MetaRateRowVM {
    key: number;
    name: string;
    /** 选用率百分比 */
    rate: number;
    barWidth: number;
    typeSlug?: string;
}
