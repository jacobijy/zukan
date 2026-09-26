/**
 * 对战使用率数据类型（Pokémon Champions 明文 JSON，`/assets/battle/`）。
 *
 * 分两层：
 * - **原始 JSON 类型（*Json / *Row）**：上游文件的真实形状，名字段为英文引用名 / slug。
 * - **VM 类型（*VM）**：adapter + dict 处理后供页面 / 组件消费的形状。
 *
 * 字段/可用性可能随第三方源变化，解析一律容忍未知 / 缺失字段（见 data/battle-usage.md）。
 */

/** 赛制：单人 / 双人（内部小写；上游路径 / 键用大写 'Singles'/'Doubles'） */
export type BattleFormat = 'singles' | 'doubles';

// ── 原始 JSON：meta / 排行榜 / link / i18n ──

export interface BattleMetaJson {
    game: string;
    /** 当前赛季，如 'M6' */
    season: string;
    seasons: string[];
    formats: string[];
    generatedAt: string;
    /** 数据版本（构建时间戳），缓存失效键 */
    dataVersion: string;
}

export interface LeaderboardEntryJson {
    id: string;
    rank: number;
}

export interface LeaderboardJson {
    Singles: LeaderboardEntryJson[];
    Doubles: LeaderboardEntryJson[];
}

/** slug → 图鉴物种（全国图鉴 species id），可选形态 form */
export interface LinkEntry {
    id: number;
    form?: string;
}

/** i18n 字典条目：name（必需），pokemon 条目可能附 form */
export interface BattleI18nEntry {
    name: Record<string, string>;
    form?: Record<string, string>;
}

// ── 原始 JSON：单只配置 p/<格式>/<slug>.json ──

/** 招式 / 特性 / 道具行 */
export interface RateRowJson {
    rank: number;
    /** 英文引用名 */
    name: string;
    /** 使用率 / 持有率百分比（0..100，无 %） */
    pct: number;
}

/** 性格行 */
export interface NatureRowJson extends RateRowJson {
    /** 加 / 减能力的英文名 */
    up?: string;
    down?: string;
}

/** SP 加点行（Champions 用 SP 取代传统 EV，每项 0..32） */
export interface SpreadRowJson {
    rank: number;
    pct: number;
    hp: number;
    atk: number;
    def: number;
    spa: number;
    spd: number;
    spe: number;
}

/** 常见队友行（无百分比） */
export interface TeammateRowJson {
    rank: number;
    name: string;
}

export interface PokemonConfigRowsJson {
    move?: RateRowJson[];
    ability?: RateRowJson[];
    item?: RateRowJson[];
    nature?: NatureRowJson[];
    spread?: SpreadRowJson[];
    teammate?: TeammateRowJson[];
}

export interface PokemonConfigJson {
    id: string;
    /** 该精灵自身在本格式的排名 */
    rank: number;
    rows: PokemonConfigRowsJson;
}

// ── VM ──

/** 排行榜行（页面对每个 slug 解析名称 / link 后得到） */
export interface LeaderboardRowVM {
    slug: string;
    name: string;
    /** 形态名（如「阿罗拉的样子」），无则缺省 */
    form?: string;
    /** link 映射到的图鉴物种 id；查无则缺省（仍可点进配置） */
    speciesId?: number;
}

/** 选用率行（招式 / 特性 / 道具 / 性格通用） */
export interface RateRowVM {
    /** 已按当前语言翻译的名称 */
    name: string;
    pct: number;
    /** 进度条宽度 %，相对组内榜首 */
    barWidth: number;
    /** 性格行的副信息：`↑Attack ↓Sp. Atk`（已翻译） */
    detail?: string;
}

/** SP 加点行 VM */
export interface SpreadRowVM {
    pct: number;
    barWidth: number;
    hp: number;
    atk: number;
    def: number;
    spa: number;
    spd: number;
    spe: number;
}

/** 队友行 VM */
export interface TeammateRowVM {
    slug: string;
    name: string;
    speciesId?: number;
}

/** 单只配置 VM（英文名维度，页面再用 dict 翻译组装分区） */
export interface PokemonConfigVM {
    slug: string;
    rank: number;
    moves: RateRowJson[];
    abilities: RateRowJson[];
    items: RateRowJson[];
    natures: NatureRowJson[];
    spreads: SpreadRowJson[];
    teammates: TeammateRowJson[];
}
