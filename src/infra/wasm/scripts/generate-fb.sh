#!/usr/bin/env bash
# 生成 FlatBuffers Rust 绑定
#
# 用法：从 zukan/src/infra/wasm/ 目录执行
#   bash scripts/generate-fb.sh
#
# 依赖：flatc (>= 23.x)
# 输出：src/fb/generated/*.rs + src/fb/generated/mod.rs

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CRATE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
SCHEMAS_DIR="$CRATE_DIR/schemas"
OUT_DIR="$CRATE_DIR/src/fb/generated"

if ! command -v flatc >/dev/null; then
  echo "❌ 未找到 flatc；请安装 flatbuffers-compiler (>=23.x)" >&2
  echo "   apt: sudo apt install flatbuffers-compiler" >&2
  echo "   brew: brew install flatbuffers" >&2
  exit 1
fi

FLATC_VERSION="$(flatc --version | awk '{print $NF}')"
echo "→ flatc $FLATC_VERSION"

if [[ ! -d "$SCHEMAS_DIR" ]] || [[ -z "$(ls "$SCHEMAS_DIR"/*.fbs 2>/dev/null)" ]]; then
  echo "❌ schemas/ 目录为空；先运行 bash scripts/sync-schemas.sh" >&2
  exit 1
fi

# 清空旧生成产物，重新生成
rm -rf "$OUT_DIR"
mkdir -p "$OUT_DIR"

echo "→ flatc --rust -o $OUT_DIR schemas/*.fbs"
flatc --rust -o "$OUT_DIR" "$SCHEMAS_DIR"/*.fbs

# flatc 默认假设生成文件都在 crate 根同层，用 `use crate::xxx_generated::*;` 互引。
# 我们把产物放在 src/fb/generated/ 下，需要两处修正：
#  1. crate:: 前缀改成 crate::fb::generated::（适配目录布局）
#  2. 类型实际都嵌在 pokeapi::fb 命名空间里，补上这段路径
echo "→ 修正 use crate:: → use crate::fb::generated::xxx::pokeapi::fb::（适配 src/fb/generated/ 布局）"
for f in "$OUT_DIR"/*_generated.rs; do
  sed -i 's|use crate::\([a-z_]*_generated\)::\*;|use crate::fb::generated::\1::pokeapi::fb::*;|g' "$f"
done

# 生成 mod.rs：pub mod 每一个 *_generated.rs
echo "→ 生成 mod.rs"
{
  echo "// @generated — 由 scripts/generate-fb.sh 生成，请勿手动修改"
  echo "// flatc 版本: $FLATC_VERSION"
  echo "#![allow(clippy::all)]"
  echo "#![allow(unused_imports)]"
  echo "#![allow(dead_code)]"
  echo "#![allow(non_snake_case)]"
  echo "#![allow(non_camel_case_types)]"
  echo ""
  for f in "$OUT_DIR"/*_generated.rs; do
    name="$(basename "$f" .rs)"
    echo "pub mod $name;"
  done
} > "$OUT_DIR/mod.rs"

count="$(ls "$OUT_DIR"/*_generated.rs | wc -l | tr -d ' ')"
echo "→ 已生成 $count 个 Rust 绑定文件"
echo ""
echo "下一步：cargo build --target wasm32-unknown-unknown --release"
