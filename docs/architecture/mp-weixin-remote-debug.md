# 远程编辑 + 本地微信开发者工具调试

适用拓扑：**代码只放在 Linux 开发机上**，日常用 VS Code Remote-SSH / code-server /
JetBrains Gateway 连上去在远端编辑和构建；**微信开发者工具跑在局域网内另一台
Mac/Windows 上**（官方不支持 Linux）。

核心原则：**Mac/Windows 只做"调试器主机"，不在那里改源码。** Linux 上 watch 构建，
把很小的 dev 产物实时单向同步过去，开发者工具监听本地副本自动刷新。源码始终
只有 Linux 一份，没有两边合并。原生能力（console、断点、真机调试、WASM、网络）
在开发者工具里照常调。

```
VS Code (Remote-SSH)  ──编辑──▶  Linux 192.168.100.100
                                  │ pnpm dev:mp-weixin (watch)
                                  ▼
                            dist/dev/mp-weixin （小，无 node_modules）
                                  │ Mutagen / Python 调用 rsync（局域网，毫秒~2s）
                                  ▼
                            Mac 本地目录 ◀── 微信开发者工具监听、自动编译
                                  │
                                  ▼ 真机调试（手机同 Wi-Fi）
```

## 一、Linux 侧（只做一次配置，之后常驻）

### 1. API 地址改走局域网 IP

Mac 的模拟器 / 手机里 `localhost` 指的不是这台 Linux。已用 **`.env.development.local`**
（gitignored）覆盖：

```
VITE_API_BASE_URL=http://192.168.100.100:8080
```

换网段改这个文件即可，不污染 git。前提：后端在运行、监听 `0.0.0.0:8080`、CORS 放开
（`.env` 里 `CORS_ALLOWED_ORIGINS=*`），且防火墙放行 LAN 访问 8080/22。

### 2. 起 watch 构建（常驻）

```bash
pnpm dev:mp-weixin
```

它会先 `copy-wasm`，然后持续编译到 `dist/dev/mp-weixin`，**保存源码即增量重建**。
dev 产物不压缩、也不跑 slim（开发者工具开发期不卡 2MB）。

如果要让 watch 在后台常驻（比如开远程同步会话、不想占着前台终端），用：

```bash
pnpm dev:mp:watch            # 启动；已在跑则复用，可重复调用
pnpm dev:mp:watch --status   # 看状态
pnpm dev:mp:watch --stop     # 只停 mp-weixin 的 watch
```

统一多平台（App + 微信）的 watch 入口等价为 `pnpm dev:watch up mp-weixin`
（见 `.claude/skills/platform-watch`）；本平台行为与上述完全一致。

> **长期常驻推荐直接用下文「watch 反复聋」的看门狗 systemd 服务**：watch 缺失
> （含重启机器后）自动拉起、聋了自动抓现场并重启。`pnpm dev:mp:watch` 适合临时手动起。

前者的价值在于它是幂等且按命令行识别 `uni.js -p mp-weixin` 的——不会误杀共用
4000 端口的 `dev:h5`。两个容易踩的点，脚本里已处理：

- **幂等不能用「uni 进程是否存在」判**。刚 fork 时前置步骤（copy-wasm/build-icons）
  要跑十几秒，uni 还没起，那段窗口查不到就会重复开一个，多个 watch 争抢产物目录。
  改用 pidfile 记录 bash pid。
- **停止要按进程组杀**（`-pgid`）。`bash` 包装层收 SIGTERM 不透传子进程，只杀 shell
  会留下孤儿 uni 继续跑；组 pgid 失效时（孤儿常见）退回逐个 pid 杀。

日志 `dist/mp-weixin-watch.log`（`tail -f` 跟踪），pid 文件同目录，均落 `dist/` 已忽略。

### watch 反复"聋"（已知故障；已由看门狗自动兜底，根因待定）

**现象**：watch 跑十几到二十几分钟后**停止增量编译**——进程还在，但改源码后产物
`dist/dev/mp-weixin/**` 的 mtime 不再更新、日志不再刷 "DONE Build complete"。
同步到调试主机看到的仍是旧产物。注意与另一种情况区分：**机器重启后** watch 是裸
后台进程、不会自启，表现为进程整个消失（不是聋）。下面的看门狗两种都覆盖。

