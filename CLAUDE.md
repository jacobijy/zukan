# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 常用命令

- 安装依赖：`pnpm install`
- 启动 H5 开发服务：`pnpm dev:h5`
- 构建 H5 产物：`pnpm build:h5`
- 类型检查：`pnpm type-check`
- 单元测试：`pnpm test`（`pnpm test:watch` 进 watch 模式）
- 启动小程序等平台开发构建：`pnpm dev:mp-weixin`、`pnpm dev:mp-alipay`、`pnpm dev:mp-baidu`、`pnpm dev:mp-qq` 等
- 构建小程序等平台产物：`pnpm build:mp-weixin`、`pnpm build:mp-alipay`、`pnpm build:mp-baidu`、`pnpm build:mp-qq` 等

自动化门禁：`pnpm type-check`（必须 0 error）、`pnpm test`（vitest）、`pnpm lint`（oxlint，目前只报 warning）、
`pnpm format:check`（prettier，仅覆盖 `src/**/*.ts`；有 3 个历史文件未合规，改到它们时再顺手 `format:write`）。
项目配置了 Stylelint，但没有暴露对应的 package script。

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

路由由 uni-app 的 `src/pages.json` 控制，不使用 Vue Router。当前注册的页面包括图鉴列表、详情、功能中心、资料中心和个人中心。`src/pages/` 下还存在一些额外页面文件（例如 calc/simulate/contact），但它们目前没有注册到 `pages.json`；如果需要依赖这些页面跳转，先把对应页面加入 `pages.json`。

主列表流程集中在 `src/pages/index/index.vue`。该页面从 Pinia store 加载数据，在页面级状态中组合搜索、类型筛选、仅收藏、世代筛选和排序，把条件推给 store，再由 `VirtualGrid` 虚拟化渲染 `PokemonCard` 列表（已无分页 / 无限滚动）。顶部导航和底部 TabBar 分别封装为 `NavBar.vue` 和 `TabBar.vue`；TabBar 使用 `uni.reLaunch` 切换页面，并通过 storage key 在页面间播放指示器滑动动画。

宝可梦数据来自加密的 FlatBuffers bundle：`src/services/resources/resourceManager.ts` 下载 `/assets/encrypted/fb/gen-N.bin`（三层缓存 memory LRU → binaryStorage → 网络），WASM 解密后由 `src/services/pokemon/pokemon.ts` 把五张并行表按 id join 成 UI 模型。注意 **gen-N.bin 是"全物种在第 N 世代的数值快照"**（1351 条形态 / 1025 个默认形态，id 从 1 起），不是"第 N 世代新增的宝可梦"。

`src/store/pokemon.ts` 用 setup 风格 Pinia store 封装：**对全量筛选排序**得到 `matchedPokemons`（`src/utils/dexFilter.ts`），**不分页**——列表渲染交给 `dex/VirtualGrid.vue` 定高虚拟化，DOM 只保留视口附近的行。页面只通过 `setCriteria()` 推条件。历史坑：早先是"先分页再筛选"，选任意非第一世代会把首页 20 条全滤掉 → 列表空 → 容器无内容 → 滚动不触发 → 死锁。收藏走 `uni.getStorageSync`（兼容小程序），并兼容早期裸 `localStorage` 写下的 JSON 字符串。

sprite 图片走独立通道：`EncryptedSprite.vue` 只管视口检测，缓存 / 解密 / Blob URL 生命周期在 `src/services/resources/spriteCache.ts` —— **模块级共享 + 引用计数**，`refs > 0` 的条目不会被 LRU 撤销（撤销即裂图）。列表默认懒加载（进视口前不下载，首屏立即下载量减约 67%），必然可见的场景传 `eager`。

全局宝可梦接口声明在 `src/pokemon.d.ts`，因此许多 `.vue` 文件会直接使用 `IPokemonBaseModel` 和 `IPokemonCardModel`，无需显式导入。`src/model/` 存放更底层的数据模型和枚举，例如基础种族值和属性定义。

样式主要写在 Vue 模板中的 Tailwind utility class 中，少量组件使用 scoped SCSS/CSS 处理尺寸或动画。`tailwind.config.js` 配置了宝可梦属性颜色，并扫描 `index.html` 和所有源码 Vue/TS/JS 文件。导航栏尺寸相关的共享 CSS 变量定义在 `src/App.vue`，被 `NavBar` 和页面布局 padding 复用。

静态资源位于 `src/static/`，其中包含大量 `src/static/img/` 图片资源和默认图片。uni-app 模板和数据中的静态资源通常使用 `/static/...` 路径引用。

