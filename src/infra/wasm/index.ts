/**
 * WASM 模块加载器
 * 封装 Rust WASM 模块的初始化和类型安全调用
 *
 * 所有函数名与 Rust 源码中 `#[wasm_bindgen(js_name = ...)]` 保持一致（camelCase）。
 */

import type { BatchDamageResult as BatchDamageResultWasm } from './pkg/zukan_wasm';

// 模块状态
let wasmModule: typeof import('./pkg/zukan_wasm') | null = null;
let initPromise: Promise<void> | null = null;

/**
 * 初始化 WASM 模块
 * 仅需调用一次，可安全重复调用
 */
export async function initWasm(): Promise<void> {
    if (wasmModule) return;
    if (initPromise) return initPromise;

    initPromise = (async () => {
        const module = await import('./pkg/zukan_wasm');
        await module.default();
        wasmModule = module;
        console.log('✅ WASM module initialized');
    })();

    return initPromise;
}

/**
 * 检查 WASM 模块是否已初始化
 */
export function isWasmReady(): boolean {
    return wasmModule !== null;
}

// ============== 图鉴二进制文件加解密 API ==============

export function decryptZukan(encryptedData: Uint8Array, dekHex: string): Uint8Array {
    assertWasmReady();
    return wasmModule!.decryptZukan(encryptedData, dekHex) as unknown as Uint8Array;
}

export function encryptZukan(plaintext: Uint8Array, dekHex: string, version: number): Uint8Array {
    assertWasmReady();
    return wasmModule!.encryptZukan(plaintext, dekHex, version) as unknown as Uint8Array;
}

export function isValidZukanFile(data: Uint8Array): boolean {
    assertWasmReady();
    return wasmModule!.isValidZukanFile(data);
}

export function getZukanVersion(data: Uint8Array): number {
    assertWasmReady();
    return wasmModule!.getZukanVersion(data);
}

// ============== 通用密码学工具 API ==============

export function generateKey(): string {
    assertWasmReady();
    return wasmModule!.generateKey();
}

export function sha256(data: string): string {
    assertWasmReady();
    return wasmModule!.sha256(data);
}

export function hmacSign(key: string, data: string): string {
    assertWasmReady();
    return wasmModule!.hmacSign(key, data);
}

export function hmacVerify(key: string, data: string, signature: string): boolean {
    assertWasmReady();
    return wasmModule!.hmacVerify(key, data, signature);
}

// ============== 伤害计算器 API ==============

/** 招式标志位常量（位掩码） */
export const MOVE_FLAG = {
    CONTACT: 1 << 0, // 接触类
    PUNCH: 1 << 1, // 拳类
    BITE: 1 << 2, // 啃咬类
    SOUND: 1 << 3, // 声音类
    PULSE: 1 << 4, // 波动类
    POWDER: 1 << 5, // 粉末类
    BULLET: 1 << 6, // 子弹类
    HEAL: 1 << 7, // 回复类
} as const;

/**
 * 伤害计算输入参数（新版）
 * 所有修正因子在 WASM 内部计算
 */
export interface DamageInput {
    level: number;
    attack: number;
    defense: number;
    basePower: number;
    moveType: number; // PokemonType enum (1-19)
    moveCategory: number; // 0=Physical, 1=Special
    attackerType1: number; // PokemonType (0=无)
    attackerType2: number; // PokemonType (0=无)
    defenderType1: number; // PokemonType (0=无)
    defenderType2: number; // PokemonType (0=无)
    weather: number; // Weather enum (0-8)
    terrain: number; // Terrain enum (0-4)
    attackerAbility: number; // AbilityId (0=无)
    defenderAbility: number; // AbilityId (0=无)
    isCritical: number; // 0 or 1 (是否会心一击)
    isBurned: number; // 0 or 1 (是否烧伤)
    moveFlags: number; // MOVE_FLAG 位掩码组合
    /** 能力等级: 攻击方物攻 (-6 ~ 6) */
    attackerAtkStage?: number;
    /** 能力等级: 攻击方特攻 (-6 ~ 6) */
    attackerSpaStage?: number;
    /** 能力等级: 防御方物防 (-6 ~ 6) */
    defenderDefStage?: number;
    /** 能力等级: 防御方特防 (-6 ~ 6) */
    defenderSpdStage?: number;
    itemMod?: number; // 100=1x
    seed?: number; // 随机种子 0-15
}

