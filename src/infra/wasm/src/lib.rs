//! 图鉴 WASM 模块
//! 提供图鉴二进制文件加解密（AES-256-GCM）、通用密码学工具和伤害计算

use wasm_bindgen::prelude::*;

// 加密解密模块
pub mod crypto;
// 伤害计算模块
pub mod calculator;

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
#[wasm_bindgen]
pub fn decrypt_zukan(encrypted_data: &[u8], dek_hex: &str) -> Result<Vec<u8>, JsValue> {
    crypto::decrypt_zukan(encrypted_data, dek_hex)
}

/// 加密图鉴数据
#[wasm_bindgen]
pub fn encrypt_zukan(plaintext: &[u8], dek_hex: &str, version: u8) -> Result<Vec<u8>, JsValue> {
    crypto::encrypt_zukan(plaintext, dek_hex, version)
}

/// 校验文件是否为合法的图鉴加密文件格式
#[wasm_bindgen]
pub fn is_valid_zukan_file(data: &[u8]) -> bool {
    crypto::is_valid_zukan_file(data)
}

/// 获取文件的密钥版本号
#[wasm_bindgen]
pub fn get_zukan_version(data: &[u8]) -> u8 {
    crypto::get_zukan_version(data)
}

// ============== 通用密码学工具 API ==============

/// 生成 256 位随机密钥（Hex 编码）
#[wasm_bindgen]
pub fn generate_key() -> String {
    crypto::generate_key()
}

/// SHA-256 哈希
#[wasm_bindgen]
pub fn sha256_hash(data: &str) -> String {
    crypto::sha256_hash(data)
}

/// HMAC-SHA256 签名
#[wasm_bindgen]
pub fn hmac_sign(key: &str, data: &str) -> String {
    crypto::hmac_sign(key, data)
}

/// HMAC-SHA256 验证
#[wasm_bindgen]
pub fn hmac_verify(key: &str, data: &str, signature: &str) -> bool {
    crypto::hmac_verify(key, data, signature)
}

// ============== 伤害计算器 API ==============
// 类型在 calculator.rs 中已标注 #[wasm_bindgen]，无需再导出

/// 单次伤害计算
#[wasm_bindgen]
pub fn calculate_damage(input: &DamageInput) -> u16 {
    calculator::calculate_damage(input)
}

/// 批量计算所有随机值的伤害范围
#[wasm_bindgen]
pub fn calculate_damage_batch(input: &DamageInput) -> BatchDamageResult {
    calculator::calculate_damage_batch(input)
}

/// 计算能力值
#[wasm_bindgen]
pub fn calculate_stat(level: u8, base: u16, iv: u8, ev: u8, nature_mod: u8) -> u16 {
    calculator::calculate_stat(level, base, iv, ev, nature_mod)
}

/// 计算 HP 能力值
#[wasm_bindgen]
pub fn calculate_hp(level: u8, base: u16, iv: u8, ev: u8) -> u16 {
    calculator::calculate_hp(level, base, iv, ev)
}

/// 获取性格修正
/// 返回 [atk, def, spa, spd, spe] 修正值 (90/100/110)
#[wasm_bindgen]
pub fn calculate_nature_mod(nature_id: u8) -> Vec<u8> {
    calculator::calculate_nature_mod(nature_id).to_vec()
}

// ============== 批量计算包装（与新版 DamageInput 兼容） ==============

/// 创建新版 DamageInput 的便捷函数
#[wasm_bindgen]
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
