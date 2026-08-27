# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 常用命令

- 安装依赖：`pnpm install`
- 启动 H5 开发服务：`pnpm dev:h5`
- 构建 H5 产物：`pnpm build:h5`
- 类型检查：`pnpm type-check`
- 单元测试：`pnpm test`（`pnpm test:watch` 进 watch 模式）
- 启动/构建小程序等平台：`pnpm dev:mp-weixin`、`pnpm build:mp-weixin` 等（`alipay`/`baidu`/`qq`/`jd`/`kuaishou`/`lark`/`toutiao`/`xhs` 同理）
- 启动/构建快应用：`pnpm dev:quickapp-webview` / `pnpm dev:quickapp-webview-huawei`（build 同理）

自动化门禁：`pnpm type-check`（必须 0 error）、`pnpm test`（vitest）、`pnpm lint`（oxlint，目前只报 warning）、
`pnpm format:check`（prettier，仅覆盖 `src/**/*.ts`；有 3 个历史文件未合规，改到它们时再顺手 `format:write`）。
项目在 devDependencies 里配置了 stylelint，但**没有暴露对应的 package script**。

### 测试约定

- 配置在 `vitest.config.ts`，**刻意不复用 `vite.config.ts`** —— 后者装了
  `@dcloudio/vite-plugin-uni`，插件要求完整的 uni-app 上下文（pages.json、manifest.json、
  平台环境变量），在 node 测试环境跑不起来。
- 用例放 `tests/*.spec.ts`，已纳入 `tsconfig.json` 的 include，所以 `type-check` 也管测试代码。
- 环境是 `node`，**没有** uni 全局。要覆盖 `uni.getStorageSync` 这类平台 API 时在用例里
  `vi.stubGlobal('uni', …)`（`tests/favorites.spec.ts` 有一份与 uni-h5 语义一致的 storage stub 可抄）。
- **测数据要跨越分页边界。** 图鉴的核心 bug 就是"筛选只作用于首页 20 条"，数据集小于
  一页的用例根本发现不了。同理属性筛选的测试数据必须含双属性宝可梦，否则
  `some` / `every`（OR / AND）在单属性数组上等价，测不出区别 —— 这两个盲区都是变异测试查出来的。
- **写完用例把 bug 注回去确认它变红。** 绿灯本身不证明用例有效。

## 环境变量

- `VITE_API_BASE_URL` — zukan-server 地址（含协议，末尾无斜杠）。`src/services/*`（含 `resources/resourceManager.ts`、`resources/spriteCache.ts`）均通过该变量拼接远端 URL。仓库根目录提供 `.env.development` 作为本地默认值（`http://localhost:8080`）；若连远端服务需自行覆盖。

## 架构概览

这是一个基于 Vue 3、uni-app 和 Vite 的宝可梦图鉴应用。`src/main.ts` 创建 SSR app，安装 Pinia，注册 `uni-icons`，并引入 `src/static/styles/global.css`。`vite.config.ts` 启用 uni-app Vite 插件，开发服务端口为 4000，并将 `@/*` 映射到 `src/*`；`tsconfig.json` 中也配置了同样的路径别名。

路由由 uni-app 的 `src/pages.json` 控制，不使用 Vue Router。当前注册的页面：

| 页面 | 路径 | 状态 |
|------|------|------|
| 图鉴列表 | `pages/index/index` | 主页面 |
| 宝可梦详情 | `pages/detail/detail` | 键页 |
| 功能中心 | `pages/features/features` | 导航枢纽 |
| 资料中心 | `pages/data/data` | 键页 |
| 个人中心 | `pages/mine/mine` | 键页 |
| 伤害计算器 | `pages/calc/calc` | 键页（计算引擎在 `calc-engine.ts`） |
| 能力值计算器 | `pages/statcalc/statcalc` | 键页（纯 TS 能力值公式在 `statcalc-engine.ts`，性格表在 `statcalc-options.ts`） |
| 对战模拟器 | `pages/simulate/simulate` | **UI 骨架**（`noop` 占位，无实际交互） |
| 设置 | `pages/settings/settings` | 子页（`DetailNavbar`，语言等系统设置；点选项弹 `OptionSheet`） |

`src/pages/` 下没有其他游离页面文件。

