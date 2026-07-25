//! FlatBuffers 解码模块
//!
//! 用于把 zukan-server 提供的 FB 二进制数据（`assets/fb/*.bin`）解码成
//! 结构化 JS 对象，通过 [`serde_wasm_bindgen`] 一次性交给 JS 层。
//!
//! 四个入口对应四种 FlatBuffers root（file_identifier）：
//! - [`decode_pokemon_gen_bundle`] — `PKMB`，宝可梦基础参数（按世代打包）
//! - [`decode_pokemon_vg_moves_bundle`] — `PMOV`，招式学习记录（原始行式）
//! - [`decode_pokemon_moves_bundle`] — `PMSB`，招式学习记录（按宝可梦聚合）
//! - [`decode_moves_data_bundle`] — `MDAT`，招式定义
//!
//! 每个函数：
//! 1. 校验 file_identifier；
//! 2. 通过 `flatbuffers::root::<T>` 验证器解析；
//! 3. 用 [`convert`] 拷贝到 owned struct（Serialize 派生，camelCase）；
//! 4. `serde_wasm_bindgen::to_value` 转成 `JsValue`。

pub mod convert;
pub mod decode;
pub mod generated;

use thiserror::Error;
use wasm_bindgen::JsValue;

/// FB 解码错误
#[derive(Debug, Error)]
pub enum FbDecodeError {
    #[error("invalid FlatBuffers identifier: expected {expected}, got {found:?}")]
    InvalidIdentifier {
        expected: &'static str,
        found: Option<String>,
    },
    #[error("failed to parse FlatBuffers root: {0}")]
    ParseFailed(String),
    #[error("buffer too small: {0} bytes")]
    TruncatedBuffer(usize),
    #[error("failed to serialize decoded bundle: {0}")]
    SerializeFailed(String),
}

impl From<FbDecodeError> for JsValue {
    fn from(e: FbDecodeError) -> Self {
        JsValue::from_str(&e.to_string())
    }
}
