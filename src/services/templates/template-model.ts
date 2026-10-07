/**
 * 个人宝可梦模板：前端拥有的 payload 模型、约束常量与纯函数。
 *
 * payload 对后端不透明（见 `docs/data/templates.md`）：后端只原样存取 JSON object，
 * 结构由前端自定义。本模块定义这些结构并做边界归一（normalize），让「老版本 / 异常输入 /
 * 更新版本客户端写入的数据」都能安全落地。
 *
 * 零平台依赖（不 import Vue / uni），可直接在 node 测试环境运行。
 * 六维键名统一 `hp / atk / def / spa / spd / spe`（PokeAPI stat id 1–6）。
 * 性格存 PokeAPI id（1..25）；编辑器内部用 WASM 的 0..24 / 0..20 编号，互转见下文。
 */
import { CHAMPION_ALIGNMENTS, NATURES } from '@/pages/statcalc/statcalc-options';

// ── 约束常量（与 docs/data/templates.md 服务端契约一致） ──────────────
export const LIMITS = {
    nameMin: 1,
    nameMax: 50,
    payloadMaxBytes: 32768, // 32 KiB
    maxTemplates: 100,
    maxMoves: 4,
    ivMax: 31,
    evPerStat: 252,
    evTotal: 510,
    spPerStat: 32,
    spTotal: 66,
} as const;

// ── 类型 ───────────────────────────────────────────────
export type Ruleset = 'standard' | 'champions';

/** 六维键名全仓统一：HP / 攻击 / 防御 / 特攻 / 特防 / 速度 */
export interface Stats {
    hp: number;
    atk: number;
    def: number;
    spa: number;
    spd: number;
    spe: number;
}

interface TemplateBase {
    ruleset: Ruleset;
    /** PokeAPI pokemon.id：默认形态=物种号，非默认形态 10000+（单字段已含形态） */
    pokemon_id: number;
    /** PokeAPI nature id（1..25）；Champions 仅 21 种 */
    nature: number;
    /** PokeAPI move id，去重保序，0..4 个 */
    moves: number[];
    /** PokeAPI item id；无对应 id 时写 null */
    item: number | null;
}

export interface StandardTemplate extends TemplateBase {
    ruleset: 'standard';
    ivs: Stats; // 各项 0..31
    evs: Stats; // 各项 0..252，六项总和 ≤510
}

export interface ChampionsTemplate extends TemplateBase {
    ruleset: 'champions';
    sp: Stats; // 各项 0..32，六项总和 ≤66
}

export type TemplatePayload = StandardTemplate | ChampionsTemplate;

// ── 六维顺序与空结构 ─────────────────────────────────────
const STAT_KEYS = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'] as const;
type StatKey = (typeof STAT_KEYS)[number];

