# pull-*.sh / pull-*.ps1 的共享配置：远程开发机地址与各端同步路径。
#
# 本文件随仓库提交，默认值是仓库维护者的环境。想覆盖但**不提交**自己的配置，
# 建同目录的 `pull.conf.local`（已被 .gitignore 的 `*.local` 覆盖），内容同格式，
# 同名键会覆盖这里。优先级：命令行环境变量 > pull.conf.local > pull.conf.sh > 脚本内置默认。
#
# 键名四个脚本通用：
#   REMOTE     远程开发机 ssh 目标（user@host）
#   REMOTE_DIR / LOCAL_DIR   按端区分，见下方分组
#   INTERVAL   轮询间隔秒数
#   SSH_KEY    私钥路径（可选；不配则用 ssh/sftp 默认）
#   SSH_CMD    远程传输命令（可选；见下方说明）
#
# 写法约定（四个脚本都会按这套解析）：
#   - LOCAL_DIR 可用 `$HOME` 或 `~/`，脚本负责展开（sh 天然展开，ps1 会显式替换）
#   - REMOTE_DIR 是远端 Linux 路径，`~` 交由远端 shell 展开，无需写绝对路径
#   - 支持行内注释，但必须用 `  #`（两个空格 + 井号），否则会被当成路径的一部分
#   - 值里的引号会被剥掉，`"带空格的路径"` 可写
#
# SSH_CMD（仅 .sh 脚本用，.ps1 走系统自带 sftp.exe 不需要）：
#   传给 rsync 的 -e 参数。默认 ssh；Git Bash / MSYS 2 环境下 `ssh` 可能不在
#   PATH 里（报 "Failed to exec ssh: No such file or directory"），此时改成绝对路径：
#     SSH_CMD="/usr/bin/ssh -o BatchMode=yes"
#   带 -o 选项没问题，-e 接受的是整条命令串。

REMOTE=jacobi@192.168.100.100

# mp-weixin（微信开发者工具导入）
MP_REMOTE_DIR=~/Code/zukan/dist/dev/mp-weixin
MP_LOCAL_DIR=$HOME/zukan-mp-weixin

# app（App 离线 SDK 原生工程资源）
APP_REMOTE_DIR=~/Code/zukan/dist/build/app
APP_LOCAL_DIR=$HOME/zukan-app

INTERVAL=1
