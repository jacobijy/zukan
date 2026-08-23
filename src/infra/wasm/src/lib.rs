//! 图鉴 WASM 模块
//! 提供图鉴二进制文件加解密（AES-256-GCM）、通用密码学工具、伤害计算，以及
//! FlatBuffers 数据（宝可梦基础参数 / 招式记录 / 招式定义 / 多语言文本）解码

use wasm_bindgen::prelude::*;

// 加密解密模块
pub mod crypto;
// 伤害计算模块
pub mod calculator;
// FlatBuffers 解码
pub mod fb;

use calculator::{DamageInput, BatchDamageResult};

// WASM 初始化
#[wasm_bindgen(start)]
pub fn init() {
    // 启用 panic 钩子用于调试
    #[cfg(feature = "console_error_panic_hook")]
    console_error_panic_hook::set_once();
}

// ============== 图鉴二进制文件加解密 API ==============

/// 解密图鉴加密二进制数据
#[wasm_bindgen(js_name = decryptZukan)]
pub fn decrypt_zukan(encrypted_data: &[u8], dek_hex: &str) -> Result<Vec<u8>, JsValue> {
    crypto::decrypt_zukan(encrypted_data, dek_hex)
}

/// 加密图鉴数据
#[wasm_bindgen(js_name = encryptZukan)]
pub fn encrypt_zukan(plaintext: &[u8], dek_hex: &str, version: u8) -> Result<Vec<u8>, JsValue> {
    crypto::encrypt_zukan(plaintext, dek_hex, version)
}

/// 校验文件是否为合法的图鉴加密文件格式
#[wasm_bindgen(js_name = isValidZukanFile)]
pub fn is_valid_zukan_file(data: &[u8]) -> bool {
    crypto::is_valid_zukan_file(data)
}

/// 获取文件的密钥版本号
#[wasm_bindgen(js_name = getZukanVersion)]
pub fn get_zukan_version(data: &[u8]) -> u8 {
    crypto::get_zukan_version(data)
}

// ============== 通用密码学工具 API ==============

/// 生成 256 位随机密钥（Hex 编码）
#[wasm_bindgen(js_name = generateKey)]
pub fn generate_key() -> String {
    crypto::generate_key()
}

/// SHA-256 哈希
#[wasm_bindgen(js_name = sha256)]
pub fn sha256_hash(data: &str) -> String {
    crypto::sha256_hash(data)
}

/// HMAC-SHA256 签名
#[wasm_bindgen(js_name = hmacSign)]
pub fn hmac_sign(key: &str, data: &str) -> String {
    crypto::hmac_sign(key, data)
}

/// HMAC-SHA256 验证
#[wasm_bindgen(js_name = hmacVerify)]
pub fn hmac_verify(key: &str, data: &str, signature: &str) -> bool {
    crypto::hmac_verify(key, data, signature)
}

// ============== 伤害计算器 API ==============
// 类型在 calculator.rs 中已标注 #[wasm_bindgen]，无需再导出

/// 单次伤害计算
#[wasm_bindgen(js_name = calculateDamage)]
pub fn calculate_damage(input: &DamageInput) -> u16 {
    calculator::calculate_damage(input)
}

/// 批量计算所有随机值的伤害范围
#[wasm_bindgen(js_name = calculateDamageBatch)]
pub fn calculate_damage_batch(input: &DamageInput) -> BatchDamageResult {
    calculator::calculate_damage_batch(input)
}

/// 计算能力值
#[wasm_bindgen(js_name = calculateStat)]
pub fn calculate_stat(level: u8, base: u16, iv: u8, ev: u8, nature_mod: u8) -> u16 {
    calculator::calculate_stat(level, base, iv, ev, nature_mod)
}

/// 计算 HP 能力值
#[wasm_bindgen(js_name = calculateHp)]
pub fn calculate_hp(level: u8, base: u16, iv: u8, ev: u8) -> u16 {
    calculator::calculate_hp(level, base, iv, ev)
}

/// 获取性格修正
/// 返回 [atk, def, spa, spd, spe] 修正值 (90/100/110)
#[wasm_bindgen(js_name = calculateNatureMod)]
pub fn calculate_nature_mod(nature_id: u8) -> Vec<u8> {
    calculator::calculate_nature_mod(nature_id).to_vec()
}

// ============== 批量计算包装（与新版 DamageInput 兼容） ==============

