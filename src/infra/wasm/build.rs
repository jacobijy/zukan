//! 编译期从 `src/static/enums/*.json` 生成常量。
//!
//! 目的：pokeapi 的 slug→id 映射只在一处维护（JSON 静态文件）；
//! Rust 与 TS 都从同一份数据派生，避免手写两份数字表漂移。
//!
//! 生成产物：`$OUT_DIR/gen_enums.rs`，被 `src/calculator.rs` 通过 `include!` 引入。
//!
//! 注意：`MOVE_FLAG_*` 位掩码不从 JSON 派生 —— 那是 Rust 与 JS 之间的 ABI 契约（位序），
//! 不是可热更新的数据。见 `src/calculator.rs`。

use std::env;
use std::fs;
use std::path::{Path, PathBuf};

fn main() {
    // 项目根目录下的 JSON 表位置
    let enums_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../../static/enums");

    // 每份表 → (Rust 常量前缀, Rust 常量类型, id 上限过滤)
    // - types.json 里有 10001/10002 (unknown/shadow) 超出 u8，直接跳过（伤害计算路径用不到）
    // - abilities/moves 用 u16
    let tables: &[(&str, &str, &str, Option<u32>)] = &[
        ("types.json",    "TYPE",    "u8",  Some(255)),
        ("weathers.json", "WEATHER", "u8",  None),
        ("terrains.json", "TERRAIN", "u8",  None),
        ("abilities.json","ABILITY", "u16", Some(u16::MAX as u32)),
    ];

    let mut out = String::new();
    out.push_str("// 由 build.rs 生成，请勿手工编辑\n");
    out.push_str("// 源：src/static/enums/*.json\n\n");

    for &(file, prefix, ty, max_id) in tables {
        let path = enums_dir.join(file);
        // Cargo 感知源变更：JSON 改动后重新构建
        println!("cargo:rerun-if-changed={}", path.display());
        emit_consts(&mut out, &path, prefix, ty, max_id);
    }

    // Weather/Terrain 的 "无" 值不在 pokeapi 里，Rust 侧显式定义
    out.push_str("\npub const WEATHER_NONE: u8 = 0;\n");
    out.push_str("pub const TERRAIN_NONE: u8 = 0;\n");

    let out_dir = env::var("OUT_DIR").expect("OUT_DIR 未设置");
    let out_path = Path::new(&out_dir).join("gen_enums.rs");
    fs::write(&out_path, out).expect("写入 gen_enums.rs 失败");

    println!("cargo:rerun-if-changed=build.rs");
}

/// 读一份 `{ "slug": id, ... }` JSON，生成 `pub const {PREFIX}_{SLUG}: <ty> = <id>;` 行。
fn emit_consts(out: &mut String, path: &Path, prefix: &str, ty: &str, max_id: Option<u32>) {
    let raw = fs::read_to_string(path)
        .unwrap_or_else(|e| panic!("读取 {} 失败: {e}", path.display()));

    // 手写微型 JSON 解析：只有 `{"key": number, ...}` 一层，不引额外依赖以保持构建最小。
    let entries = parse_flat_object(&raw)
        .unwrap_or_else(|e| panic!("解析 {} 失败: {e}", path.display()));

    out.push_str(&format!(
        "// ── {} ──\n",
        path.file_name().unwrap().to_string_lossy(),
    ));
    for (slug, id) in entries {
        if let Some(cap) = max_id {
            if id > cap {
                continue;
            }
        }
        let name = slug_to_const(&slug);
        out.push_str(&format!("pub const {prefix}_{name}: {ty} = {id};\n"));
    }
    out.push('\n');
}

/// `iron-fist` / `sunny-day` → `IRON_FIST` / `SUNNY_DAY`
fn slug_to_const(slug: &str) -> String {
    slug.to_ascii_uppercase().replace('-', "_")
}

/// 极简 JSON 平坦对象解析：`{"slug": <int>, ...}`。
/// 不支持嵌套/浮点/转义 —— 我们控制输入格式，这些够用。
fn parse_flat_object(s: &str) -> Result<Vec<(String, u32)>, String> {
    let s = s.trim();
    let s = s.strip_prefix('{').ok_or("缺少 {")?;
    let s = s.trim_end();
    let s = s.strip_suffix('}').ok_or("缺少 }")?;

    let mut out = Vec::new();
    for raw_pair in s.split(',') {
        let pair = raw_pair.trim();
        if pair.is_empty() { continue; }
        let (k, v) = pair.split_once(':').ok_or_else(|| format!("缺少 ':' 在 `{pair}`"))?;
        let key = k.trim().trim_matches('"').to_string();
        let val: u32 = v.trim().parse()
            .map_err(|e| format!("无效数字 `{v}`: {e}"))?;
        out.push((key, val));
    }
    Ok(out)
}