主列表流程集中在 `src/pages/index/index.vue`。该页面从 Pinia store 加载数据，在页面级状态中组合搜索、类型筛选、仅收藏、世代筛选和排序，把条件推给 store，再由 `VirtualGrid` 虚拟化渲染 `PokemonCard` 列表（已无分页 / 无限滚动）。顶部导航和底部 TabBar 分别封装为 `NavBar.vue` 和 `TabBar.vue`；TabBar 使用 `uni.reLaunch` 切换页面，并通过 storage key 在页面间播放指示器滑动动画。

宝可梦数据来自加密的 FlatBuffers bundle：`src/services/resources/resourceManager.ts` 下载 `/assets/encrypted/fb/gen-N.bin`（三层缓存 memory LRU → binaryStorage 即 IndexedDB → 网络），WASM 解密后由 `src/services/pokemon/pokemon.ts` 把四张并行表（`baseEntries`/`statEntries`/`typeEntries`/`abilityEntries`；`eggGroupEntries` 被解码但未使用）按 id join 成 UI 模型。注意 **gen-N.bin 是"全物种在第 N 世代的数值快照"**（1351 条形态 / 1025 个默认形态，id 从 1 起），不是"第 N 世代新增的宝可梦"。`mergeBundleToModel` 返回的 `IPokemonBaseModel` 中 `name` 当前为 `'pokemon-{id}'` 占位符，`image` 为 `/static/default.png` —— 卡面图来自 `EncryptedSprite`，不是 model 字段。

`src/store/pokemon.ts` 用 setup 风格 Pinia store 封装：**对 `defaultPokemons`（按 species 去重后的 ~1025 条）筛选排序**得到 `matchedPokemons`（`src/utils/dexFilter.ts`），**不分页**——列表渲染交给 `dex/VirtualGrid.vue` 定高虚拟化，DOM 只保留视口附近的行。页面只通过 `setCriteria()` 推条件（全量替换，不是 merge）。历史坑：早先是"先分页再筛选"，选任意非第一世代会把首页 20 条全滤掉 → 列表空 → 容器无内容 → 滚动不触发 → 死锁。收藏走 `uni.getStorageSync`（兼容小程序），并兼容早期裸 `localStorage` 写下的 JSON 字符串。默认 gen 是 9（`DEFAULT_GEN_ID = 9`），与 `LATEST_GEN_ID = 9`（`boot.ts`）保持一致。

sprite 图片走独立通道：`EncryptedSprite.vue` 只管视口检测，缓存 / 解密 / Blob URL 生命周期在 `src/services/resources/spriteCache.ts` —— **模块级共享 + 引用计数**，`refs > 0` 的条目不会被 LRU 撤销（撤销即裂图）。列表默认懒加载（进视口前不下载，首屏约 6 张卡可见，一屏 20 张约 2.5 MB），必然可见的场景传 `eager`。跨刷新缓存由 `spritePersist.ts` 补充（IndexedDB 存 ZKDX 密文，非 IDB 后端 no-op）。

### 缓存层级总览

| 缓存 | 文件 | 层级 | 持久化 | 版本失效 |
|------|------|------|--------|----------|
| FB bundle 解码结果 | `resourceManager.ts` | 内存 LRU（12 条） | — | 版本号变化 |
| FB bundle 密文 | `resourceManager.ts` via `binaryStorage` | IndexedDB | 跨刷新 | `pruneOtherVersions` |
| sprite Blob URL | `spriteCache.ts` | 内存 LRU（200 条） | — | 刷新即清空 |
| sprite 密文 | `spritePersist.ts` via `binaryStorage` | IndexedDB（仅 IDB 后端） | 跨刷新 | `pruneSpriteVersions` |
| 密钥 DEK | `session/key.ts` | 内存单例 | — | 登出 / 403 重签 |

### sprite 下载调度（spriteCache 三条不变量）

1. **限流 4 并发**。不限流时几十个请求同时丢给浏览器，浏览器 FIFO 排队，
   当前视口排在已划过去的行后面。
2. **批内 FIFO，批间 LIFO**。`batch` 每帧自增，取任务时 batch 最大优先、
   同批 seq 最小优先。纯 LIFO 会让首屏「从下往上」冒；纯 FIFO 则退回原 bug。
3. **离屏取消**。`EncryptedSprite` 的 IntersectionObserver **不是一次性的** ——
   滑出视口要 abort 腾出槽位（不取消的话已划走的下载会占槽 100–300ms）。
   多 waiter 时只有 waiters 归零才真取消，否则列表卡片卸载会连累详情页。

