#!/usr/bin/env bash
# 在 Mac（或 Windows 的 Git Bash / WSL）上运行：从 Linux 开发机轮询拉取
# App 的「本地打包资源」（pnpm build:app 产物 dist/build/app）到本地，
# 供 App 离线 SDK 原生工程（Android Studio / Xcode）作为 apps 资源加载并编译运行。
#
# 先决条件：
#   1) 能 ssh 免密登录 Linux（ssh-keygen + ssh-copy-id jacobi@192.168.100.100）
#   2) 本机有 rsync（macOS 自带；Windows 用 Git Bash/WSL）
# 追求毫秒级实时同步建议改用 Mutagen，见
# docs/architecture/app-remote-debug.md。
#
# 可用环境变量覆盖默认值：
#   REMOTE=user@host REMOTE_DIR=~/path LOCAL_DIR=~/path INTERVAL=1 ./pull-app.sh
set -euo pipefail

REMOTE="${REMOTE:-jacobi@192.168.100.100}"
REMOTE_DIR="${REMOTE_DIR:-~/Code/zukan/dist/build/app/}"
LOCAL_DIR="${LOCAL_DIR:-$HOME/zukan-app}"
INTERVAL="${INTERVAL:-1}"

mkdir -p "$LOCAL_DIR"
echo "从 $REMOTE:$REMOTE_DIR"
echo "  → $LOCAL_DIR（每 ${INTERVAL}s 轮询，--delete 保持镜像，Ctrl-C 停止）"

while true; do
    rsync -az --delete -e ssh "$REMOTE:$REMOTE_DIR" "$LOCAL_DIR/"
    sleep "$INTERVAL"
done