/// 创建新版 DamageInput 的便捷函数
#[wasm_bindgen(js_name = createDamageInput)]
pub fn create_damage_input(
    level: u8,
    attack: u16,
    defense: u16,
    base_power: u8,
    move_type: u8,
    move_category: u8,
    attacker_type1: u8,
    attacker_type2: u8,
    defender_type1: u8,
    defender_type2: u8,
    weather: u8,
    terrain: u8,
    attacker_ability: u16,
    defender_ability: u16,
    is_critical: u8,
    is_burned: u8,
    move_flags: u16,
) -> DamageInput {
    DamageInput::new(
        level, attack, defense, base_power,
        move_type, move_category,
        attacker_type1, attacker_type2,
        defender_type1, defender_type2,
        weather, terrain,
        attacker_ability, defender_ability,
        is_critical, is_burned, move_flags,
    )
}

// ============== FlatBuffers 解码 API ==============
//
// 每个 decode 函数吃一段 FB 二进制（`assets/fb/*.bin`），校验 file_identifier 后
// 返回结构化对象。返回类型通过 tsify-next 派生自动映射到 `.d.ts`：
// `decodePokemonGenBundle(data: Uint8Array): PokemonGenBundle`（而非 `any`）。
// 字段类型/命名对齐 `assets/fb/README.md` §Field Reference。

use fb::convert::{
    EvolutionBundle, I18nFlavorBundle, I18nNamesBundle, MovesDataBundle, PokemonGenBundle,
    PokemonMovesBundle, PokemonVgMovesBundle,
};

/// 解码 `PokemonGenBundle` (fid = `PKMB`) —— 宝可梦基础参数（按世代打包）
#[wasm_bindgen(js_name = decodePokemonGenBundle)]
pub fn decode_pokemon_gen_bundle(data: &[u8]) -> Result<PokemonGenBundle, JsValue> {
    Ok(fb::decode::decode_pokemon_gen_bundle(data)?)
}

/// 解码 `PokemonVgMovesBundle` (fid = `PMOV`) —— 招式学习记录（原始行式）
#[wasm_bindgen(js_name = decodePokemonVgMovesBundle)]
pub fn decode_pokemon_vg_moves_bundle(data: &[u8]) -> Result<PokemonVgMovesBundle, JsValue> {
    Ok(fb::decode::decode_pokemon_vg_moves_bundle(data)?)
}

/// 解码 `PokemonMovesBundle` (fid = `PMSB`) —— 招式学习记录（按宝可梦聚合）
#[wasm_bindgen(js_name = decodePokemonMovesBundle)]
pub fn decode_pokemon_moves_bundle(data: &[u8]) -> Result<PokemonMovesBundle, JsValue> {
    Ok(fb::decode::decode_pokemon_moves_bundle(data)?)
}

/// 解码 `MovesDataBundle` (fid = `MDAT`) —— 招式定义
#[wasm_bindgen(js_name = decodeMovesDataBundle)]
pub fn decode_moves_data_bundle(data: &[u8]) -> Result<MovesDataBundle, JsValue> {
    Ok(fb::decode::decode_moves_data_bundle(data)?)
}

/// 解码 `I18nNamesBundle` (fid = `PKNM`) —— 单语言名称组
/// （物种名、技能名、属性名、形态名等 33 张短文本表）
#[wasm_bindgen(js_name = decodeI18nNamesBundle)]
pub fn decode_i18n_names_bundle(data: &[u8]) -> Result<I18nNamesBundle, JsValue> {
    Ok(fb::decode::decode_i18n_names_bundle(data)?)
}

/// 解码 `I18nFlavorBundle` (fid = `PKFL`) —— 单语言描述组
/// （图鉴/技能/特性/道具描述）。传输层的字符串池在解码时解析为内联字符串。
#[wasm_bindgen(js_name = decodeI18nFlavorBundle)]
pub fn decode_i18n_flavor_bundle(data: &[u8]) -> Result<I18nFlavorBundle, JsValue> {
    Ok(fb::decode::decode_i18n_flavor_bundle(data)?)
}

/// 解码 `evolution.bin` (fid = `EVO1`) —— 全代进化树（species/edges/details）
#[wasm_bindgen(js_name = decodeEvolutionBundle)]
pub fn decode_evolution_bundle(data: &[u8]) -> Result<EvolutionBundle, JsValue> {
    Ok(fb::decode::decode_evolution_bundle(data)?)
}
