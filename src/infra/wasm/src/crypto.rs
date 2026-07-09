//! 加密解密模块
//! 提供 AES-256-GCM 图鉴二进制文件加解密、SHA-256 哈希、HMAC 签名等功能
//! 二进制文件格式（与服务端 wasm-crypto 一致）：
//! `[magic(4B)="ZKDX"] [version(1B)] [nonce(12B)] [ciphertext(...)] [tag(16B)]`

use wasm_bindgen::prelude::*;
use sha2::{Sha256, Digest};
use hmac::Mac;
use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use rand_core::{OsRng, RngCore};
use hex::FromHex;

type HmacSha256 = hmac::Hmac<Sha256>;

// ============================================================
// 图鉴加密文件格式常量（与服务端一致）
// ============================================================

/// 文件魔数
const MAGIC: [u8; 4] = *b"ZKDX";
/// 当前格式版本
const FORMAT_VERSION: u8 = 1;
const NONCE_SIZE: usize = 12;
const TAG_SIZE: usize = 16;
/// 文件头大小: magic(4) + version(1)
const HEADER_SIZE: usize = 5;

// ============================================================
// 图鉴二进制文件加解密 API
// ============================================================

/// 解密图鉴加密二进制数据
///
/// # 参数
/// - `encrypted_data`: 加密的二进制数据（Uint8Array）
/// - `dek_hex`: 32 字节 DEK 密钥的 hex 字符串
///
/// # 返回
/// 解密后的明文数据
pub fn decrypt_zukan(encrypted_data: &[u8], dek_hex: &str) -> Result<Vec<u8>, JsValue> {
    // 1. 校验数据长度
    if encrypted_data.len() < HEADER_SIZE + NONCE_SIZE + TAG_SIZE {
        return Err(JsValue::from_str("ZKDX: data too short"));
    }

    // 2. 校验 magic
    if encrypted_data[0..4] != MAGIC {
        return Err(JsValue::from_str("ZKDX: invalid magic"));
    }

    // 3. 校验版本
    let version = encrypted_data[4];
    if version != FORMAT_VERSION {
        return Err(JsValue::from_str(&format!("ZKDX: unsupported version: {}", version)));
    }

    // 4. 提取 nonce（12 字节）
    let nonce = Nonce::from_slice(&encrypted_data[HEADER_SIZE..HEADER_SIZE + NONCE_SIZE]);

    // 5. 提取密文 + tag（AES-GCM 需要将 tag 附在密文末尾）
    let ciphertext_with_tag = &encrypted_data[HEADER_SIZE + NONCE_SIZE..];

    // 6. 解析密钥
    let key_bytes = <[u8; 32]>::from_hex(dek_hex)
        .map_err(|e| JsValue::from_str(&format!("ZKDX: invalid DEK hex: {}", e)))?;

    // 7. AES-256-GCM 解密
    let cipher = Aes256Gcm::new(&key_bytes.into());
    let plaintext = cipher
        .decrypt(nonce, ciphertext_with_tag)
        .map_err(|_| JsValue::from_str("ZKDX: decrypt failed (tag mismatch or corrupted data)"))?;

    Ok(plaintext)
}

/// 加密图鉴数据（生成完整的加密二进制文件）
///
/// # 参数
/// - `plaintext`: 要加密的明文数据
/// - `dek_hex`: 32 字节 DEK 密钥的 hex 字符串
/// - `version`: 密钥版本号
///
/// # 返回
/// 完整的加密二进制数据（含文件头）
pub fn encrypt_zukan(plaintext: &[u8], dek_hex: &str, version: u8) -> Result<Vec<u8>, JsValue> {
    // 1. 解析密钥
    let key_bytes = <[u8; 32]>::from_hex(dek_hex)
        .map_err(|e| JsValue::from_str(&format!("ZKDX: invalid DEK hex: {}", e)))?;

    // 2. 生成随机 nonce（12 字节）
    let mut nonce_bytes = [0u8; NONCE_SIZE];
    OsRng.fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);

    // 3. AES-256-GCM 加密
    let cipher = Aes256Gcm::new(&key_bytes.into());
    let ciphertext_with_tag = cipher
        .encrypt(nonce, plaintext)
        .map_err(|_| JsValue::from_str("ZKDX: encryption failed"))?;

    // 4. 构造完整文件格式
    let mut result = Vec::with_capacity(HEADER_SIZE + NONCE_SIZE + ciphertext_with_tag.len());
    result.extend_from_slice(&MAGIC);
    result.push(version);
    result.extend_from_slice(&nonce_bytes);
    result.extend_from_slice(&ciphertext_with_tag);

    Ok(result)
}

/// 校验文件是否为合法的图鉴加密文件格式
pub fn is_valid_zukan_file(data: &[u8]) -> bool {
    if data.len() < HEADER_SIZE {
        return false;
    }
    data[0..4] == MAGIC && data[4] == FORMAT_VERSION
}

/// 获取文件的密钥版本号
/// 格式非法时返回 0
pub fn get_zukan_version(data: &[u8]) -> u8 {
    if data.len() < HEADER_SIZE || data[0..4] != MAGIC {
        return 0;
    }
    data[4]
}

// ============================================================
// 通用密码学工具（保留）
// ============================================================

/// 生成 256 位随机密钥（Hex 编码）
pub fn generate_key() -> String {
    let key = Aes256Gcm::generate_key(&mut OsRng);
    hex::encode(&key)
}

/// SHA-256 哈希
pub fn sha256_hash(data: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(data.as_bytes());
    let result = hasher.finalize();
    format!("{:x}", result)
}

/// HMAC-SHA256 签名
pub fn hmac_sign(key: &str, data: &str) -> String {
    let mut mac = <HmacSha256 as Mac>::new_from_slice(key.as_bytes())
        .expect("HMAC can take key of any size");
    Mac::update(&mut mac, data.as_bytes());
    let result = mac.finalize();
    format!("{:x}", result.into_bytes())
}

/// HMAC-SHA256 验证
pub fn hmac_verify(key: &str, data: &str, signature: &str) -> bool {
    let mut mac = <HmacSha256 as Mac>::new_from_slice(key.as_bytes())
        .expect("HMAC can take key of any size");
    Mac::update(&mut mac, data.as_bytes());

    let sig_bytes = match hex::decode(signature) {
        Ok(b) => b,
        Err(_) => return false,
    };

    mac.verify_slice(&sig_bytes).is_ok()
}