**诊断（根因尚未现场坐实）**：不是启停脚本逻辑问题，也不是 inotify 配额——本机
`fs.inotify.max_user_watches = 65536`、实测占用约三百个 watch，远未打满。两个待
区分的嫌疑：**(A)** Vite/chokidar 的 inotify watcher 在长时间运行下偶发停止投递
文件事件（日志连「开始差量编译」都不打）；**(B)** uni 常驻的 esbuild `--service`
子进程卡死（日志停在「开始差量编译」却永不出 DONE）。此前每次构建都刷的
`Circular chunk: session/key → … → session/key` 警告曾是嫌疑诱因，**已于
2026-10-01（commit 7bc7431）断环、构建警告消失**，是否降低聋的频率仍待观察。

**自动兜底：看门狗 + systemd user 服务**

`scripts/mp-watch-watchdog.mjs` 常驻，每 20s 一轮：

- watch 进程不在（含开机后未自启）→ 自动拉起；若前置步骤进行中（uni 未起、但
  pidfile 的 bash 还活）则等待，不会重复开。
- watch 在但疑似聋 → mtime 对账：`src/` 最新源码改动比 `dist/dev/mp-weixin` 最新
  产物「新」超过 90s、且连续 3 轮如此，才判定；随后**先抓一帧现场**到
  `dist/watchdog/incident-*.log`（uni/esbuild 进程状态与 stat、inotify 计数、
  3s strace、watch 日志末尾），再自动重启。抓现场是为了区分上面的 A/B。

安装（本机已开 Linger，登录前/重启后服务自启）：

```bash
mkdir -p ~/.config/systemd/user
cp scripts/systemd/zukan-mp-watch.service ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable --now zukan-mp-watch.service
```

运维：

```bash
systemctl --user status zukan-mp-watch.service   # 看门狗状态
tail -f dist/mp-watchdog.log                      # 看门狗运行日志
ls -t dist/watchdog/                              # 历次判聋的现场（默认留 10 份）
systemctl --user stop zukan-mp-watch.service      # 停止，连带 cgroup 内的被管 watch
```

> unit 里写死了 nvm 的 node 版本路径（`v24.15.0`）。node 升级后需同步改
> `~/.config/systemd/user/zukan-mp-watch.service` 与仓库模板
> `scripts/systemd/zukan-mp-watch.service`，再 `daemon-reload` + `restart`。
> 判聋阈值/间隔可用 `MP_WATCHDOG_*` 环境变量在 unit 里覆盖。

**手动确认/处理**（看门狗不可用时）：比对源码与产物 mtime，源码明显更新即为已聋，
`pnpm dev:mp:watch --stop && pnpm dev:mp:watch` 重启：

```bash
stat -c '%y %n' src/components/TabBar.vue dist/dev/mp-weixin/components/TabBar.wxss
# 源码时间 > 产物时间 → watch 已聋
```

> 待办：拿到一两份 incident 现场后区分 A/B 并针对性根治——A 则让 chokidar 走
> `usePolling`（不靠内核投递），B 则处理常驻 esbuild（消多实例 / 升级）。目标是
> 以后不再依赖重启，看门狗只是定位期的无感兜底。

## 二、Mac/Windows 侧：把产物同步到本地（三选一）

> **新机器首次、本地还没 clone 仓库**：pull 脚本本身在 Linux 的
> `scripts/remote-debug/` 里。先粘贴一行 sftp 把它们取回来：
>
> ```bash
> sftp -r jacobi@192.168.100.100:Code/zukan/scripts/remote-debug
> ```
>
> 拉成 `remote-debug/` 目录（先配 ssh 免密，并手动 `ssh` 一次确认主机指纹）。
> 取回后可用 Python 引导脚本调用 rsync 拉取并更新脚本目录：
> `python remote-debug/fetch-pull-scripts.py [目标目录]`（默认当前目录）。
> 拉取时会排除 `pull.conf`、`pull.conf.local`、`__pycache__/`、`.pytest_cache/`、`.mypy_cache/`、`.ruff_cache/`、
> `.tox/`、`.coverage`、`.DS_Store`、`Thumbs.db` 和 `*.py[cod]`。
>
> 目前统一使用通用配置文件 `scripts/remote-debug/pull.conf`（可覆盖同目录的
> `pull.conf.local`），以及单一 Python 入口：
>
> ```bash
> python3 scripts/remote-debug/pull.py --target mp-weixin --once
> ```
>
> Python 脚本通过命令行调用系统 `rsync`（`-azc --no-perms --delete`）。只有发生真实
> 文件变更（新增/更新/删除）时才打印可读的变更行与一行汇总；仅权限/时间戳差异、或
> mtime 被重建刷新但内容未变都不算变更，无变更时静默。参数详情见 [`scripts/remote-debug/README.md`](../../scripts/remote-debug/README.md)。
> 取回脚本后再按下面的方案同步产物。

