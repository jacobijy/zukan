/**
 * WASM 模块加载器
 * 封装 Rust WASM 模块的初始化和类型安全调用
 */

import type {
  DamageInput as DamageInputWasm,
  BatchDamageResult as BatchDamageResultWasm,
} from './pkg/zukan_wasm';

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

/**
 * 解密图鉴加密二进制数据
 * 文件格式：[magic(4B)="ZKDX"] [version(1B)] [nonce(12B)] [ciphertext(...)] [tag(16B)]
 *
 * @param encryptedData 加密的二进制数据
 * @param dekHex 32 字节 DEK 密钥的 hex 字符串
 * @returns 解密后的明文数据
 */
export function decryptZukan(encryptedData: Uint8Array, dekHex: string): Uint8Array {
  assertWasmReady();
  return wasmModule!.decrypt_zukan(encryptedData, dekHex);
}

/**
 * 加密图鉴数据
 *
 * @param plaintext 明文数据
 * @param dekHex 32 字节 DEK 密钥的 hex 字符串
 * @param version 密钥版本号
 * @returns 完整的加密二进制数据（含文件头）
 */
export function encryptZukan(plaintext: Uint8Array, dekHex: string, version: number): Uint8Array {
  assertWasmReady();
  return wasmModule!.encrypt_zukan(plaintext, dekHex, version);
}

/**
 * 校验文件是否为合法的图鉴加密文件格式
 */
export function isValidZukanFile(data: Uint8Array): boolean {
  assertWasmReady();
  return wasmModule!.is_valid_zukan_file(data);
}

/**
 * 获取文件的密钥版本号
 */
export function getZukanVersion(data: Uint8Array): number {
  assertWasmReady();
  return wasmModule!.get_zukan_version(data);
}

// ============== 通用密码学工具 API ==============

/**
 * 生成 AES-256-GCM 随机密钥 (Hex 编码)
 */
export function generateKey(): string {
  assertWasmReady();
  return wasmModule!.generate_key();
}

/**
 * SHA-256 哈希
 */
export function sha256(data: string): string {
  assertWasmReady();
  return wasmModule!.sha256_hash(data);
}

/**
 * HMAC-SHA256 签名
 */
export function hmacSign(key: string, data: string): string {
  assertWasmReady();
  return wasmModule!.hmac_sign(key, data);
}

/**
 * HMAC-SHA256 验证
 */
export function hmacVerify(key: string, data: string, signature: string): boolean {
  assertWasmReady();
  return wasmModule!.hmac_verify(key, data, signature);
}

// ============== 伤害计算器 API ==============

/** 招式标志位常量（位掩码） */
export const MOVE_FLAG = {
  CONTACT: 1 << 0,  // 接触类
  PUNCH: 1 << 1,    // 拳类
  BITE: 1 << 2,     // 啃咬类
  SOUND: 1 << 3,    // 声音类
  PULSE: 1 << 4,    // 波动类
  POWDER: 1 << 5,   // 粉末类
  BULLET: 1 << 6,   // 子弹类
  HEAL: 1 << 7,     // 回复类
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
  moveType: number;           // PokemonType enum (1-19)
  moveCategory: number;       // 0=Physical, 1=Special
  attackerType1: number;      // PokemonType (0=无)
  attackerType2: number;      // PokemonType (0=无)
  defenderType1: number;      // PokemonType (0=无)
  defenderType2: number;      // PokemonType (0=无)
  weather: number;            // Weather enum (0-8)
  terrain: number;            // Terrain enum (0-4)
  attackerAbility: number;    // AbilityId (0=无)
  defenderAbility: number;    // AbilityId (0=无)
  isCritical: number;         // 0 or 1 (是否会心一击)
  isBurned: number;           // 0 or 1 (是否烧伤)
  moveFlags: number;          // MOVE_FLAG 位掩码组合
  /** 能力等级: 攻击方物攻 (-6 ~ 6) */
  attackerAtkStage?: number;
  /** 能力等级: 攻击方特攻 (-6 ~ 6) */
  attackerSpaStage?: number;
  /** 能力等级: 防御方物防 (-6 ~ 6) */
  defenderDefStage?: number;
  /** 能力等级: 防御方特防 (-6 ~ 6) */
  defenderSpdStage?: number;
  itemMod?: number;           // 100=1x
  seed?: number;              // 随机种子 0-15
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
    wasmInput.with_item_mod(input.itemMod);
  }

  return wasmModule!.calculate_damage(wasmInput);
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
    wasmInput.with_item_mod(input.itemMod);
  }

  // 设置能力等级
  if (input.attackerAtkStage) wasmInput.with_attacker_atk_stage(input.attackerAtkStage);
  if (input.attackerSpaStage) wasmInput.with_attacker_spa_stage(input.attackerSpaStage);
  if (input.defenderDefStage) wasmInput.with_defender_def_stage(input.defenderDefStage);
  if (input.defenderSpdStage) wasmInput.with_defender_spd_stage(input.defenderSpdStage);

  const result = wasmModule!.calculate_damage_batch(wasmInput) as BatchDamageResultWasm;
  // get_rolls() 新版无参数，直接返回 Uint16Array
  const rolls = Array.from(result.get_rolls());
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
export function calculateStat(
  level: number,
  base: number,
  iv: number,
  ev: number,
  natureMod: number,
): number {
  assertWasmReady();
  return wasmModule!.calculate_stat(level, base, iv, ev, natureMod);
}

/**
 * 计算 HP 能力值
 */
export function calculateHp(
  level: number,
  base: number,
  iv: number,
  ev: number,
): number {
  assertWasmReady();
  return wasmModule!.calculate_hp(level, base, iv, ev);
}

/**
 * 获取性格修正
 * 返回 [atk, def, spa, spd, spe] 修正值 (90/100/110)
 */
export function getNatureMod(natureId: number): [number, number, number, number, number] {
  assertWasmReady();
  const result = wasmModule!.calculate_nature_mod(natureId) as Uint8Array;
  return [result[0], result[1], result[2], result[3], result[4]];
}

// ============== 工具函数 ==============

function assertWasmReady(): asserts this is { wasmModule: NonNullable<typeof wasmModule> } {
  if (!wasmModule) {
    throw new Error('WASM module not initialized. Call initWasm() first.');
  }
}

// 导出所有类型供外部使用
export type { DamageInputWasm, BatchDamageResultWasm };