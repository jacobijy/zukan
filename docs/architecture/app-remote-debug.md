# Android / iOS：本地资源编译 + 远程共享调试

适用拓扑与微信小程序一致：**代码只放在 Linux 开发机上**，用 VS Code Remote-SSH /
code-server / JetBrains Gateway 连上去远端编辑、构建；**Android Studio / Xcode 跑在
局域网内另一台 Mac/Windows 上**（App 的真机编译、签名、上架无法在 Linux 完成）。

核心原则也一致：**Mac/Windows 只做"调试器 / 打包主机"，不在那里改源码。** Linux 上把
前端编译成 App 的「本地打包资源」，把这堆产物实时单向同步过去，对端的原生工程加载该
资源并编译运行。源码始终只有 Linux 一份。

**与微信小程序的关键差异**：微信开发者工具本身就是运行时 + 调试器，导入编译产物即可
跑；而 App 的编译产物（www 资源）**不能独立运行**，必须套进一个 DCloud **App 离线 SDK
原生工程**（Android Studio / Xcode），由后者编译、签名后装到真机/模拟器。原生能力
（console、断点、网络、WASM、登录）在 AS / Xcode 里照常调。**Linux 全程不产出
apk/ipa，也不做云打包**——只共享编译后的资源。

```
VS Code (Remote-SSH)  ──编辑──▶  Linux 192.168.100.100
                                  │ pnpm build:app
                                  ▼
                            dist/build/app（本地打包资源，约 2.6 MiB）
                                  │ Mutagen / rsync（局域网，毫秒~1s）
                                  ▼
                            Mac 本地目录 ── 拷贝进离线 SDK 工程 apps/<appid>/
                                  │ Android Studio / Xcode 编译运行
                                  ▼ 真机 / 模拟器（设备同 Wi-Fi）
```

## 一、Linux 侧（只做一次配置，之后常驻）

### 0. 前置：填入 DCloud appid 与应用名

App 离线工程靠 **DCloud appid** 关联资源、申请 AppKey，**appid 不能为空、也不能随便
填写**（空值时 `dist/build/app/manifest.json` 的 `id` 为空，离线工程无法配置）。

1. 在 https://dev.dcloud.net.cn 「应用管理」创建应用（或用 HBuilderX 打开本工程
   重新获取），得到形如 `__UNI__xxxxxx` 的 appid。
2. 填到 `src/manifest.json` 顶层 `"appid"`，同时 `"name"` 填应用名。
3. 需要真机 / 登录 / 推送等能力时，也在此处与各平台后台一并配置。

> 换测试 appid 改 `src/manifest.json` 即可。该文件是 git 跟踪的源文件；本机私有
> 环境差异（如下面的 API IP）走 gitignored 的 `.env.development.local`。

### 1. API 地址改走局域网 IP

真机 / 模拟器里 `localhost` 指的不是这台 Linux。用 **`.env.development.local`**
（gitignored）覆盖：

```
VITE_API_BASE_URL=http://192.168.100.100:8080
```

换网段改这个文件即可。前提：后端运行、监听 `0.0.0.0:8080`、CORS 放开、防火墙放行
LAN 访问 8080/22。

### 2. 平台适配：把动态 import 内联进单文件（已配置，仅说明）

App service 层被 uni 强制打成单文件 `app-service.js`（IIFE）。本工程为打破循环依赖有
多处动态 `import()`（store 互引、`session ⇄ api`、wasm 等），会产生物理 chunk，
与 IIFE 冲突、直接报：

```
Invalid value "iife" for option "output.format" - UMD and IIFE output formats are not supported for code-splitting builds.
```

H5（ESM）、小程序（mp 自有格式）都不受影响，只有 App 暴露。`vite.config.ts` 里的
`zukan-inline-app-dynamic-import` 插件在最终配置阶段置 `inlineDynamicImports = true`
并清掉互斥的空 `manualChunks`，等价于 HBuilderX 内置编译器的处理。这是当前唯一的
App 编译期适配，**不要**改成在业务代码里逐处静态 import（会破坏循环依赖防护）。

### 3. 编译本地打包资源（常驻）

