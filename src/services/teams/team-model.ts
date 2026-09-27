/**
 * 自建队伍：前端拥有的 payload 模型、约束常量与纯函数。
 *
 * payload 对后端不透明（见 `docs/data/teams.md`）：后端只原样存取 JSON object，
 * 成员 / 招式等结构由前端自定义。本模块定义这些结构并做边界归一（normalize），
 * 让“老版本 / 异常输入 / 更新版本客户端写入的数据”都能安全落地。
 *
 * 零平台依赖（不 import Vue / uni），可直接在 node 测试环境运行。
 * 性格合法 slug 复用《能力值计算器》里经核对的单一数据源 CHAMPION_ALIGNMENTS。
 */
import { CHAMPION_ALIGNMENTS } from '@/pages/statcalc/statcalc-options';

// ── 约束常量（与 docs/data/teams.md 服务端契约一致） ──────────────
export const LIMITS = {
    nameMin: 1,
    nameMax: 50,
    payloadMaxBytes: 32768, // 32 KiB
    maxTeams: 100,
    maxMembers: 6,
    maxMoves: 4,
    spMin: 0,
    spMax: 32,
} as const;

// ── 类型 ───────────────────────────────────────────────
export type TeamFormat = 'singles' | 'doubles';

/** SP 加点（Champions 用 SP 取代传统 EV，每项 0..32） */
export interface TeamSpread {
    hp: number;
    atk: number;
    def: number;
    spa: number;
    spd: number;
    spe: number;
}

/** 队伍成员；id 一律存稳定标识，展示名在渲染层解析 */
export interface TeamMember {
    /** PokeAPI species / 全国图鉴 species id（必填） */
    species_id: number;
    /** 具体形态 form id；缺省 = 默认形态 */
    form_id?: number;
    ability_id?: number;
    item_id?: number;
    /** Champions Stat Alignment slug（跨语言稳定） */
    nature: string;
    /** PokeAPI move id，去重保序，≤4 */
    moves: number[];
    spread: TeamSpread;
}

export interface TeamPayload {
    format: TeamFormat;
    members: TeamMember[];
}

// ── 性格 ───────────────────────────────────────────────
/** 默认性格：Serious（Champions 唯一中性） */
export const DEFAULT_NATURE = 'serious';
const NATURE_SLUGS = new Set(CHAMPION_ALIGNMENTS.map((a) => a.slug));

// ── 空结构构造 ─────────────────────────────────────────
export function emptySpread(): TeamSpread {
    return { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
}

export function emptyMember(speciesId: number, formId?: number): TeamMember {
    const member: TeamMember = {
        species_id: speciesId,
        nature: DEFAULT_NATURE,
        moves: [],
        spread: emptySpread(),
    };
    if (formId) member.form_id = formId;
    return member;
}

export function emptyPayload(format: TeamFormat = 'singles'): TeamPayload {
    return { format, members: [] };
}

// ── 纯函数：归一化 ──────────────────────────────────────
function isPosInt(n: unknown): n is number {
    return typeof n === 'number' && Number.isInteger(n) && n > 0;
}

/** 单项 SP：整数且在 0..32 内保留，其余（非整数 / 越界 / 缺失）收进边界。 */
export function clampSp(n: unknown): number {
    if (typeof n !== 'number' || !Number.isInteger(n)) return 0;
    return Math.max(LIMITS.spMin, Math.min(LIMITS.spMax, n));
}

/** 归一化 SP：六维逐个 clamp。SP 维度固定，不透传额外字段。 */
export function normalizeSpread(input: unknown): TeamSpread {
    const o = (input ?? {}) as Record<string, unknown>;
    return {
        hp: clampSp(o.hp),
        atk: clampSp(o.atk),
        def: clampSp(o.def),
        spa: clampSp(o.spa),
        spd: clampSp(o.spd),
        spe: clampSp(o.spe),
    };
}

/**
 * 归一化单个成员。
 * species_id 非正整数 → 返回 null（上层过滤）；form/ability/item 非正则剔除；
 * moves 滤正整数 → 按 id 去重保序 → slice(0,4)；nature 非法 → serious。
 * 未知字段保留（前向兼容更新版本客户端），已知字段以归一值覆盖。
 */
const MEMBER_KNOWN_KEYS = new Set(['species_id', 'form_id', 'ability_id', 'item_id', 'nature', 'moves', 'spread']);

export function normalizeMember(input: unknown): TeamMember | null {
    if (typeof input !== 'object' || input === null) return null;
    const o = input as Record<string, unknown>;
    if (!isPosInt(o.species_id)) return null;

    // form_id 仅正整数且 ≠ species_id 时保留（默认形态不写 form_id）
    const formId = isPosInt(o.form_id) && o.form_id !== o.species_id ? o.form_id : undefined;
    const rawMoves = Array.isArray(o.moves) ? o.moves : [];
    const moves = [...new Set(rawMoves.filter(isPosInt))].slice(0, LIMITS.maxMoves) as number[];
    const nature = typeof o.nature === 'string' && NATURE_SLUGS.has(o.nature) ? o.nature : DEFAULT_NATURE;

    const known: Record<string, unknown> = {
        species_id: o.species_id,
        nature,
        moves,
        spread: normalizeSpread(o.spread),
    };
    if (formId !== undefined) known.form_id = formId;
    if (isPosInt(o.ability_id)) known.ability_id = o.ability_id;
    if (isPosInt(o.item_id)) known.item_id = o.item_id;

    // 只透传“未知字段”；已知键即使非法也不随 ...o 残留（统一由 known 决定去留）
    const rest: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(o)) {
        if (!MEMBER_KNOWN_KEYS.has(key)) rest[key] = value;
    }
    return { ...rest, ...known } as unknown as TeamMember;
}

/**
 * 归一化整个 payload。非对象 → 空 payload；format 非法 → singles；
 * members 逐个 normalize 后滤掉 null 并 slice(0,6)；未知顶层字段保留。
 */
export function normalizePayload(input: unknown): TeamPayload {
    if (typeof input !== 'object' || input === null) return emptyPayload();
    const o = input as Record<string, unknown>;

    const format: TeamFormat = o.format === 'doubles' ? 'doubles' : 'singles';
    const rawMembers = Array.isArray(o.members) ? o.members : [];
    const members = rawMembers
        .map(normalizeMember)
        .filter((m): m is TeamMember => m !== null)
        .slice(0, LIMITS.maxMembers);

    return { ...o, format, members } as TeamPayload;
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

export function serializePayload(payload: TeamPayload): string {
    return JSON.stringify(payload);
}

/** payload 序列化后的 UTF-8 字节数。 */
export function payloadByteSize(payload: TeamPayload): number {
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

export interface TeamValidation {
    ok: boolean;
    trimmedName: string;
    nameError?: 'required' | 'tooLong';
    tooLarge?: boolean;
}

/** 提交前校验：名字合法且 payload ≤ 32KiB。 */
export function validateTeam(name: string, payload: TeamPayload): TeamValidation {
    const v = validateName(name);
    if (!v.ok) {
        return { ok: false, trimmedName: v.trimmed, nameError: v.tooLong ? 'tooLong' : 'required' };
    }
    if (payloadByteSize(payload) > LIMITS.payloadMaxBytes) {
        return { ok: false, trimmedName: v.trimmed, tooLarge: true };
    }
    return { ok: true, trimmedName: v.trimmed };
}
