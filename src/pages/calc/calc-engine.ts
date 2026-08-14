/**
 * 伤害计算引擎（WASM 封装层）
 *
 * JS 侧负责：
 *   1. 将用户输入（属性名、天气名等）转为枚举 ID
 *   2. 调用 WASM 的 DamageInput + calculate_damage_batch
 *   3. 格式化结果为前端可用格式
 *
 * WASM 侧负责所有修正因子计算：
 *   TypeChart、STAB、天气、场地、特性、会心、烧伤、随机
 */

import type { DamageInput, BatchDamageResult } from '@/infra/wasm/pkg/zukan_wasm';
import typeIds from '@/static/enums/types.json';
import abilitiesJson from '@/static/enums/abilities.json';
import movesJson from '@/static/enums/moves.json';
import moveFlagsJson from '@/static/enums/move_flags.json';
import weathersJson from '@/static/enums/weathers.json';
import terrainsJson from '@/static/enums/terrains.json';
import { resourceManager } from '@/services/resources/resourceManager';
import { i18n } from '@/services/i18n/ui-i18n';

/** 翻译辅助：calc-engine 在模块/非组件上下文运行，用全局 i18n 实例。 */
function te(key: string, params?: Record<string, string | number>): string {
    return params ? i18n.global.t(key, params) : i18n.global.t(key);
}

// ─── 枚举映射 ───────────────────────────────────────────

/** 招式标志位常量（与 WASM 侧 MOVE_FLAG_* 对应） */
export const MOVE_FLAG = {
    CONTACT: 1 << 0,
    PUNCH: 1 << 1,
    BITE: 1 << 2,
    SOUND: 1 << 3,
    PULSE: 1 << 4,
    POWDER: 1 << 5,
    BULLET: 1 << 6,
    HEAL: 1 << 7,
} as const;

// ─── 从 enums/*.json 派生 ID 表 ─────────────────────────

/** 属性 slug → PokemonType id（来自 types.json，pokeapi 1:1） */
const TYPE_IDS = typeIds as Record<string, number>;

/**
 * 特性 slug（无连字符）→ AbilityId
 * abilities.json 使用 `iron-fist` 形式，calc.vue 传入的是 `ironfist` 形式，
 * 这里预先归一化好，避免每次调用都 replace。
 */
const ABILITY_IDS: Record<string, number> = Object.fromEntries(
    Object.entries(abilitiesJson).map(([slug, id]) => [slug.replace(/-/g, ''), id]),
);

/**
 * 招式 slug（无连字符）→ 招式 id
 * 用于把 `firepunch` 这种归一化输入映射到 `moves.json` 里的数字 id。
 */
const MOVE_ID_BY_SLUG: Map<string, number> = new Map(
    Object.entries(movesJson).map(([slug, id]) => [slug.replace(/-/g, ''), id as number]),
);

/**
 * pokeapi flag id (1..21) → WASM 位掩码 bit
 * 与 `src/infra/wasm/src/calculator.rs` 的 `MOVE_FLAG_*` 保持同步。
 */
const WASM_FLAG_BITS: Record<string, number> = {
    contact: MOVE_FLAG.CONTACT,
    punch: MOVE_FLAG.PUNCH,
    bite: MOVE_FLAG.BITE,
    sound: MOVE_FLAG.SOUND,
    pulse: MOVE_FLAG.PULSE,
    powder: MOVE_FLAG.POWDER,
    ballistics: MOVE_FLAG.BULLET, // WASM 名为 BULLET
    heal: MOVE_FLAG.HEAL,
};
const FLAG_ID_TO_BIT: Map<number, number> = new Map(
    Object.entries(moveFlagsJson)
        .filter(([slug]) => slug in WASM_FLAG_BITS)
        .map(([slug, id]) => [id as number, WASM_FLAG_BITS[slug]]),
);

/**
 * 懒加载：moveId → WASM bitmask 索引
 * 首次调用时从 `moves_data/common.bin` 拉 `moveFlagMap`（跨 detail 页复用同一 bundle）；
 * 失败静默降级为空 map（所有招式 flags=0，特性触发缺失但不阻塞计算）。
 */
