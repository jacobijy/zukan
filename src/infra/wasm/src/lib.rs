//! 图鉴 WASM 模块
//! 提供加密解密和高性能模拟计算

use wasm_bindgen::prelude::*;

// 加密解密模块
pub mod crypto;
// 模拟计算模块
pub mod simulator;

use simulator::{DamageInput, BatchDamageResult};

// WASM 初始化
#[wasm_bindgen(start)]
pub fn init() {
    // 启用 panic 钩子用于调试
    #[cfg(feature = "console_error_panic_hook")]
    console_error_panic_hook::set_once();
}

// ============== 加密解密 API ==============

/// 生成 256 位随机密钥（Base64 编码）
#[wasm_bindgen]
pub fn generate_key() -> String {
    crypto::generate_key()
}

/// AES-256-GCM 加密
#[wasm_bindgen]
pub fn encrypt(key_base64: &str, plaintext: &str) -> Result<String, JsValue> {
    crypto::encrypt(key_base64, plaintext)
}

/// AES-256-GCM 解密
#[wasm_bindgen]
pub fn decrypt(key_base64: &str, ciphertext_base64: &str) -> Result<String, JsValue> {
    crypto::decrypt(key_base64, ciphertext_base64)
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

// ============== 战斗模拟器 API ==============
// 类型在 simulator.rs 中已标注 #[wasm_bindgen]，无需再导出

/// 单次伤害计算
#[wasm_bindgen]
pub fn calculate_damage(input: &DamageInput) -> u16 {
    simulator::calculate_damage(input)
}

/// 批量计算所有随机值的伤害范围
#[wasm_bindgen]
pub fn calculate_damage_batch(input: &DamageInput) -> BatchDamageResult {
    simulator::calculate_damage_batch(input)
}

/// 计算能力值
#[wasm_bindgen]
pub fn calculate_stat(level: u8, base: u16, iv: u8, ev: u8, nature_mod: u8) -> u16 {
    simulator::calculate_stat(level, base, iv, ev, nature_mod)
}

/// 计算 HP 能力值
#[wasm_bindgen]
pub fn calculate_hp(level: u8, base: u16, iv: u8, ev: u8) -> u16 {
    simulator::calculate_hp(level, base, iv, ev)
}

/// 获取性格修正
/// 返回 [atk, def, spa, spd, spe] 修正值 (90/100/110)
#[wasm_bindgen]
pub fn calculate_nature_mod(nature_id: u8) -> Vec<u8> {
    simulator::calculate_nature_mod(nature_id).to_vec()
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