```bash
pnpm build:app
```

先 `copy-wasm`（把 wasm 同步进 `src/static/wasm`，随包发布），再编译到
`dist/build/app`。产物：

| 文件 / 目录 | 内容 |
|---|---|
| `app-service.js` | 单文件逻辑层（页面逻辑全部内联，约 0.33 MiB） |
| `app-config-service.js` / `app-config.js` | 全局/页面配置 |
| `app.css` + `pages/**.css` | 样式（逻辑单文件，样式按页拆分） |
| `uni-app-view.umd.js`、`__uniapp*.js` | 视图层与内置组件 |
| `manifest.json` | App 配置（`@platforms: android/iPhone/iPad`，一套资源三端共用） |
| `static/` | wasm、字体、属性/软件图标、样式等 |
| `__uniappview.html` | 启动入口（`launch_path`） |

当前产物约 **2.6 MiB / 130 个文件**。

#### 边改边重建

**不要**用 `uni build -p app --watch`：watch 会切到"运行模式"，产物落到非标准的
`dist/dev/app`（service 散到 `.sourcemap`/`.nvue`），那是给 HBuilderX 真机流程内部
用的、不能当本地资源共享。要让 `dist/build/app` 随保存更新，监听源码后**重新触发发行
构建**即可（全量构建约数秒）：

```bash
# 装了 watchexec：
watchexec -w src --ignore '*/target/*' -e ts,vue,js,css,json,scss pnpm build:app
# 或零依赖轮询（粗略）：
while true; do pnpm build:app; sleep 5; done
```

## 二、把资源同步到 Mac/Windows（二选一）

### 方案 A（推荐）：Mutagen，毫秒级实时

Mac 上：

```bash
brew install mutagen-io/mutagen/mutagen
mutagen daemon start

mutagen sync create \
  --name zukan-app \
  jacobi@192.168.100.100:~/Code/zukan/dist/build/app \
  ~/zukan-app
```

常用：`mutagen sync list`、`mutagen sync monitor zukan-app`、`mutagen sync terminate zukan-app`。
Windows 命令相同（路径写 `%USERPROFILE%\zukan-app`）。

### 方案 B（零安装）：rsync 轮询拉取

仓库已带 `scripts/remote-debug/pull-app.sh`，在 Mac 上：

```bash
# 先配免密：ssh-keygen && ssh-copy-id jacobi@192.168.100.100
bash scripts/remote-debug/pull-app.sh
```

每秒 `rsync -az --delete` 把资源镜像到 `~/zukan-app`。可用 `REMOTE` / `REMOTE_DIR` /
`LOCAL_DIR` 环境变量改地址。

> 同微信方案：不建议 sshfs/NFS 挂载后让原生工具直接读，FSE 文件事件不可靠。同步成
> 本地真实目录最稳。

## 三、Mac/Windows 侧：离线 SDK 原生工程消费（一次性配置）

**第一原则：版本严格一致。** 本机 uni-app 编译器版本是 **5.15**（见构建输出与
`manifest.json` 的 `compilerVersion`）。下载的 **App 离线 SDK 必须是同一版本**，否则
App 启动会弹「版本不一致」并可能功能异常。SDK：
https://nativesupport.dcloud.net.cn/AppDocs/download/android.html / ios.html

### Android（Android Studio）

1. 下载同版离线 SDK，解压；导入最简示例 **HBuilder-Integrate-AS**（或新建空工程，
   `minSdk ≥ 21`，注意离线 SDK 不支持 Kotlin 写入口）。
2. 按 SDK 说明配置 `lib.5plus.base` / `uniapp-v8` / `breakpad` 等 aar 与 gradle；
   4.81+ 需 `compileSdk 36` / Gradle 8.14.3 / AGP 8.12.0。
3. 把 `~/zukan-app` 的**内容**拷进工程的 `app/src/main/assets/apps/<appid>/`
   （即 SDK 模板里的资源目录，通常为 `www/`）。
4. 改 `assets/data/dcloud_control.xml` 的 `appid` 为上面的 DCloud appid，确保与
   文件夹名、`manifest.json` 的 `id` 三者一致。