let moveFlagMaskPromise: Promise<Map<number, number>> | null = null;
function getMoveFlagMask(): Promise<Map<number, number>> {
    if (moveFlagMaskPromise) return moveFlagMaskPromise;
    moveFlagMaskPromise = (async () => {
        try {
            const bundle = await resourceManager.getMovesData('common');
            const map = new Map<number, number>();
            for (const { moveId, moveFlagId } of bundle.moveFlagMap) {
                const bit = FLAG_ID_TO_BIT.get(moveFlagId);
                if (bit) map.set(moveId, (map.get(moveId) ?? 0) | bit);
            }
            return map;
        } catch (e) {
            console.warn('[calc-engine] moveFlagMap 加载失败，特性触发降级', e);
            return new Map<number, number>();
        }
    })();
    moveFlagMaskPromise.catch(() => {
        moveFlagMaskPromise = null;
    });
    return moveFlagMaskPromise;
}

/** 招式 slug（可含空格/连字符）→ WASM bitmask；未命中或 bundle 未就绪时返回 0 */
async function lookupMoveFlags(moveName: string | undefined): Promise<number> {
    if (!moveName) return 0;
    const key = moveName.toLowerCase().replace(/[\s-]/g, '');
    const moveId = MOVE_ID_BY_SLUG.get(key);
    if (moveId === undefined) return 0;
    const mask = await getMoveFlagMask();
    return mask.get(moveId) ?? 0;
}

/** 天气 slug（无连字符）→ Weather enum ID（与 calculator.rs 的 WEATHER_* 对齐） */
const WEATHER_IDS: Record<string, number> = Object.fromEntries(
    Object.entries(weathersJson).map(([slug, id]) => [slug.replace(/-/g, ''), id as number]),
);

/** 场地 slug → Terrain enum ID（与 calculator.rs 的 TERRAIN_* 对齐） */
const TERRAIN_IDS = terrainsJson as Record<string, number>;

// ─── JS 侧查询函数 ──────────────────────────────────────

/**
 * 获取类型克制倍率（用于生成克制描述文本）
 * 返回: 0=完全免疫, 0.25, 0.5, 1, 2, 4 等
 */
function getTypeEffectiveness(
    moveType: string,
    defenderType1: string,
    defenderType2?: string,
): { multiplier: number; label: string } {
    const wasm = getWasmModule();
    if (!wasm) return { multiplier: 1, label: '—' };

    const moveTypeId = TYPE_IDS[moveType.toLowerCase()] || 0;
    const def1Id = TYPE_IDS[defenderType1.toLowerCase()] || 0;
    const def2Id = defenderType2 ? TYPE_IDS[defenderType2.toLowerCase()] || 0 : 0;

    // 使用 TypeChart 直接计算
    // 用 WASM 起算但简化：直接调用 TypeChart 查询
    const TypeChart = getTypeChart();
    if (!TypeChart) return { multiplier: 1, label: '—' };

    let mult = 1;
    for (const defId of [def1Id, def2Id]) {
        if (defId <= 0 || defId > 19) continue;
        const chartVal = TypeChart[defId]?.[moveTypeId] ?? 0;
        if (chartVal === 3) {
            mult = 0;
            break;
        } else if (chartVal === 2)
            mult *= 0.5; // 抵抗
        else if (chartVal === 1) mult *= 2; // 弱点
    }

    let label: string;
    if (mult >= 4) label = te('calc.eff.superMult', { mult });
    else if (mult === 2) label = te('calc.eff.super');
    else if (mult === 1) label = te('calc.eff.normal');
    else if (mult === 0.5) label = te('calc.eff.notVery');
    else if (mult <= 0.25) label = te('calc.eff.notVeryMult', { mult });
    else if (mult === 0) label = te('calc.eff.immune');
    else label = te('calc.eff.normal');

    return { multiplier: mult, label };
}

/**
 * 通过 WASM 计算能力值
 */
export function calcStat(base: number, level: number, isHP: boolean, iv = 31, ev = 0, natureMod = 100): number {
    const wasm = getWasmModule();
    if (!wasm) return 0;
    try {
        if (isHP) {
            return wasm.calculateHp(level, base, iv, ev);
        }
        return wasm.calculateStat(level, base, iv, ev, natureMod);
    } catch {
        return 0;
    }
}

/** 短键 → store 里 stats 数组使用的中文名 */
const STAT_LABEL_BY_KEY: Record<string, string> = {
    HP: 'HP',
    atk: '攻击',
    def: '防御',
    spa: '特攻',
    spd: '特防',
    spe: '速度',
};