### sprite 跨刷新缓存（spritePersist 四条不变量）

1. **落盘的是 ZKDX 密文，不是解密后的 PNG。** 存明文等于把加密资源以可直接使用的
   形式留在用户磁盘上，加密链路白做。
2. **只在 `storageBackend === 'idb'` 启用。** 小程序 `uni.setStorage` 总量约 10MB，
   塞 sprite 会把 FB 主数据顶出配额；非 IDB 时全模块 no-op。
3. **索引（localStorage）与数据（IDB）是两条独立写入，必然会不一致。** 两个方向都要兜：
   索引有数据没有 → 按 miss 走网络并摘掉幽灵项；数据有索引没有 → `reconcile()` 开局对账删孤儿。
4. **`clearSpriteCache()`（登出）刻意不清磁盘** —— 密文没 DEK 解不开，不构成泄露，
   留着下次登录还能命中。版本升级走 `resourceManager.pruneOtherVersions`。

### 认证与会话（`src/services/session/`）

`getKey()` 是全 app 拿 DEK 的唯一入口（boot、resourceManager、spriteCache 共 3 个调用点，403 重试时各再调一次）。
401 恢复策略收敛在这里，而不是散在每个调用点：

```
401 UNAUTHENTICATED
  ├─ 本地有 refresh token → authApi.refresh() → 重试一次
  │    └─ refresh 也失败 → clearSession() → 弹登录层
  └─ 无 refresh token     → 弹登录层 → 登录成功后重试
```

用户关闭登录层则抛 `LoginDismissedError`，调用方应**静默降级**（不重试、不报错）。
`authGate` 是模块级单例（不是 Pinia store，否则会形成 `store ⇄ session` 循环依赖），
负责去重登录弹层 —— 6 个 `getKey` 调用点不会各开一个弹窗。

`keyPromise` 的清理必须挂在 `.finally` 上（`key.ts:102-105`）：
`.catch` 返回新 promise，回调在微任务里才跑，期间进来的并发调用者会复用注定 reject 的 promise。

### 当前已知的占位 / 模拟数据

- `pokemon.ts:mergeBundleToModel` 的 `image` 为 `/static/default.png`（卡面图走 `EncryptedSprite`），
  `description` 为空，`moves`/`evolutionChain` 为空数组。物种名/形态名/特性名已接通 i18n
  名称组（见 `docs/i18n/`），i18n 未就绪时回落 `pokemon-{id}` / `form-{id}` 占位。
- `simulate.vue` 是纯 UI 骨架，所有交互 handler 都是 `noop`。
- `src/core/data/typechart.ts` 被 `calc-engine.ts` 动态 import，是移除的服务端模块的残留。

### 循环依赖注意事项

- `session/key.ts` 动态 import `api/auth.ts` —— 避免 `session ⇄ api` 顶层环。
- `authGate` 是模块单例而非 Pinia store —— 避免 `store ⇄ session` 环。
- `clearSpriteCache()` 在 `mine.vue` 的登出路径调用，而非 `clearSession()` 内部 —— 避免 `session ⇄ resources` 环。

全局宝可梦接口声明在 `src/pokemon.d.ts`，因此许多 `.vue` 文件会直接使用 `IPokemonBaseModel` 和 `IPokemonCardModel`，无需显式导入。`src/model/` 存放更底层的数据模型和枚举，例如基础种族值和属性定义。

样式主要写在 Vue 模板中的 Tailwind utility class 中，少量组件使用 scoped SCSS/CSS 处理尺寸或动画。`tailwind.config.js` 配置了宝可梦属性颜色，并扫描 `index.html` 和所有源码 Vue/TS/JS 文件。导航栏尺寸相关的共享 CSS 变量定义在 `src/App.vue`，被 `NavBar` 和页面布局 padding 复用。

静态资源位于 `src/static/`。uni-app 模板和数据中的静态资源通常使用 `/static/...` 路径引用。

### `docs/` 目录

按主题分类，入口是 `docs/README.md`（索引）。改哪块读哪块：

