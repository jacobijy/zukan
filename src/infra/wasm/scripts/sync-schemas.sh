#!/usr/bin/env bash
# 从 zukan-server 仓拉取最新 FlatBuffers schema
#
# 用法：从 zukan/src/infra/wasm/ 目录执行
#   bash scripts/sync-schemas.sh [--server <path>]
#
# 默认假设两个仓平级：../../../../../zukan-server/tools/schemas/
# 也可以显式指定 --server 覆盖。
#
# schema 的权威目录在 zukan-server/tools/schemas/（数值 + i18n 共 17 份）。
# assets/fb/schemas/ 是旧的数值子集副本，不要再作为同步源。

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CRATE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
DEFAULT_SERVER="$(cd "$CRATE_DIR/../../../.." && pwd)/zukan-server"

SERVER_ROOT="${DEFAULT_SERVER}"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --server) SERVER_ROOT="$2"; shift 2 ;;
    -h|--help)
      grep -E '^# ' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *) echo "unknown arg: $1" >&2; exit 2 ;;
  esac
done

SRC="$SERVER_ROOT/tools/schemas"
DST="$CRATE_DIR/schemas"

if [[ ! -d "$SRC" ]]; then
  echo "❌ 找不到源 schema 目录: $SRC" >&2
  echo "   请通过 --server 显式指定 zukan-server 仓路径" >&2
  exit 1
fi

echo "→ 从 $SRC 同步到 $DST"
mkdir -p "$DST"

# 全量覆盖：先清旧的 .fbs，再拷新的（防止上游删了文件本地残留）
rm -f "$DST"/*.fbs
cp "$SRC"/*.fbs "$DST/"

echo "→ 已同步 $(ls "$DST"/*.fbs | wc -l | tr -d ' ') 个 schema 文件"

# git diff 提示（在 zukan 仓内运行时才有效）
if command -v git >/dev/null && git -C "$CRATE_DIR" rev-parse --show-toplevel >/dev/null 2>&1; then
  echo ""
  echo "→ git diff schemas/:"
  git -C "$CRATE_DIR" diff --stat -- schemas/ || true
  echo ""
  echo "如果 schemas/ 有变更，运行 bash scripts/generate-fb.sh 重新生成 Rust 绑定"
fi