/** stats 数组按短键取种族值；缺失时回落到 50（未知宝可梦的中庸值） */
export function getBaseStat(stats: { name: string; value: number }[], key: string): number {
    const label = STAT_LABEL_BY_KEY[key];
    if (!label) return 50;
    // HP 兼容 'HP' / '生命值' 等含 HP 的写法
    const found = stats.find((s) => (label === 'HP' ? s.name.includes('HP') : s.name === label));
    return found?.value ?? 50;
}

// ─── WASM 懒加载 ────────────────────────────────────────

let _wasm: any = null;
let _wasmPromise: Promise<any> | null = null;
let _typeChart: number[][] | null = null;

async function ensureWasm(): Promise<any> {
    if (_wasm) return _wasm;
    if (!_wasmPromise) {
        _wasmPromise = (async () => {
            try {
                const mod = await import('@/infra/wasm/pkg/zukan_wasm');
                await mod.default(); // 初始化 WASM
                _wasm = mod;
                return mod;
            } catch (e) {
                console.warn('[calc-engine] WASM 加载失败，计算器不可用', e);
                _wasm = null;
                return null;
            }
        })();
    }
    return _wasmPromise;
}

function getWasmModule(): any {
    return _wasm;
}

function getTypeChart(): number[][] | null {
    return _typeChart;
}

// 注入 TypeChart 数据供 JS 侧查询使用
// WASM 内部有完整 TypeChart，这里只给 getTypeEffectiveness 用
async function initTypeChart() {
    if (_typeChart) return;
    try {
        const { TypeChart } = await import('@/core/data/typechart');
        // typechart.ts 的 key 是首字母大写（Bug/Dark/…），先归一化到 lowercase 再查 TYPE_IDS。
        const chart: number[][] = Array.from({ length: 20 }, () => Array(20).fill(0));
        for (const [defName, entry] of Object.entries(TypeChart as Record<string, any>)) {
            const defId = TYPE_IDS[defName.toLowerCase()];
            if (!defId) continue;
            for (const [atkName, val] of Object.entries(entry.damageTaken || {})) {
                const atkId = TYPE_IDS[atkName.toLowerCase()];
                if (!atkId) continue;
                chart[defId][atkId] = val as number;
            }
        }
        _typeChart = chart;
    } catch {
        console.warn('[calc-engine] TypeChart 加载失败');
    }
}

// ─── 主计算接口 ─────────────────────────────────────────

export interface CalcParams {
    /* 攻击方 */
    attackerLevel: number;
    attackerAtk: number;
    attackerSpA: number;
    attackerType1: string;
    attackerType2?: string;
    attackerAbility?: string;

    /* 防御方 */
    defenderLevel: number;
    defenderDef: number;
    defenderSpD: number;
    defenderType1: string;
    defenderType2?: string;
    defenderHP?: number;
    defenderAbility?: string;

    /* 招式 */
    movePower: number;
    moveType: string;
    moveCategory: 'physical' | 'special';
    moveName?: string; // 用于查找招式标志位（接触/拳/啃咬等）

    /* 战场 */
    weather?: string | null;
    terrain?: string | null;
    critical?: boolean;
    isBurned?: boolean;
    itemMod?: number; // 100=1x

    /* 能力等级 (默认 0, 范围 -6 ~ 6) */
    attackerAtkStage?: number;
    attackerSpaStage?: number;
    defenderDefStage?: number;
    defenderSpdStage?: number;
}

export interface CalcResult {
    minDamage: number;
    maxDamage: number;
    typeEffectiveness: number;
    effectivenessLabel: string;
    stabMultiplier: number;
    weatherMultiplier: number;
    terrainMultiplier: number;
    attackerAbilityMultiplier: number;
    defenderAbilityMultiplier: number;
    criticalMultiplier: number;
    percentHP: number;
    hkoLabel: string;
}

/**
 * 执行伤害计算
 * 全部在 WASM 中完成计算
 */
