# Remote debug 脚本

本目录提供 Python + rsync 脚本，将 Linux 开发机生成的微信小程序或 App 资源同步到运行开发者工具的本机。脚本只搬运文件，不负责启动构建或开发者工具。

## 环境准备

- Python 3
- `rsync` 和 OpenSSH `ssh` 命令，且均可从当前终端的 `PATH` 找到
- Linux 开发机的 SSH 免密登录已配置；首次连接前先运行 `ssh user@host` 并确认主机指纹

## 同步产物

在仓库根目录运行：

```bash
# 常驻同步微信小程序产物（默认每秒检查一次，Ctrl+C 停止）
python3 scripts/remote-debug/pull.py --target mp-weixin

# 常驻同步 App 本地打包资源
python3 scripts/remote-debug/pull.py --target app

# 只同步一轮后退出
python3 scripts/remote-debug/pull.py --target mp-weixin --once

# 查看最终配置，不连接远程主机
python3 scripts/remote-debug/pull.py --target app --dry-run
```

默认目标路径如下：

| 目标 | Linux 源目录 | 本机目标目录 |
| --- | --- | --- |
| `mp-weixin` | `~/Code/zukan/dist/dev/mp-weixin` | `$HOME/zukan-mp-weixin` |
| `app` | `~/Code/zukan/dist/build/app` | `$HOME/zukan-app` |

同步使用 `rsync -az --delete`：本机目录会成为远端目录的镜像，远端已删除的文件也会从本机目标目录删除。只有检测到文件变更时才输出同步方向、变更文件的时间/大小/传输字节/变更标记/路径及 rsync 统计；没有文件变更时不打印同步日志。

## 命令行参数

查看完整命令帮助：

```bash
python3 scripts/remote-debug/pull.py --help
python3 scripts/remote-debug/fetch-pull-scripts.py --help
```

`pull.py` 的参数缺失或无效时也会先打印完整帮助，再显示具体错误。例如直接运行 `python3 scripts/remote-debug/pull.py` 会说明必须提供 `--target`。

`pull.py` 参数：

| 参数 | 说明 |
| --- | --- |
| `--target {app,mp-weixin}` | 必填；选择 App 或微信小程序资源 |
| `--remote USER@HOST` | Linux SSH 主机 |
| `--remote-dir PATH` | Linux 上的源目录 |
| `--local-dir PATH` | 本机目标目录；支持 `~` 和 `$HOME` |
| `--interval SECONDS` | 常驻轮询间隔，默认 1 秒 |
| `--ssh-key PATH` | SSH 私钥；不指定时使用 SSH agent 或默认密钥 |
| `--ssh-port PORT` | SSH 端口，默认 22 |
| `--ssh-cmd COMMAND` | SSH 命令，默认 `ssh` |
| `--once` | 只同步一次后退出 |
| `--dry-run` | 打印解析后的目标和配置，不连接远端 |
| `-h`, `--help` | 显示帮助并退出 |

示例：临时覆盖远程主机和本地目录，只同步一轮：

```bash
python3 scripts/remote-debug/pull.py \
  --target mp-weixin \
  --remote dev@192.168.1.20 \
  --local-dir ~/tmp/zukan-mp \
  --once
```

`fetch-pull-scripts.py` 用于从 Linux 拉取/更新本目录脚本，适合本机尚未克隆仓库的场景：

```bash
python3 scripts/remote-debug/fetch-pull-scripts.py
python3 scripts/remote-debug/fetch-pull-scripts.py ~/remote-debug
```

它接受一个可选的本机目标目录（默认当前目录），以及 `--remote`、`--remote-dir`、`--ssh-key`、`--ssh-port`、`--ssh-cmd` 连接参数。为避免覆盖机器专属配置，拉取会排除 `pull.conf`、`pull.conf.local` 和缓存/系统文件。

## 配置

默认配置在本目录的 `pull.conf`。个人机器可新建 `pull.conf.local` 覆盖同名设置；该文件不应提交。配置项：

| 配置项 | 说明 |
| --- | --- |
| `REMOTE` | SSH 主机，格式为 `user@host` |
| `MP_REMOTE_DIR`, `APP_REMOTE_DIR` | 微信小程序 / App 的 Linux 源目录 |
| `MP_LOCAL_DIR`, `APP_LOCAL_DIR` | 微信小程序 / App 的本机目标目录 |
| `INTERVAL` | 常驻轮询间隔秒数 |
| `SSH_KEY` | SSH 私钥路径，可选 |
| `SSH_PORT` | SSH 端口，默认 `22` |
| `SSH_CMD` | SSH 命令，默认 `ssh` |

配置优先级从高到低：命令行参数 > 环境变量 > `pull.conf.local` > `pull.conf` > 脚本内置默认值。环境变量名与配置项相同；如 `REMOTE`、`SSH_KEY`。路径支持 `~` 和 `$HOME`。配置值可加引号；行内注释须在井号前留两个空格。

## 验证脚本

本目录的单元测试可从仓库根目录运行：

```bash
python3 -m unittest discover -s scripts/remote-debug -p 'test_*.py'
```
