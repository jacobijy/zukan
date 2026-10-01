#!/usr/bin/env bash
# 在 Mac（或 Windows 的 Git Bash / WSL）上运行：从 Linux 开发机轮询拉取
# mp-weixin 的 dev 产物到本地，供微信开发者工具导入并自动刷新。
#
# 先决条件：
#   1) 能 ssh 免密登录 Linux（ssh-keygen + ssh-copy-id $REMOTE）
#   2) 本机有 rsync（macOS 自带；Windows 用 Git Bash/WSL）
# 追求毫秒级实时同步建议改用 Mutagen，见
# docs/architecture/mp-weixin-remote-debug.md。
#
# 地址与路径优先读同目录 pull.conf.sh / pull.conf.local（见该文件头注释）。
# 也可用环境变量覆盖：
#   REMOTE=user@host REMOTE_DIR=/path LOCAL_DIR=~/path INTERVAL=1 SSH_CMD=/usr/bin/ssh ./pull-mp-weixin.sh
set -euo pipefail

# 先落脚本所在目录（与 pull.conf.sh 同级），便于从任意 cwd 调用。
# 用参数展开取目录，不用 dirname：PATH 异常（MSYS / 精简环境）时 dirname 可能不存在，
# 那时恰好最需要这个脚本能跑起来。
dir="${BASH_SOURCE[0]%/*}"
[ "$dir" = "${BASH_SOURCE[0]}" ] && dir=.   # 无 / 时 dirname 相当于 .
cd "$dir"

# 配置文件：先基线配置，后 .local（本地覆盖、不提交）；后 source 的胜出
for conf in pull.conf.sh pull.conf.local; do
    [ -f "$conf" ] && . "$conf"
done

REMOTE="${REMOTE:-jacobi@192.168.100.100}"
REMOTE_DIR="${REMOTE_DIR:-${MP_REMOTE_DIR:-~/Code/zukan/dist/dev/mp-weixin}}"
LOCAL_DIR="${LOCAL_DIR:-${MP_LOCAL_DIR:-$HOME/zukan-mp-weixin}}"
INTERVAL="${INTERVAL:-1}"
SSH_CMD="${SSH_CMD:-ssh}"

# 本地路径的 ~ 必须显式展开：rsync 不展开它，会静默同步成空目录。
# REMOTE_DIR 的 ~ 留给远端 shell 展开（rsync 把整串交给远端 ssh 执行）。
LOCAL_DIR="${LOCAL_DIR/#\~/$HOME}"

# 启动即检查 ssh 可用性：rsync 自己的报错是 "Failed to exec ssh"，看不出要改什么
ssh_bin="${SSH_CMD%% *}"
if ! command -v "$ssh_bin" >/dev/null 2>&1; then
    echo "错误：找不到 ssh（用的 $SSH_CMD）。"
    echo "      在 pull.conf.sh / pull.conf.local 里设 SSH_CMD=\"/usr/bin/ssh\"（绝对路径），"
    echo "      或检查 PATH。诊断：command -v ssh"
    exit 1
fi

mkdir -p "$LOCAL_DIR"

echo "从 $REMOTE:$REMOTE_DIR"
echo "  → $LOCAL_DIR（每 ${INTERVAL}s 轮询，--delete 保持镜像，Ctrl-C 停止）"

while true; do
    # 源末尾必须带 /：rsync 不带 / 时拷的是目录本身，会在 LOCAL_DIR 下再套一层 mp-weixin。
    # %/ 先归一化，避免配置里已带 / 时出现 //。
    rsync -az --delete -e "$SSH_CMD" "$REMOTE:${REMOTE_DIR%/}/" "$LOCAL_DIR/"
    sleep "$INTERVAL"
done