export function emptyStats(): Stats {
    return { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
}

function baseOf(ruleset: Ruleset): { pokemon_id: number; nature: number; moves: number[]; item: null } {
    return {
        pokemon_id: 0, // 未选择宝可梦的占位；保存前必须为正整数
        nature: naturePokeIdFromInternal(0, ruleset),
        moves: [],
        item: null,
    };
}

/** 新建一份合法空 payload。pokemon_id 占位 0，保存前须选择宝可梦。 */
export function emptyTemplate(ruleset: Ruleset = 'standard'): TemplatePayload {
    if (ruleset === 'champions') {
        return { ...baseOf(ruleset), ruleset, sp: emptyStats() };
    }
    return {
        ...baseOf(ruleset),
        ruleset,
        ivs: { ...emptyStats(), hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
        evs: emptyStats(),
    };
}

// ── 性格 id 互转 ────────────────────────────────────────
// 存储统一用 PokeAPI nature id（1..25）。编辑器内部：standard 用 WASM 编号 0..24
// （NATURES 数组下标），champions 用 0..20（CHAMPION_ALIGNMENTS 数组下标，已剔除 4 个中性）。

/** 内部 id → PokeAPI id。 */
export function naturePokeIdFromInternal(internalId: number, ruleset: Ruleset): number {
    if (ruleset === 'champions') {
        return CHAMPION_ALIGNMENTS[internalId]?.pokeId ?? CHAMPION_ALIGNMENTS[0].pokeId;
    }
    return NATURES[internalId]?.pokeId ?? NATURES[0].pokeId;
}

/** PokeAPI id → 内部 id；非法（不在该规则的性格集合内）回落默认中性。 */
export function natureInternalFromPokeId(pokeId: number, ruleset: Ruleset): number {
    if (ruleset === 'champions') {
        const idx = CHAMPION_ALIGNMENTS.findIndex((a) => a.pokeId === pokeId);
        return idx >= 0 ? idx : 0;
    }
    const idx = NATURES.findIndex((n) => n.pokeId === pokeId);
    return idx >= 0 ? idx : 0;
}

/** 该规则下性格 pokeId 是否合法（champions 只允许 21 种）。 */
export function isNaturePokeIdValid(pokeId: number, ruleset: Ruleset): boolean {
    if (ruleset === 'champions') return CHAMPION_ALIGNMENTS.some((a) => a.pokeId === pokeId);
    return NATURES.some((n) => n.pokeId === pokeId);
}

/**
 * 切换规则版本：保留公共字段（宝可梦 / 性格 / 招式 / 道具），重置养成字段。
 * 性格若在新规则下非法（champions 剔除 4 个中性）则回落该规则默认中性。
 */
export function switchRuleset(payload: TemplatePayload, to: Ruleset): TemplatePayload {
    const base = {
        pokemon_id: payload.pokemon_id,
        nature: payload.nature,
        moves: [...payload.moves],
        item: payload.item,
    };
    if (!isNaturePokeIdValid(base.nature, to)) base.nature = naturePokeIdFromInternal(0, to);
    if (to === 'standard') {
        return {
            ...base,
            ruleset: 'standard',
            ivs: { ...emptyStats(), hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
            evs: emptyStats(),
        };
    }
    return { ...base, ruleset: 'champions', sp: emptyStats() };
}

// ── 纯函数：归一化 ──────────────────────────────────────
function isPosInt(n: unknown): n is number {
    return typeof n === 'number' && Number.isInteger(n) && n > 0;
}

/** 数值钳制：非整数 → 0，整数收进 [min, max]。 */
function clampTo(n: unknown, max: number): number {
    if (typeof n !== 'number' || !Number.isInteger(n)) return 0;
    return Math.max(0, Math.min(max, n));
}

/** 六维逐项 clamp；缺失 / 非法维 → 0。 */
function normalizeStats(input: unknown, max: number): Stats {
    const o = (input ?? {}) as Record<string, unknown>;
    const out = {} as Record<StatKey, number>;
    for (const key of STAT_KEYS) out[key] = clampTo(o[key], max);
    return out as Stats;
}

/** EV 六项：先逐项 clamp 并对齐 4 倍数，再把总和压回 ≤510。 */
function normalizeEvs(input: unknown): Stats {
    const o = (input ?? {}) as Record<string, unknown>;
    const stats = {} as Record<StatKey, number>;
    let total = 0;
    for (const key of STAT_KEYS) {
        const v = clampTo(o[key], LIMITS.evPerStat);
        const aligned = v - (v % 4); // EV 只在 4 的倍数上影响能力值
        stats[key] = aligned;
        total += aligned;
    }
    if (total > LIMITS.evTotal) {
        let overflow = total - LIMITS.evTotal;
        // 从末位往前逐项回收，保证前位维优先保留
        for (let i = STAT_KEYS.length - 1; i >= 0 && overflow > 0; i--) {
            const key = STAT_KEYS[i];
            const take = Math.min(stats[key], Math.ceil(overflow / 4) * 4);
            stats[key] -= take;
            overflow -= take;
        }
    }
    return stats as Stats;
}

/** SP 六项：逐项 clamp，总和压回 ≤66。 */
function normalizeSp(input: unknown): Stats {
    const o = (input ?? {}) as Record<string, unknown>;
    const stats = {} as Record<StatKey, number>;
    let total = 0;
    for (const key of STAT_KEYS) {
        const v = clampTo(o[key], LIMITS.spPerStat);
        stats[key] = v;
        total += v;
    }
    if (total > LIMITS.spTotal) {
        let overflow = total - LIMITS.spTotal;
        for (let i = STAT_KEYS.length - 1; i >= 0 && overflow > 0; i--) {
            const key = STAT_KEYS[i];
            const take = Math.min(stats[key], overflow);
            stats[key] -= take;
            overflow -= take;
        }
    }
    return stats as Stats;
}

const PAYLOAD_KNOWN_KEYS = new Set([
    'ruleset',
    'pokemon_id',
    'nature',
    'moves',
    'item',
    'ivs',
    'evs',
    'sp',
]);

/**
 * 归一化 payload。非对象 / pokemon_id 非正整数 → null（表示「未选宝可梦」，上层按草稿态处理）。
 * ruleset 非法 → standard；nature 非法 → 该规则默认中性；moves 去重保序 ≤4；item 正整数或 null；
 * 养成字段按 ruleset 归一。未知字段保留（前向兼容），已知字段以归一值覆盖。
 */
export function normalizePayload(input: unknown): TemplatePayload | null {
    if (typeof input !== 'object' || input === null) return null;
    const o = input as Record<string, unknown>;
    if (!isPosInt(o.pokemon_id)) return null;

    const ruleset: Ruleset = o.ruleset === 'champions' ? 'champions' : 'standard';
    const rawMoves = Array.isArray(o.moves) ? o.moves : [];
    const moves = [...new Set(rawMoves.filter(isPosInt))].slice(0, LIMITS.maxMoves) as number[];
    const nature = isNaturePokeIdValid(o.nature as number, ruleset) ? (o.nature as number) : naturePokeIdFromInternal(0, ruleset);
    const item = isPosInt(o.item) ? o.item : null;

    const known: Record<string, unknown> = {
        ruleset,
        pokemon_id: o.pokemon_id,
        nature,
        moves,
        item,
    };
    if (ruleset === 'standard') {
        known.ivs = normalizeStats(o.ivs, LIMITS.ivMax);
        known.evs = normalizeEvs(o.evs);
    } else {
        known.sp = normalizeSp(o.sp);
    }

    const rest: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(o)) {
        if (!PAYLOAD_KNOWN_KEYS.has(key)) rest[key] = value;
    }
    return { ...rest, ...known } as unknown as TemplatePayload;
}

// ── 纯函数：序列化 / 大小 / 校验 ─────────────────────────
/** 手写 UTF-8 字节计数（不依赖 TextEncoder，小程序 / node 皆可）；for...of 按码点迭代。 */
export function utf8ByteLength(s: string): number {
    let bytes = 0;
    for (const ch of s) {
        const cp = ch.codePointAt(0)!;
        if (cp < 0x80) bytes += 1;
        else if (cp < 0x800) bytes += 2;
        else if (cp < 0x10000) bytes += 3;
        else bytes += 4;
    }
    return bytes;
}

export function serializePayload(payload: TemplatePayload): string {
    return JSON.stringify(payload);
}

/** payload 序列化后的 UTF-8 字节数。 */
export function payloadByteSize(payload: TemplatePayload): number {
    return utf8ByteLength(serializePayload(payload));
}

export interface NameValidation {
    ok: boolean;
    trimmed: string;
    tooLong?: boolean;
}

/** 名称校验：trim 后按码点（支持多字节 / emoji）计长，1..50。 */
export function validateName(name: string): NameValidation {
    const trimmed = name.trim();
    const len = Array.from(trimmed).length;
    if (len < LIMITS.nameMin) return { ok: false, trimmed };
    if (len > LIMITS.nameMax) return { ok: false, trimmed, tooLong: true };
    return { ok: true, trimmed };
}

export interface TemplateValidation {
    ok: boolean;
    trimmedName: string;
    nameError?: 'required' | 'tooLong';
    pokemonMissing?: boolean;
    tooLarge?: boolean;
}

/** 提交前校验：宝可梦已选、名字合法、payload ≤ 32KiB。 */
export function validateTemplate(name: string, payload: TemplatePayload | null): TemplateValidation {
    if (payload === null) return { ok: false, trimmedName: name.trim(), pokemonMissing: true };
    const v = validateName(name);
    if (!v.ok) {
        return { ok: false, trimmedName: v.trimmed, nameError: v.tooLong ? 'tooLong' : 'required' };
    }
    if (payloadByteSize(payload) > LIMITS.payloadMaxBytes) {
        return { ok: false, trimmedName: v.trimmed, tooLarge: true };
    }
    return { ok: true, trimmedName: v.trimmed };
}

// 供类型导出使用
export type { StatKey };
