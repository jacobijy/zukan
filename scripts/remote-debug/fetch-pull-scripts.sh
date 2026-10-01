#!/usr/bin/env bash
# 引导脚本：在一台新的 Mac / Windows(Git Bash) / Linux 机器上，从 Linux 开发机
# 通过 sftp 一次性取回 remote-debug 目录下的全部同步脚本：
#   pull-mp-weixin.sh / .ps1、pull-app.sh / .ps1、基线配置 pull.conf.sh
# 取回后即可运行对应脚本轮询拉取 mp-weixin / app 产物。
#
# 只依赖系统自带的 OpenSSH sftp；一次性运行、不轮询、不删除本地任何文件，
# 同名旧脚本会被新版覆盖。
#
# 用法：
#   bash fetch-pull-scripts.sh [目标目录]      # 默认拉到当前目录
# 地址与路径优先读环境变量：
#   REMOTE=user@host REMOTE_DIR=/abs/path（或家目录相对路径 Code/...）
#     bash fetch-pull-scripts.sh [目标目录]
#
# 连本引导脚本都没有时（新机器首次），直接粘贴这行等价命令：
#   sftp -r jacobi@192.168.100.100:Code/zukan/scripts/remote-debug
# 区别只是那行会拉成 remote-debug/ 目录；本脚本把内容平铺进目标目录。
#
# 注意 REMOTE_DIR 不要以 ~/ 开头：sftp 的 host:path 不展开 ~（OpenSSH 10 亦然），
# 会被当成字面目录；脚本会自动把 ~/ 剥成家目录相对路径。
set -euo pipefail

REMOTE="${REMOTE:-jacobi@192.168.100.100}"
REMOTE_DIR="${REMOTE_DIR:-~/Code/zukan/scripts/remote-debug}"
LOCAL_DIR="${1:-${LOCAL_DIR:-.}}"

if ! command -v sftp >/dev/null 2>&1; then
    echo "错误：找不到 sftp（OpenSSH 客户端）。"
    echo "      Mac 自带；Windows 设置 → 可选功能里启用「OpenSSH 客户端」。"
    exit 1
fi

mkdir -p "$LOCAL_DIR"

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

# 目标是目录本身（basename remote-debug），先拉到临时目录再把内容平铺进
# 目标目录，不在 LOCAL_DIR 下再套一层 remote-debug。
# BatchMode=yes 只走密钥，不卡在密码提示。
#
# sftp 的 host:path 不展开开头的 ~/（实测 OpenSSH 10 仍不展开，旧版同样），
# 而相对路径以登录后的家目录为起点，所以这里把 "~/Code/..." 剥成 "Code/..."；
# 绝对路径（/ 开头）原样保留。
remote_dir="${REMOTE_DIR%/}"
case "$remote_dir" in
    '~')   remote_dir=. ;;
    '~/'*) remote_dir="${remote_dir#'~/'}" ;;   # 引号必须有：裸 ~/ 会被波浪线展开成 $HOME/
esac

# 必须走 batch（-b -）显式 get -r：直接写 `sftp -r host:目录` 时，sftp 不会递归
# 下载，而是 cd 进该目录并进入交互式（再配 -q 时屏幕上就只剩一个 sftp> 提示符）。
# -p 保留远端权限/mtime。
if (
    cd "$tmp"
    printf 'get -p -r "%s"\n' "$remote_dir" | sftp -b - -o BatchMode=yes "$REMOTE"
); then
    :
else
    echo "错误：sftp 拉取失败（$REMOTE:$remote_dir）。"
    echo "      先配免密：ssh-keygen -t ed25519 && ssh-copy-id $REMOTE"
    echo "      （Windows 没有 ssh-copy-id："
    echo "        type \$HOME/.ssh/id_ed25519.pub | ssh $REMOTE \"cat >> ~/.ssh/authorized_keys\"）"
    echo "      首次连接先手动 ssh 一次确认主机指纹；并核对 REMOTE_DIR 是否存在。"
    exit 1
fi

base="${remote_dir##*/}"
src="$tmp/$base"
if [ ! -d "$src" ]; then
    echo "错误：sftp 未取回预期目录（期望 $base），远端路径是否正确？"
    exit 1
fi

cp -a "$src/." "$LOCAL_DIR/"

echo "已从 $REMOTE:$remote_dir 拉取到 $LOCAL_DIR："
( cd "$src" && find . -type f | sed 's|^\./|  |' | sort )