export interface BatchDamageResult {
    min: number;
    max: number;
    average: number;
    rolls: number[];
}

/**
 * 计算单次伤害
 * 所有修正因子（类型克制、STAB、天气、场地、特性等）均在 WASM 内部计算
 */
export function calculateDamage(input: DamageInput): number {
    assertWasmReady();
    const wasmInput = new wasmModule!.DamageInput(
        input.level,
        input.attack,
        input.defense,
        input.basePower,
        input.moveType,
        input.moveCategory,
        input.attackerType1,
        input.attackerType2,
        input.defenderType1,
        input.defenderType2,
        input.weather,
        input.terrain,
        input.attackerAbility,
        input.defenderAbility,
        input.isCritical,
        input.isBurned,
        input.moveFlags,
    );

    if (input.itemMod !== undefined) {
        wasmInput.withItemMod(input.itemMod);
    }

    return wasmModule!.calculateDamage(wasmInput);
}

/**
 * 批量计算伤害范围（所有随机值 85%-100%）
 * 所有修正因子（类型克制、STAB、天气、场地、特性等）均在 WASM 内部计算
 */
export function calculateDamageBatch(input: DamageInput): BatchDamageResult {
    assertWasmReady();
    const wasmInput = new wasmModule!.DamageInput(
        input.level,
        input.attack,
        input.defense,
        input.basePower,
        input.moveType,
        input.moveCategory,
        input.attackerType1,
        input.attackerType2,
        input.defenderType1,
        input.defenderType2,
        input.weather,
        input.terrain,
        input.attackerAbility,
        input.defenderAbility,
        input.isCritical,
        input.isBurned,
        input.moveFlags,
    );

    if (input.itemMod !== undefined) {
        wasmInput.withItemMod(input.itemMod);
    }

    // 设置能力等级
    if (input.attackerAtkStage) wasmInput.withAttackerAtkStage(input.attackerAtkStage);
    if (input.attackerSpaStage) wasmInput.withAttackerSpaStage(input.attackerSpaStage);
    if (input.defenderDefStage) wasmInput.withDefenderDefStage(input.defenderDefStage);
    if (input.defenderSpdStage) wasmInput.withDefenderSpdStage(input.defenderSpdStage);

    const result = wasmModule!.calculateDamageBatch(wasmInput) as BatchDamageResultWasm;
    const rolls = Array.from(result.getRolls());
    return {
        min: result.min,
        max: result.max,
        average: result.average,
        rolls,
    };
}

/**
 * 计算能力值
 */
export function calculateStat(level: number, base: number, iv: number, ev: number, natureMod: number): number {
    assertWasmReady();
    return wasmModule!.calculateStat(level, base, iv, ev, natureMod);
}

/**
 * 计算 HP 能力值
 */
export function calculateHp(level: number, base: number, iv: number, ev: number): number {
    assertWasmReady();
    return wasmModule!.calculateHp(level, base, iv, ev);
}

/**
 * 获取性格修正
 * 返回 [atk, def, spa, spd, spe] 修正值 (90/100/110)
 */
export function getNatureMod(natureId: number): [number, number, number, number, number] {
    assertWasmReady();
    const result = wasmModule!.calculateNatureMod(natureId) as Uint8Array;
    return [result[0], result[1], result[2], result[3], result[4]];
}

// ============== 工具函数 ==============

function assertWasmReady(): void {
    if (!wasmModule) {
        throw new Error('WASM module not initialized. Call initWasm() first.');
    }
}

// ============== FlatBuffers 解码 API ==============
//
// 类型全部由 Rust 侧 tsify-next 派生，从 `pkg/zukan_wasm.d.ts` 转出：
// 保证 Rust owned struct、字段名、有符号语义（`genderRate/priority/…`）
// 与 dts 天然对齐，Schema 变更时只需改 `src/fb/convert.rs` 一处。