### 方案 A（推荐）：Mutagen，毫秒级实时

Mac 上（Windows 也支持，见其文档）：

```bash
brew install mutagen-io/mutagen/mutagen
mutagen daemon start

mutagen sync create \
  --name zukan-mp \
  jacobi@192.168.100.100:~/Code/zukan/dist/dev/mp-weixin \
  ~/zukan-mp-weixin
```

- 用你已有的 SSH 账号/密钥；首次连接 Mutagen 自动在 Linux 装临时 agent，无需服务端配置。
- 双向同步但只有 Linux 侧在变，所以不会冲突；保存后约几百毫秒推到本地。
- 常用：`mutagen sync list`、`mutagen sync monitor zukan-mp`、`mutagen sync terminate zukan-mp`。
- Windows：装 Mutagen 后命令相同（路径写成 `%USERPROFILE%\zukan-mp-weixin`）。

### 方案 B（Python + rsync）：轮询同步

统一入口是 `scripts/remote-debug/pull.py`，在 Mac 上：

```bash
# 先配免密：ssh-keygen && ssh-copy-id jacobi@192.168.100.100
python3 scripts/remote-debug/pull.py --target mp-weixin
```

每秒调用 `rsync -azc --no-perms --delete` 把产物镜像到 `~/zukan-mp-weixin`，只传输有
变化的文件并清理过期项目，延迟约 1s。加 `--no-perms` 是因为目标常落在 NTFS/FAT（如
WSL 的 `/mnt/d`），保留不了 Linux 权限位，否则每轮会把全部文件当成“仅权限不同”重复
列出。加 `--checksum`（`-c`）是因为 mp watch 每轮全量重写产物、刷新所有文件 mtime
（内容没变也刷），默认按 mtime 判定会把几百个文件当更新，改用内容校验和后只同步真正
变化的文件（产物仅约 2.7MB，每轮 checksum 开销可忽略）。只有真实变更才打印、无变更
静默。需要安装 Python 3、rsync 和 OpenSSH，并确保 `rsync`、`ssh` 在 PATH 中。配置优先级：
`命令行参数 / 环境变量 > pull.conf.local > pull.conf`；SSH 密钥和端口可用 `SSH_KEY` / `SSH_PORT` 配置。

> watch 重编译会**先清空 `static/` 再重新生成**，1s 轮询若抓到这个“先删后建”的
> 中间态，同批文件会被多余同步两次。常驻模式每轮先跑 `rsync --dry-run` 只扫描，
> **连续两轮扫描结果一致**（编译已落定）才真正同步；清空后又生成相同内容时扫描为空，
> 全程不落盘。代价是变更落地多等约 1 个轮询间隔；`--once` 不做稳定检测、立即同步一轮。

> 不建议用 sshfs / NFS 直接挂载再让开发者工具读：FUSE 上的文件事件不可靠，
> 开发者工具经常不自动刷新、扫描也慢。同步成本地真实目录最稳（这也是本方案
> 与"挂载远端目录"的关键区别）。

### 方案 C（Windows）：Python + rsync

Windows 使用同一份 Python 实现，但仍需安装 rsync（例如 MSYS2、Cygwin 或 WSL 提供的
rsync），并让 `rsync` 和 `ssh` 命令可从运行 Python 的终端找到。

先在 **PowerShell** 里配置免密（Windows 没有 `ssh-copy-id`）：

```powershell
# 没有密钥先执行：ssh-keygen -t ed25519
type $env:USERPROFILE\.ssh\id_ed25519.pub | ssh jacobi@192.168.100.100 "cat >> ~/.ssh/authorized_keys"
ssh jacobi@192.168.100.100   # 首次连接确认主机指纹，之后脚本才不会卡在指纹交互
```