- `docs/architecture/` — 架构总览、测试约定
- `docs/ui/` — 组件化约定、scoped CSS / `<script setup>` 陷阱、VirtualGrid 定高耦合
- `docs/data/` — FlatBuffers bundle 解码与五表 join、三套 id 空间、筛选排序收藏
- `docs/i18n/` — 多语言 names/flavor bundle、UI/内容双语言、回落策略
- `docs/features/` — 伤害计算器数据流（改 calc 前必读）
- `docs/security/` — ZKDX 加密全链路、DEK 认证与会话
- `docs/caching/` — resourceManager 三层缓存、spriteCache/spritePersist 不变量
- `docs/archive/` — 旧文档（早期加密稿、解密稿、旧架构图、REST/encrypted-assets 归档稿），不再维护

## 组件化约定（写新页面时必须遵守）

**先建组件，再写页面。不要先把整页代码堆在 `.vue` 里之后再回头拆。**

### 目录划分

```
src/components/
  shared/    跨页面通用：TabPageShell、ListRow、DetailNavbar、
             FavoriteButton、PokeballLogo、LoginModal、OptionSheet
  pokemon/   宝可梦领域：PokemonCard、TypeBadge、SpecimenHero、
             InfoGrid/InfoCard、StatsChart、MovesList、MoveCard、EvolutionChain
  dex/       图鉴列表上下文：DexToolbar、FilterBar、GenerationDrawer、
             DexEmptyState、FavoritesBanner、VirtualGrid
  calc/      计算器上下文：CalcCard、ChipRow、LevelStepper、
             DamageResultCard、CalcSideCard、StatInputRow
  sprite/    图片加载：EncryptedSprite
  (根目录)    NavBar、TabBar（跨页面底栏 / 顶栏，非 shared 子目录）
src/constants/   跨文件共享的数据表（pokemonTypes、generations）
src/pages/<name>/<name>-options.ts   仅该页用的选项/常量表
```

新组件放进已有目录；只有确实出现新的业务上下文时才开新目录。

### 写页面前先套用现成件

- **tab 页**（features/data/mine 这类）直接用 `<TabPageShell title="…" :tabIndex="N">`，
  不要重新写 NavBar + padding + TabBar 骨架
- **详情类页**用 `DetailNavbar` + `SpecimenHero` + `InfoGrid`/`InfoCard`（`detail.vue` 就是标准模板）
- **列表行**用 `ListRow`（配 `list-row__icon--*` 配色）；**属性徽章**用 `TypeBadge`
- **单选/多选设置项**弹 `OptionSheet`（底部滑出，支持对勾、副标题、loading、多选确认），
  不要用 `uni.showActionSheet`（不支持多选/副标题/自定义样式）。非 tab 子页用
  `DetailNavbar` + `uni.navigateTo`（参考 `pages/settings/`）
- **表单/选项分组**用 `CalcCard` + `ChipRow` + `LevelStepper`
- 容器样式用 global.css 已有的 `glass-panel`、`archive-section`、`section-label`，
  不要新写等价的 scoped 版本

### 硬性规则

1. **拆不拆组件看「数据隔离」和「可复用」，不看行数。** 满足任一条就抽组件：
   - **能与页面其余部分数据隔离** —— 这块 UI 靠 props 进、events 出，自身闭环一片
     状态/逻辑，抽出去后页面不再关心它的内部状态；
   - **会被复用** —— 第二个地方（现在或可预见）要用同一段模板/CSS/交互，
     就抽组件，不要复制粘贴后微调（上次重构删掉的 1000+ 行几乎全是这种重复）。
   反过来，单纯行数大、但状态与页面深度耦合又无复用的内联块，不必为凑「短文件」硬拆。
   页面始终只留：数据获取、页面级状态编排、组件组装。
2. **配色/名称等数据表只能有一处定义。** 属性相关的一律从
   `src/constants/pokemonTypes.ts` 取（`getTypeColor`/`getTypeLabel`/`getTypeShort`），
   世代号段从 `src/constants/generations.ts` 取。不要在页面里再写一份 map。
3. **不要给组件加没人读的 prop / 字段。** 传了但组件不消费的 prop 是死代码，
   `type-check` 抓不到。`store/pokemon.ts` 的 `formattedId` 就是活例子 —— 没有组件读它。
4. **命名避免撞车。** 组件名要能反映用途，`calc/PokemonCard.vue` 这种与
   `pokemon/PokemonCard.vue` 同名但语义无关的必须改名（已改为 `CalcSideCard`）。

### scoped CSS 的特异性陷阱（踩过两次）