export type {
    // Root bundles
    PokemonGenBundle,
    PokemonVgMovesBundle,
    PokemonMovesBundle,
    MovesDataBundle,
    I18nNamesBundle,
    I18nFlavorBundle,
    EvolutionBundle,
    // PKMB 表行
    PokemonBase,
    PokemonStat,
    PokemonType,
    PokemonAbility,
    PokemonEggGroup,
    // EVO1 进化树
    EvolutionSpecies,
    EvolutionEdge,
    EvolutionDetail,
    // PMOV / PMSB
    PokemonMove,
    PokemonMoveSet,
    LevelMove,
    // MDAT
    Move,
    MoveMeta,
    MoveMetaStatChange,
    MoveFlagPair,
    // PKNM 名称组
    NamedTextEntry,
    SoloTextEntry,
    ProseTextEntry,
    SpeciesName,
    FormName,
    LocationName,
    ShapeEntry,
    // PKFL 描述组（字符串池已解析为内联字符串）
    FlavorText,
    ProseEffect,
} from './pkg/zukan_wasm';

// 为下方 wrapper 单独 import 类型
import type {
    PokemonGenBundle,
    PokemonVgMovesBundle,
    PokemonMovesBundle,
    MovesDataBundle,
    I18nNamesBundle,
    I18nFlavorBundle,
    EvolutionBundle,
} from './pkg/zukan_wasm';

/**
 * 解码 `gen-N.bin` (fid = `PKMB`) —— 宝可梦基础参数（按世代打包）
 * @throws 若 buffer 不以 `PKMB` identifier 起始或解析失败
 */
export function decodePokemonGenBundle(data: Uint8Array): PokemonGenBundle {
    assertWasmReady();
    return wasmModule!.decodePokemonGenBundle(data);
}

/**
 * 解码 `moves/vg-XX.bin` (fid = `PMOV`) —— 招式学习记录（原始行式，无损）
 */
export function decodePokemonVgMovesBundle(data: Uint8Array): PokemonVgMovesBundle {
    assertWasmReady();
    return wasmModule!.decodePokemonVgMovesBundle(data);
}

/**
 * 解码 `pokemon_moves/{common,mainline/vg-XX,special/vg-XX}.bin` (fid = `PMSB`)
 * —— 招式学习记录（按宝可梦聚合）。合并读取时先看 `kind`：
 * - `0 (COMMON)` = baseline，全字段填充
 * - `1 (MAINLINE_DIFF)` = 相对 common 变化的整行覆盖
 * - `2 (SPECIAL_FULL)` = 独立表（不合并 common）
 */
export function decodePokemonMovesBundle(data: Uint8Array): PokemonMovesBundle {
    assertWasmReady();
    return wasmModule!.decodePokemonMovesBundle(data);
}

/**
 * 解码 `moves_data/{common,vg-XX}.bin` (fid = `MDAT`) —— 招式定义。
 * common baseline 五张表都填；vg-XX 只有 `moves` 覆写，其余 4 个数组为空。
 */
export function decodeMovesDataBundle(data: Uint8Array): MovesDataBundle {
    assertWasmReady();
    return wasmModule!.decodeMovesDataBundle(data);
}

/**
 * 解码 `i18n/<lang>/names.bin` (fid = `PKNM`) —— 单语言名称组。
 * 含物种名、技能名、属性名、形态名、地点名等 33 张短文本表。
 */
export function decodeI18nNamesBundle(data: Uint8Array): I18nNamesBundle {
    assertWasmReady();
    return wasmModule!.decodeI18nNamesBundle(data);
}

/**
 * 解码 `i18n/<lang>/flavor.bin` (fid = `PKFL`) —— 单语言描述组。
 * 传输层的字符串池（text_pool）在 Rust 解码时解析为内联字符串，
 * 调用方直接读 `FlavorText.text` / `ProseEffect.effect` 即可。
 */
export function decodeI18nFlavorBundle(data: Uint8Array): I18nFlavorBundle {
    assertWasmReady();
    return wasmModule!.decodeI18nFlavorBundle(data);
}

/**
 * 解码 `evolution.bin` (fid = `EVO1`) —— 全代进化树。
 * 三张定长 struct 数组（species/edges/details），全部按下标寻址。
 * 注意：旧后端可能尚未产出该文件（下载 404），调用方应静默降级为空进化链。
 */
export function decodeEvolutionBundle(data: Uint8Array): EvolutionBundle {
    assertWasmReady();
    return wasmModule!.decodeEvolutionBundle(data);
}