然后开始同步：

```powershell
py -3 scripts\remote-debug\pull.py --target mp-weixin
```

- 默认每 1s 一轮；可用命令行参数、环境变量或 `pull.conf.local` 覆盖地址、目录、间隔和
  密钥。只有真实变更（新增/更新/删除）时才打印可读变更行与一行汇总、无变更静默。
  脚本带 `--no-perms` 与 `--checksum`：前者适配 WSL `/mnt/d` 等保留不了 Linux 权限位的
  NTFS 目标，后者解决 watch 每轮全量刷新 mtime 导致的伪更新，只同步内容真正变化的文件。
- 单次同步可用 `py -3 scripts\remote-debug\pull.py --target mp-weixin --once`。

## 三、微信开发者工具（Mac/Windows 上做一次）

1. **导入本地副本**：项目目录选 `~/zukan-mp-weixin`（不是 Linux 路径、也不是挂载盘）。
2. **详情 → 本地设置**，勾选：
   - 「不校验合法域名、web-view（业务域名）、TLS 版本以及 HTTPS 证书」
     （因为走 `http://192.168.100.100:8080`）；
   - 一般保留「将 JS 编译成 ES5」按需；sourcemap 建议开，便于报错定位。
3. 之后**保存源码 → Linux 增量构建 → 同步 → 开发者工具自动重新编译**，Console /
   Sources 断点 / Network / Storage 都在这看。
4. 真机：点「真机调试」或「自动预览」，**手机和 Linux 同一 Wi-Fi**，手机直接访问
   `192.168.100.100:8080`。
5. 需要真机 / 登录 / 某些原生 API 时，在 `src/manifest.json` 填真实
   `mp-weixin.appid`（空 appid 在模拟器多以测试号运行，但能力受限）。

## 四、"改微信 native 代码"到底在哪改

不用在 Mac 上改。所有页面/组件/`project.config` 的来源都是 Linux 上的源码：

- 页面、组件、WASM、静态资源：在 Linux 的 `src/` 里改（你现在的远程 IDE）。
- `project.config.json` / `app.json` 等：由 uni-app 根据 `manifest.json`、`pages.json`
  生成，改那两个源文件即可，别直接改 dist（会被下次构建覆盖）。
- 开发者工具里手动勾的设置存在工具本地，不属于源码。

## 五、日常操作 & 排障

| 现象 | 处理 |
|------|------|
| 改了代码工具没刷新 | 确认 `dev:mp-weixin` 在跑、同步会话在跑；工具里 `Ctrl/Cmd+B` 手动编译 |
| 改了代码但产物 mtime 不更新 | watch 可能已"聋"——看门狗会自动抓现场并重启（见"watch 反复聋"）；手动则比对源码/产物 mtime 确认后 `--stop` 重启 |
| 重启机器后 watch 没了 | 正常：watch 是裸进程。若已装看门狗 systemd 服务会自动拉起；否则手动 `pnpm dev:mp:watch` |
| 模拟器请求失败/空白 | `.env.development.local` 的 IP 是否仍为本机 IP；工具是否勾了"不校验域名"；Mac 能否打开 `http://192.168.100.100:8080` |
| 真机连不上后端 | 手机与 Linux 同 Wi-Fi；防火墙放行 8080；后端监听 0.0.0.0 |
| WASM/解密报错 | dev 构建已 `copy-wasm`；确认 `dist/dev/mp-weixin/static/wasm` 存在 |
| 同步报 SSH 错 | 配免密密钥；确认地址、`REMOTE_DIR` 路径 |
| Python 同步报错 | 确认 rsync / ssh 已安装并在 PATH 中、公钥已上传、远端主机密钥已在 `known_hosts` 中，并核对 `REMOTE` / `REMOTE_DIR` |

## 可选：进一步自动化（以后再说）

- 开微信开发者工具「安全模式 CLI/HTTP 端口」，可在同步完成后由脚本自动触发
  「自动预览 / 真机调试 / 上传」（Mac 上用自带 `cli`，或从 Linux `ssh` 过去调）。
- 要发布版而非调试版：Linux 跑 `pnpm build:mp-weixin`（含 slim），同步
  `dist/build/mp-weixin` 同一路径，工具里点「上传」。