## 组件化约定（写新页面时必须遵守）

**先建组件，再写页面。不要先把整页代码堆在 `.vue` 里之后再回头拆。**

### 目录划分

```
src/components/
  shared/    跨页面通用：TabPageShell、ListRow、DetailNavbar、
             FavoriteButton、PokeballLogo、LoginModal
  pokemon/   宝可梦领域：PokemonCard、TypeBadge、SpecimenHero、
             InfoGrid/InfoCard、StatsChart、MovesList、EvolutionChain
  dex/       图鉴列表上下文：DexToolbar、FilterBar、GenerationDrawer、
             DexEmptyState、FavoritesBanner、VirtualGrid
  calc/      计算器上下文：CalcCard、ChipRow、LevelStepper、
             DamageResultCard、CalcSideCard
  sprite/    图片加载：EncryptedSprite
src/constants/   跨文件共享的数据表（pokemonTypes、generations）
src/pages/<name>/<name>-options.ts   仅该页用的选项/常量表
```

新组件放进已有目录；只有确实出现新的业务上下文时才开新目录。

### 写页面前先套用现成件

- **tab 页**（features/data/mine 这类）直接用 `<TabPageShell title="…" :tabIndex="N">`，
  不要重新写 NavBar + padding + TabBar 骨架
- **详情类页**用 `DetailNavbar` + `SpecimenHero` + `InfoGrid`/`InfoCard`
- **列表行**用 `ListRow`（配 `list-row__icon--*` 配色）；**属性徽章**用 `TypeBadge`
- **表单/选项分组**用 `CalcCard` + `ChipRow` + `LevelStepper`
- 容器样式用 global.css 已有的 `glass-panel`、`archive-section`、`section-label`，
  不要新写等价的 scoped 版本

### 硬性规则

1. **页面文件控制在 ~300 行以内。** 超了说明该拆组件了，不是等重构时再说。
   页面只留：数据获取、页面级状态编排、组件组装。
2. **同一段模板或 CSS 出现第二次就抽组件**，不要复制粘贴后微调。
   本次重构删掉的 1000+ 行几乎全是这种重复。
3. **配色/名称等数据表只能有一处定义。** 属性相关的一律从
   `src/constants/pokemonTypes.ts` 取（`getTypeColor`/`getTypeLabel`/`getTypeShort`），
   世代号段从 `src/constants/generations.ts` 取。不要在页面里再写一份 map。
4. **不要给组件加没人读的 prop / 字段。** 传了但组件不消费的 prop 是死代码，
   `type-check` 抓不到（`data.vue` 的 `valueClass` 就这样静默失效了很久）。
5. **命名避免撞车。** 组件名要能反映用途，`calc/PokemonCard.vue` 这种与
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
高度恒定（实测 98px @ mobile / 106px @ ≥640px），用 `computeVirtualWindow` 纯函数
按行算偏移。列数与 gap 不写在 JS 里 —— 从 `getComputedStyle(grid).gridTemplateColumns`
读回来，断点只在 `grid-class` 里定义一次。

**改 `PokemonCard` 高度前先想清楚**：多行名称、可变徽章数、动态内容都会打破定高假设，
导致卡片重叠或滚动条长度错误。届时要么改成逐项测量的虚拟化（`ResizeObserver` 报高 +
前缀和定位），要么退回 `content-visibility: auto`（它跳绘制但保留全部实例）。
窗口算术的 off-by-one / 越界由 `tests/virtualWindow.spec.ts` 守着，改算法先跑它。

### 每次改完必做

1. `pnpm type-check` —— 必须 0 error
2. `pnpm test` —— 必须全绿；改了 `src/utils/dexFilter.ts`、`src/store/pokemon.ts`、
   `src/constants/generations.ts` 或 `src/services/resources/spriteCache.ts`
   时尤其别跳过（筛选/分页/号段/Blob URL 生命周期的回归都靠它守）
3. `pnpm dev:h5` 起服务后用**移动端 UA** curl 一遍改动的页面与组件，确认 200：
   ```bash
   UA='Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko)'
   curl -s -o /dev/null -w '%{http_code}' -H "User-Agent: $UA" http://localhost:4000/src/pages/xxx/xxx.vue
   ```
4. 涉及 CSS 变量绑定或 scoped 改写时，额外拉一次编译产物核对
   （`?vue&type=style&index=0&scoped=true&lang.css`）—— 这类问题 `type-check` 看不见

