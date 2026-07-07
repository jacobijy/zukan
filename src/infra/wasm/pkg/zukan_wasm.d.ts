/* tslint:disable */
/* eslint-disable */

/**
 * 批量伤害计算结果
 */
export class BatchDamageResult {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    get_rolls(): Uint16Array;
    readonly average: number;
    readonly max: number;
    readonly min: number;
}

/**
 * 伤害计算输入
 */
export class DamageInput {
    free(): void;
    [Symbol.dispose](): void;
    constructor(level: number, attack: number, defense: number, base_power: number, move_type: number, move_category: number, attacker_type1: number, attacker_type2: number, defender_type1: number, defender_type2: number, weather: number, terrain: number, attacker_ability: number, defender_ability: number, is_critical: number, is_burned: number, move_flags: number);
    /**
     * 设置攻击方物攻等级
     */
    with_attacker_atk_stage(stage: number): void;
    /**
     * 设置攻击方特攻等级
     */
    with_attacker_spa_stage(stage: number): void;
    /**
     * 设置防御方物防等级
     */
    with_defender_def_stage(stage: number): void;
    /**
     * 设置防御方特防等级
     */
    with_defender_spd_stage(stage: number): void;
    with_item_mod(item_mod: number): void;
    with_seed(seed: number): void;
}

/**
 * 单次伤害计算
 */
export function calculate_damage(input: DamageInput): number;

/**
 * 批量计算所有随机值的伤害范围
 */
export function calculate_damage_batch(input: DamageInput): BatchDamageResult;

/**
 * 计算 HP 能力值
 */
export function calculate_hp(level: number, base: number, iv: number, ev: number): number;

/**
 * 获取性格修正
 * 返回 [atk, def, spa, spd, spe] 修正值 (90/100/110)
 */
export function calculate_nature_mod(nature_id: number): Uint8Array;

/**
 * 计算能力值
 */
export function calculate_stat(level: number, base: number, iv: number, ev: number, nature_mod: number): number;

/**
 * 创建新版 DamageInput 的便捷函数
 */
export function create_damage_input(level: number, attack: number, defense: number, base_power: number, move_type: number, move_category: number, attacker_type1: number, attacker_type2: number, defender_type1: number, defender_type2: number, weather: number, terrain: number, attacker_ability: number, defender_ability: number, is_critical: number, is_burned: number, move_flags: number): DamageInput;

/**
 * AES-256-GCM 解密
 */
export function decrypt(key_base64: string, ciphertext_base64: string): string;

/**
 * AES-256-GCM 加密
 */
export function encrypt(key_base64: string, plaintext: string): string;

/**
 * 生成 256 位随机密钥（Base64 编码）
 */
export function generate_key(): string;

/**
 * HMAC-SHA256 签名
 */
export function hmac_sign(key: string, data: string): string;

/**
 * HMAC-SHA256 验证
 */
export function hmac_verify(key: string, data: string, signature: string): boolean;

export function init(): void;

/**
 * SHA-256 哈希
 */
export function sha256_hash(data: string): string;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_batchdamageresult_free: (a: number, b: number) => void;
    readonly __wbg_damageinput_free: (a: number, b: number) => void;
    readonly batchdamageresult_get_rolls: (a: number) => [number, number];
    readonly batchdamageresult_max: (a: number) => number;
    readonly batchdamageresult_min: (a: number) => number;
    readonly calculate_damage: (a: number) => number;
    readonly calculate_damage_batch: (a: number) => number;
    readonly calculate_hp: (a: number, b: number, c: number, d: number) => number;
    readonly calculate_nature_mod: (a: number) => [number, number];
    readonly calculate_stat: (a: number, b: number, c: number, d: number, e: number) => number;
    readonly create_damage_input: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number, l: number, m: number, n: number, o: number, p: number, q: number) => number;
    readonly damageinput_with_attacker_atk_stage: (a: number, b: number) => void;
    readonly damageinput_with_attacker_spa_stage: (a: number, b: number) => void;
    readonly damageinput_with_defender_def_stage: (a: number, b: number) => void;
    readonly damageinput_with_defender_spd_stage: (a: number, b: number) => void;
    readonly damageinput_with_item_mod: (a: number, b: number) => void;
    readonly damageinput_with_seed: (a: number, b: number) => void;
    readonly decrypt: (a: number, b: number, c: number, d: number) => [number, number, number, number];
    readonly encrypt: (a: number, b: number, c: number, d: number) => [number, number, number, number];
    readonly generate_key: () => [number, number];
    readonly hmac_sign: (a: number, b: number, c: number, d: number) => [number, number];
    readonly hmac_verify: (a: number, b: number, c: number, d: number, e: number, f: number) => number;
    readonly init: () => void;
    readonly sha256_hash: (a: number, b: number) => [number, number];
    readonly batchdamageresult_average: (a: number) => number;
    readonly damageinput_new: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number, l: number, m: number, n: number, o: number, p: number, q: number) => number;
    readonly __wbindgen_exn_store: (a: number) => void;
    readonly __externref_table_alloc: () => number;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __externref_table_dealloc: (a: number) => void;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
