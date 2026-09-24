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
                                  │ Mutagen / rsync（局域网，毫秒~1s）
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

## 二、Mac/Windows 侧：把产物同步到本地（二选一）

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

### 方案 B（零安装）：rsync 轮询拉取

仓库里已带 `scripts/remote-debug/pull-mp-weixin.sh`，在 Mac 上：

```bash
# 先配免密：ssh-keygen && ssh-copy-id jacobi@192.168.100.100
bash scripts/remote-debug/pull-mp-weixin.sh
```

每秒 `rsync -az --delete` 把产物镜像到 `~/zukan-mp-weixin`。目录小，开销可忽略；
延迟约 1s。可用 `REMOTE` / `LOCAL_DIR` 等环境变量改地址。

> 不建议用 sshfs / NFS 直接挂载再让开发者工具读：FUSE 上的文件事件不可靠，
> 开发者工具经常不自动刷新、扫描也慢。同步成本地真实目录最稳（这也是本方案
> 与"挂载远端目录"的关键区别）。

## 三、微信开发者工具（Mac 上做一次）

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
| 模拟器请求失败/空白 | `.env.development.local` 的 IP 是否仍为本机 IP；工具是否勾了"不校验域名"；Mac 能否打开 `http://192.168.100.100:8080` |
| 真机连不上后端 | 手机与 Linux 同 Wi-Fi；防火墙放行 8080；后端监听 0.0.0.0 |
| WASM/解密报错 | dev 构建已 `copy-wasm`；确认 `dist/dev/mp-weixin/static/wasm` 存在 |
| 同步报 SSH 错 | 配免密密钥；确认地址、`REMOTE_DIR` 路径 |

## 可选：进一步自动化（以后再说）

- 开微信开发者工具「安全模式 CLI/HTTP 端口」，可在同步完成后由脚本自动触发
  「自动预览 / 真机调试 / 上传」（Mac 上用自带 `cli`，或从 Linux `ssh` 过去调）。
- 要发布版而非调试版：Linux 跑 `pnpm build:mp-weixin`（含 slim），同步
  `dist/build/mp-weixin` 同一路径，工具里点「上传」。