export async function calcDamage(params: CalcParams): Promise<CalcResult> {
    const wasm = await ensureWasm();
    if (!wasm) {
        return {
            minDamage: 0,
            maxDamage: 0,
            typeEffectiveness: 1,
            effectivenessLabel: te('calc.wasmNotLoaded'),
            stabMultiplier: 1,
            weatherMultiplier: 1,
            terrainMultiplier: 1,
            attackerAbilityMultiplier: 1,
            defenderAbilityMultiplier: 1,
            criticalMultiplier: 1,
            percentHP: 0,
            hkoLabel: '—',
        };
    }

    // 转换参数为枚举 ID
    const moveTypeId = TYPE_IDS[params.moveType.toLowerCase()] || 0;
    const atkType1Id = TYPE_IDS[params.attackerType1?.toLowerCase()] || 0;
    const atkType2Id = TYPE_IDS[(params.attackerType2 || '').toLowerCase()] || 0;
    const defType1Id = TYPE_IDS[params.defenderType1?.toLowerCase()] || 0;
    const defType2Id = TYPE_IDS[(params.defenderType2 || '').toLowerCase()] || 0;

    const weatherId = params.weather ? WEATHER_IDS[params.weather.toLowerCase().replace(/[\s-]/g, '')] || 0 : 0;
    const terrainId = params.terrain ? TERRAIN_IDS[params.terrain.toLowerCase().replace(/[\s-]/g, '')] || 0 : 0;

    const atkAbilityId = params.attackerAbility
        ? ABILITY_IDS[params.attackerAbility.toLowerCase().replace(/[\s-]/g, '')] || 0
        : 0;
    const defAbilityId = params.defenderAbility
        ? ABILITY_IDS[params.defenderAbility.toLowerCase().replace(/[\s-]/g, '')] || 0
        : 0;

    const category = params.moveCategory === 'physical' ? 0 : 1;
    const isCritical = params.critical ? 1 : 0;
    const isBurned = params.isBurned ? 1 : 0;
    const attackStat = params.moveCategory === 'physical' ? params.attackerAtk : params.attackerSpA;
    const defenseStat = params.moveCategory === 'physical' ? params.defenderDef : params.defenderSpD;

    // 招式标志位（从 moves_data/common.bin 的 moveFlagMap 派生；首次调用触发懒加载）
    const moveFlags = await lookupMoveFlags(params.moveName);

    // 创建 WASM DamageInput
    const input = new wasm.DamageInput(
        params.attackerLevel,
        attackStat,
        defenseStat,
        params.movePower,
        moveTypeId,
        category,
        atkType1Id,
        atkType2Id,
        defType1Id,
        defType2Id,
        weatherId,
        terrainId,
        atkAbilityId,
        defAbilityId,
        isCritical,
        isBurned,
        moveFlags,
    );

    // 设置能力等级
    if (params.attackerAtkStage) input.withAttackerAtkStage(params.attackerAtkStage);
    if (params.attackerSpaStage) input.withAttackerSpaStage(params.attackerSpaStage);
    if (params.defenderDefStage) input.withDefenderDefStage(params.defenderDefStage);
    if (params.defenderSpdStage) input.withDefenderSpdStage(params.defenderSpdStage);

    // 道具修正
    if (params.itemMod !== undefined) input.withItemMod(params.itemMod);

    // 执行批量计算（16 个随机种子）
    const result: BatchDamageResult = wasm.calculateDamageBatch(input);

    const minDamage = result.min;
    const maxDamage = result.max;

    // 击杀回合
    const hp = params.defenderHP ?? 100;
    const percentHP = hp > 0 ? Math.round((maxDamage / hp) * 100) : 0;

    let hkoLabel: string;
    if (maxDamage <= 0) hkoLabel = '—';
    else if (maxDamage >= hp) hkoLabel = 'OHKO';
    else if (maxDamage * 2 >= hp) hkoLabel = '2HKO';
    else if (maxDamage * 3 >= hp) hkoLabel = '3HKO';
    else if (maxDamage * 4 >= hp) hkoLabel = '4HKO';
    else hkoLabel = '5HKO+';

    // 克制倍率描述
    let effectivenessLabel: string;
    if (minDamage === 0 && maxDamage === 0) {
        effectivenessLabel = te('calc.eff.immune');
    } else {
        // 需要克制倍率用于显示 — 从 WASM 拿不到就直接用 JS 侧
        const eff = getTypeEffectiveness(params.moveType, params.defenderType1, params.defenderType2);
        effectivenessLabel = eff.label;
    }

    return {
        minDamage,
        maxDamage,
        typeEffectiveness: minDamage === 0 ? 0 : 1,
        effectivenessLabel,
        stabMultiplier: 1,
        weatherMultiplier: 1,
        terrainMultiplier: 1,
        attackerAbilityMultiplier: 1,
        defenderAbilityMultiplier: 1,
        criticalMultiplier: isCritical ? 1.5 : 1,
        percentHP,
        hkoLabel,
    };
}

// 初始化
initTypeChart();