如果基础规则（`.list-row__icon`）在组件的 `scoped` 里，而配色变体
（`.list-row__icon--gold`）经 prop 从页面传入、定义在 global.css，
那么编译后 `.list-row__icon[data-v-xxx]` 是 (0,2,0)，会盖掉变体的 (0,1,0)，
变体的 `color` 失效。

**规则：基础规则和它的变体必须同处一个作用域** —— 要么都在组件 scoped 里
（`InfoCard.vue` 的 `.info-card__icon--*` 走这条），要么都在 global.css 里
（`.list-row__icon*` 走这条）。

同理：**slot 内容由父组件渲染，带的是父组件的 scope id**，子组件的 scoped
样式选不中它；跨组件共用的动画/样式（如 `.field-loader`）要放 global.css。

### 弹层关闭要直接 `v-if` 卸载，别靠 `transitionend`（踩过一次）

给遮罩/弹层做退出动画时，常见写法是 `v-if="mounted"` + 监听面板的
`transitionend` 再把 `mounted` 置 false。**在 uni-app H5 的 `<view>` 上
`transitionend` 不可靠**（`propertyName` 匹配尤其不稳），结果节点不卸载：
遮罩变透明但 `pointer-events: auto` 还在，全屏盖住下层，把背后的按钮点击吃掉。
`OptionSheet` 因此出现"弹一次选择框、关掉后设置页返回按钮失灵"。

**规则：弹层用 `v-if="visible"` 关闭即卸载，入场用 CSS `animation`，不做退出过渡。**
这是 `LoginModal` 已验证可靠的模式。要等退出动画播完，得在 DOM 元素（非 uni 组件）
上自己绑 transitionend 并兜底 setTimeout，复杂度不值得——直接卸载。

### `<script setup>` 顶层不是模块作用域（踩过一次，两个 bug）

写在 `<script setup>` 顶层的 `const cache = new Map()` 看着像模块级单例，
编译后**落在 `setup()` 内部** —— 每个组件实例一份：

```js
setup(__props) {
  const decryptedCache = new Map();   // ← 每实例独立，不是共享
```

`EncryptedSprite` 因此同时踩了两个坑：缓存命中率恒为 0（实例只查自己那一个 key），
以及 `if (!cache.has(key))` 守卫恒假导致 `revokeObjectURL` 从不执行、Blob URL
永久泄漏。`type-check` 看不见这类问题。

**规则：需要跨实例共享的状态（缓存、连接池、引用计数）一律放独立 `.ts` 模块**，
组件只调用它的 API。核对方法是拉一次编译产物，确认 `const` 在顶层而不是 `setup(` 之后。

### 虚拟列表的定高耦合（VirtualGrid）

`dex/VirtualGrid.vue` 是**定高**虚拟化：窗口计算假设同一断点内每张 `PokemonCard`
高度恒定（实测值 98px @ mobile / 106px @ ≥640px，但已改为运行时用首个渲染子元素实测，
不硬编码），用 `computeVirtualWindow` 纯函数按行算偏移。列数与 gap 不写在 JS 里 ——
从 `getComputedStyle(grid).gridTemplateColumns` 读回来，断点只在 `grid-class` 里定义一次。

**改 `PokemonCard` 高度前先想清楚**：多行名称、可变徽章数、动态内容都会打破定高假设，
导致卡片重叠或滚动条长度错误。届时要么改成逐项测量的虚拟化（`ResizeObserver` 报高 +
前缀和定位），要么退回 `content-visibility: auto`（它跳绘制但保留全部实例）。
窗口算术的 off-by-one / 越界由 `tests/virtualWindow.spec.ts` 守着，改算法先跑它。

### 每次改完必做

1. `pnpm type-check` —— 必须 0 error
2. `pnpm test` —— 必须全绿；改了 `src/utils/dexFilter.ts`、`src/store/pokemon.ts`、
   `src/constants/generations.ts`、`src/services/resources/spriteCache.ts` 或
   `src/services/resources/spritePersist.ts` 时尤其别跳过
3. `pnpm dev:h5` 起服务后用**移动端 UA** curl 一遍改动的页面与组件，确认 200：
   ```bash
   UA='Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko)'
   curl -s -o /dev/null -w '%{http_code}' -H "User-Agent: $UA" http://localhost:4000/src/pages/xxx/xxx.vue
   ```
4. 涉及 CSS 变量绑定或 scoped 改写时，额外拉一次编译产物核对
   （`?vue&type=style&index=0&scoped=true&lang.css`）—— 这类问题 `type-check` 看不见