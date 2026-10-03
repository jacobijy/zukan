# AGENTS.md

给 AI agent（Claude Code 等）的仓库工作指引。本文件只放**必须始终遵守的规则、常用命令、
架构入口、改动后的门禁**；实现细节都在 `docs/`，索引见 [docs/README.md](docs/README.md)。

## 常用命令

- 安装依赖：`pnpm install`
- 启动 H5 开发服务：`pnpm dev:h5`（端口 4000）
- 构建 H5 产物：`pnpm build:h5`
- 构建 App（Android/iOS）本地打包资源：`pnpm build:app`（产物 `dist/build/app`，一套资源三端共用）
- 类型检查：`pnpm type-check`
- 单元测试：`pnpm test`（`pnpm test:watch` 进 watch 模式）
- 启动/构建小程序等平台：`pnpm dev:mp-weixin`、`pnpm build:mp-weixin` 等（`alipay`/`baidu`/`qq`/`jd`/`kuaishou`/`lark`/`toutiao`/`xhs` 同理）
- mp-weixin 后台常驻 watch：`pnpm dev:mp:watch`（幂等；`--status` / `--stop`）；长期常驻推荐
  systemd 看门狗 `zukan-mp-watch.service`（watch 缺失自动拉起、「聋」时抓现场再重启）。
  详见 [docs/architecture/mp-weixin-remote-debug.md](docs/architecture/mp-weixin-remote-debug.md)
- 启动/构建快应用：`pnpm dev:quickapp-webview` / `pnpm dev:quickapp-webview-huawei`（build 同理）

门禁命令：`pnpm type-check`（必须 0 error）、`pnpm test`（vitest）、`pnpm lint`
（oxlint，目前只报 warning）、`pnpm format:check`（prettier，仅覆盖 `src/**/*.ts`；
有 3 个历史文件未合规，改到它们时顺手 `format:write`）。

## 环境变量

- `VITE_API_BASE_URL` — zukan-server 地址（含协议，末尾无斜杠）。`src/services/*`
  （含 `resources/resourceManager.ts`、`resources/spriteCache.ts`）均通过该变量拼接远端 URL。
  仓库根目录提供 `.env.development` 作为本地默认值（`http://localhost:8080`），连远端需自行覆盖。

## 必须始终遵守的规则

组件与 UI：

- **先建组件，再写页面**，不要先堆整页再回头拆；拆不拆看「数据隔离 / 可复用」不看行数。
  目录划分与现成件清单见 [docs/ui/component-conventions.md](docs/ui/component-conventions.md)。
- **配色 / 世代等数据表单一定义**：属性走 `src/constants/pokemonTypes.ts`，世代走
  `src/constants/generations.ts`，不要在页面里复制 map；不要加没人读的 prop。
- **跨实例共享的状态（缓存 / 连接池 / 引用计数）放独立 `.ts` 模块**，不要写在
  `<script setup>` 顶层（编译后落在 `setup()` 内，每实例一份）。
- **scoped CSS 的基础规则与配色变体必须同处一个作用域**；slot 内容带父组件 scope id，
  子组件 scoped 选不中。
- **弹层用 `v-if="visible"` 关闭即卸载**，入场用 CSS `animation`，不靠 `transitionend`
  做退出过渡（uni-app H5 上不可靠）。
- **新页面根节点绑 `usePageSafeArea()`**（用 TabPageShell / ArchiveListShell 的页面壳已内置）；
  顶部占位只用 `var(--navbar-total-height)`，不硬编码、不自己读系统信息。
  详见 [docs/ui/safe-area.md](docs/ui/safe-area.md)。

缓存与加密图片：

- **加密图片调度遵守 imageCache 三不变量、持久化遵守 imagePersist 四不变量**
  （限流 4 并发 / priority 压过 batch / 离屏取消；只落密文 / 按后端启用 / 索引数据双向自愈 /
  登出不清盘），全部缓存速查见 [docs/caching/overview.md](docs/caching/overview.md)。
- **加密图片只在 404 时回落**，解密失败等真故障立即抛出；`hasSprite` prop 是三态，
  缺省必须保持 `undefined`（Vue 会把缺席的 Boolean prop 隐式置 false）。

依赖方向与平台：

- **断环靠依赖方向本身（注入 resolver / 纯函数 + 回调），不用动态 `import()`** ——
  小程序端动态 import 被错编成 `await "字符串"`，整体失效。`meta/moveRefs.ts` 是已知例外
  （仅 H5 调用链使用），接进小程序前必须改静态引入。
- **dev-only 页走「页壳 + 守卫块内字面量动态 import 实现体」**，门禁单点
  `src/services/devtools/enabled.ts`；只能拉构建产物 grep 核对，type-check 与用例都看不见。
- **登出清缓存在 `mine.vue` 路径调 `clearSpriteCache()`**，不放进 `clearSession()`
  （避免 `session ⇄ resources` 环）。

## 架构入口

- 技术栈：Vue 3 `<script setup>` + uni-app（编译 H5 / 各小程序 / 快应用 / App）+ Vite + Pinia + Tailwind；Rust → WASM 负责解密 ZKDX、解码 FlatBuffers、伤害计算。
- 入口文件：`src/main.ts`（建 app、装 Pinia / uni-icons、引 global.css）；`src/pages.json`
  控路由（无 Vue Router）；`src/App.vue` 定义导航尺寸共享 CSS 变量；`src/pokemon.d.ts`
  声明全局 `IPokemonBaseModel` / `IPokemonCardModel`（.vue 里无需导入）。
- 主数据流：加密 FlatBuffers bundle → `resourceManager` 三层缓存（内存 LRU → IDB/存储 → 网络）
  → WASM 解密解码 → `pokemon.ts` 五表 join → `store/pokemon` 全量筛选排序（不分页）
  → `VirtualGrid` 定高虚拟化。sprite / 道具 / 对战图标走独立加密图片通道。
- **页面权威清单与 tab 保活机制**：[docs/architecture/overview.md](docs/architecture/overview.md)
  「页面清单」。
- 改哪块读哪块（数据建模 / 多语言 / 认证加密 / 平台构建 / UI 陷阱）：[docs/README.md](docs/README.md)。

## 改动后的门禁

1. `pnpm type-check` —— 必须 0 error。
2. `pnpm test` —— 必须全绿。改 `dexFilter.ts`、`store/pokemon.ts`、`constants/generations.ts`、
   或加密图片资源层（`services/resources/imageCache.ts`、`imagePersist.ts`、`imageKind.ts`、
   `spriteCache.ts`、`spritePersist.ts`、`itemImage.ts`、`spriteLoader.ts`、
   `spriteAvailability.ts`、`imageMime.ts`、`constants/spriteVariants.ts`、
   `constants/cacheConfig.ts`、`infra/storage/binaryStorage.ts`、`composables/useEncryptedImage.ts`、
   `services/devtools/assetProbe.ts`）时尤其别跳过。
3. `pnpm lint`、`pnpm format:check`。
4. `pnpm dev:h5` 起服务后，用**移动端 UA** curl 改动的页面与组件，确认 200：
   ```bash
   UA='Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko)'
   curl -s -o /dev/null -w '%{http_code}' -H "User-Agent: $UA" http://localhost:4000/src/pages/xxx/xxx.vue
   ```
5. 涉及 CSS 变量绑定 / scoped 改写 / dev-only 代码时，额外拉编译产物核对
   （样式请求 `?vue&type=style&index=0&scoped=true&lang.css`；dev-only 用
   `pnpm build:h5 && grep -rl "<实现体标识>" dist/build/h5` 应无命中）——这类问题 type-check 看不见。