5. **申请 AppKey**（3.1.10 起强制）：dev.dcloud.net.cn 后台按「appid + 包名
   applicationId + 签名证书 SHA1」申请；debug 也必须用申请时的证书（在 build.gradle
   配 signingConfigs 并挂到 debug/release）。把 AppKey 写入 AndroidManifest 的
   `application/meta-data[name=dcloud_appkey]`。
6. 连真机，AS 编译运行。

### iOS（Xcode）

1. 下载同版离线 SDK，解压；打开 **HBuilder-Hello** 工程。
2. 把 `~/zukan-app` 的**内容**拷到工程的 `Pandora/apps/<appid>/`。
3. 打开 `control.xml`，把 appid 改为 DCloud appid（与 `manifest.json` 的 `id`、
   文件夹名一致）。
4. General 里改 **Bundle Identifier**（与发布 Profile 关联的 AppID 一致）、Version/Build
   与 `manifest.json` 版本对齐；配置签名（真机）。AppKey 写入 `info.plist` 的
   `dcloud_appkey`。
5. Xcode 编译运行真机；用模拟器时在设备列表选择模拟器。

### 调试手段

- AS 的 Logcat / Xcode 控制台看原生日志；JS 异常会经 uni-stacktracey 还原。
- 视图层是 WebView：Android 用 `chrome://inspect`、iOS 用 Safari Web 检查器连入，
  在里面打 JS 断点、看 Console / Network / Storage。
- 改了代码 → Linux 重建 → 同步 → 对端重新 Run 即可加载新资源（更新内置资源时版本号
  需递增、`control.xml` 的 `debug` 正式包置 `false`）。

## 四、已知待真机验证（重要）

图鉴的 FB / 加密图片 / i18n 解密与伤害计算都依赖 **WASM**。当前 App 资源沿用
wasm-bindgen 默认的 `new URL('zukan_wasm_bg.wasm', import.meta.url)` 在**运行时**
定位 wasm（构建期有一条 `... doesn't exist at build time` 警告即此），而 wasm 实体在
`static/wasm/`。离线 App 的 service（JSCore）未必支持 `import.meta.url`，且相对路径也
对不上 `static/wasm/`。

**真机第一件事就是验证 wasm 是否加载成功**（解密/计算任一处触发即可）。若失败，需仿
微信加 App 专用加载分支：`src/infra/wasm/index.ts` 里用 `// #ifdef APP-PLUS` 以
`plus.io` 读取 `/static/wasm/zukan_wasm_bg.wasm` 字节，再交给 `__wbg_init(bytes)` 走
`WebAssembly.instantiate`（同微信思路）。

## 五、排障

| 现象 | 处理 |
|------|------|
| 构建报 iife / code-splitting | 确认 `vite.config.ts` 的内联插件仍在；别在业务里新增会被 App 保留的动态 import |
| 提示 appid 错误 / AppKey 错误 | appid、包名/Bundle ID、签名 SHA1 三者与后台一致；`control.xml`/`dcloud_control.xml` appid 与文件夹名一致；debug 用申请证书 |
| App 弹「版本不一致」 | 离线 SDK 版本与编译器 5.15 对齐 |
| 设备请求失败/空白 | `.env.development.local` IP 是否本机 IP；设备与 Linux 同 Wi-Fi；后端 0.0.0.0:8080、防火墙 |
| 解密/计算报错（wasm） | 见第四节，真机验证 wasm 加载，必要时加 APP-PLUS 读字节分支 |
| 改了资源仍是旧的 | 版本号需递增；`control.xml` debug 正式包为 false；对端 Clean/Rebuild |
| 同步报 SSH 错 | 配免密密钥；确认地址与 `REMOTE_DIR` 路径 |

## 发布（对端操作）

发布 apk/ipa 由对端 AS/Xcode 在上述离线工程上 `Archive`/打 release 包并上传各应用市场；
Linux 仍只提供 `dist/build/app` 资源、不在此打包。要发 wgt 热更包时，将 `dist/build/app`
内容压成 zip（不含外层目录）、重命名为 `${appid}.wgt`。
