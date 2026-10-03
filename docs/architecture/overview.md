# 架构总览

基于 Vue 3 + uni-app + Vite 的宝可梦图鉴，加密 FlatBuffers bundle 为数据源，
WASM 运行时解密/解码，Pinia 管状态，定高虚拟化渲染长列表。

## 技术栈

- **Vue 3 `<script setup>`** + **uni-app**（一套代码编译 H5 / 各平台小程序 / 快应用）
- **Vite** 构建，`@dcloudio/vite-plugin-uni`
- **Pinia**（setup 风格）
- **Tailwind CSS**（属性颜色在 `tailwind.config.js`）
- **Rust → WASM**：解密 ZKDX、解码 FlatBuffers、伤害计算
- **Vitest**（node 环境，刻意独立于 vite.config.ts）

## 目录结构

```
src/
├── main.ts                    # 入口：创建 app，装 Pinia/uni-icons，引 global.css
├── App.vue                    # 根组件，定义导航栏尺寸等共享 CSS 变量
├── pokemon.d.ts               # 全局宝可梦接口（IPokemonBaseModel 等，无需导入）
├── pages/                     # 页面路由（pages.json 控制，无 Vue Router）；完整清单见下「页面清单」
├── components/                # 按业务上下文分目录
│   ├── shared/                #   跨页面通用：TabPageShell/DetailNavbar/ListRow/...
│   ├── pokemon/               #   宝可梦领域：PokemonCard/TypeBadge/SpecimenHero/...
│   ├── dex/                   #   图鉴列表：VirtualGrid/DexToolbar/FilterBar/...
│   ├── calc/                  #   计算器：CalcCard/ChipRow/LevelStepper/...
│   ├── sprite/EncryptedSprite.vue
│   ├── NavBar.vue             #   跨页面顶栏
│   └── TabBar.vue             #   跨页面底栏
├── services/
│   ├── boot.ts                #   启动：版本号、DEK、prune 旧版本缓存
│   ├── api/                   #   后端 REST 封装（auth/favorites/zukanKey）
│   ├── http/                  #   请求层（request.ts / binaryRequest.ts）
│   ├── pokemon/pokemon.ts     #   PKMB bundle → UI 模型（五表 join）
│   ├── resources/             #   加密资源加载栈（resourceManager/spriteCache/spritePersist/cdn/dataVersion）
│   ├── session/               #   认证与会话（key.ts/authGate.ts/token.ts）
│   └── i18n/                  #   多语言：languages/lookup/ui-messages/ui-i18n
├── store/                     # Pinia：pokemon.ts（图鉴列表）、i18n.ts（语言）
├── constants/                 # 跨文件数据表：pokemonTypes.ts、generations.ts
├── utils/                     # dexFilter.ts、virtualWindow.ts、helpers.ts
├── model/                     # 底层枚举/类型（TypesDefine.ts）
├── infra/
│   ├── wasm/                  # Rust WASM 模块（src/ 源码、schemas/、pkg/ 产物）
│   ├── storage/binaryStorage.ts  # 跨平台二进制存储（H5 IndexedDB / MP uni.setStorage）
│   └── proto/                 # Protobuf 定义（与 FlatBuffers 并存）
└── static/                    # 静态资源（styles、enums JSON、img、tabbar...）
tests/                         # vitest 用例（node 环境，无 uni 全局）
tools/                         # 数据处理脚本（python / typescript）
```

## 页面清单

权威页面登记表（`src/pages/` 下没有游离页面文件）：

| 页面 | 路径 | 状态 |
|------|------|------|
| 图鉴列表 | `pages/index/index` | 主页面 |
| 宝可梦详情 | `pages/detail/detail` | 键页 |
| 功能中心 | `pages/features/features` | 导航枢纽 |
| 资料中心 | `pages/data/data` | 键页 |
| 个人中心 | `pages/mine/mine` | 键页 |
| 伤害计算器 | `pages/calc/calc` | 键页（计算引擎在 `calc-engine.ts`） |
| 能力值计算器 | `pages/statcalc/statcalc` | 键页（纯 TS 公式在 `statcalc-engine.ts`，性格表在 `statcalc-options.ts`） |
| 对战模拟器 | `pages/simulate/simulate` | **UI 骨架**（`noop` 占位，无实际交互） |
| 设置 | `pages/settings/settings` | 子页（`DetailNavbar`，语言等系统设置；点选项弹 `OptionSheet`） |
| 属性/招式/特性/道具图鉴 | `pages/archive/*` | 资料中心四个栏目，列表页 + 详情页共 8 个（`types`/`type-detail`、`moves`/`move-detail`、`abilities`/`ability-detail`、`items`/`item-detail`）；数据流见 [../features/archive.md](../features/archive.md) |
| 开发者工具 | `pages/devtools/devtools` | **dev-only 子页**（我的 → 开发者工具）：资源探测器（取密文 → 解密 → 显示，绕开缓存）+ 文本浏览（走 resourceManager）。门禁 `import.meta.env.DEV`，实现体动态 import，正式构建被 Rollup 剔除。见 [../security/encryption-pipeline.md](../security/encryption-pipeline.md) 6.0 / 6.0.1 |
| 对战数据 | `pages/meta/meta`、`pages/meta/pokemon-meta` | 子页 ×2（资料中心 → 对战详情）：使用率排行榜（上游只给名次无 %）+ 对战配置（选用率 / SP 加点 / 队友）；明文公开 JSON，见 [../data/battle-usage.md](../data/battle-usage.md)、[../features/metagame-usage.md](../features/metagame-usage.md) |
| 我的队伍 | `pages/teams/teams`、`pages/teams/team-edit` | 子页 ×2（**功能页签**进入）：队伍 CRUD + 完整组队器；payload 对后端不透明、只存稳定 id，写前 `authGate.requireLogin()`；普通 JSON 不涉 DEK，见 [../data/teams.md](../data/teams.md)、[../features/teams.md](../features/teams.md) |

**tab 保活**：`pages.json` 声明原生 `tabBar`（不设 custom），由 `useHideNativeTabBar` 在 onShow 调
`uni.hideTabBar()` 隐藏原生条，tab 页被**平台保活**（只创建一次、切走 onHide、切回 onShow，
页面状态与滚动位置保留；旧的 `reLaunch` 方案每次销毁重建、回顶）。Tab 切换走 `uni.switchTab`，
指向 tab 的跳转统一走 `utils/navigation` 的 `navigateToAuto`；自定义胶囊 `TabBar.vue` 在
onMounted / onShow 播放指示器滑动动画。

## 分层

1. **页面层**：`pages.json` 控制路由。页面只做数据获取、页面级状态编排、组件组装；
   拆分判据是「数据隔离 / 可复用」而非行数（见 [../ui/component-conventions.md](../ui/component-conventions.md)）。
   页面专属选项表放 `pages/<name>/<name>-options.ts`。
2. **组件层**：按业务上下文分目录，跨页面通用骨架放 `shared/`。详见
   [../ui/component-conventions.md](../ui/component-conventions.md)。
3. **服务层**：
   - `api/` REST 调用；`http/` 请求/二进制下载
   - `pokemon/` 解码 join
   - `resources/` 三层缓存与 sprite 调度
   - `session/` DEK、401 恢复、登录去重
   - `i18n/` 语言偏好、名称/描述查找、UI 文案
4. **状态层**：Pinia setup 风格。`pokemon` store 对去重后的默认形态筛选排序，**不分页**，
   交给 VirtualGrid 定高虚拟化。详见 [../data/filtering-sort.md](../data/filtering-sort.md)。
5. **基础设施层**：WASM（解密 / FlatBuffers 解码 / 伤害计算）、`binaryStorage` 跨平台存储。
6. **core/ 残留**：`core/data/typechart.ts` 是移除的服务端模块残留，被 `calc-engine.ts` 静态 import（JS 侧相克描述用）；WASM 内部另有完整 TypeChart。

## 数据流向

```
服务器加密资源（FB bundle + sprite ZKDX，ServeDir 原样分发密文）
        │
        ▼
  services/resources
  ┌───────────────┐ ┌──────────────┐ ┌───────────────┐
  │resourceManager│ │ spriteCache  │ │ spritePersist │
  │ 内存→IDB→网络  │ │ 引用计数+调度 │ │ IDB 密文跨刷新 │
  └──────┬────────┘ └──────┬───────┘ └───────────────┘
         │                 │
         ▼                 ▼
  WASM 解密+解码      WASM 解密 → Blob URL
         │                 │
         ▼                 ▼
  pokemon.ts 五表join   EncryptedSprite.vue
         │
         ▼
  store/pokemon（筛选/排序/收藏）
         │
         ▼
  VirtualGrid + PokemonCard
```

DEK 走鉴权接口 `/api/v1/zukan/key`，由 `services/session/key.ts::getKey()` 统一获取。
完整链路见 [../security/encryption-pipeline.md](../security/encryption-pipeline.md)。

数据语义要点（排查「图不对 / 名不对 / 列表空」前先读）：

- **`gen-N.bin` 是「全物种在第 N 世代的数值快照」**（1351 条形态 / 1025 个默认形态，id 从 1 起），
  不是「第 N 世代新增的宝可梦」。默认世代 `DEFAULT_GEN_ID = 9`，与 `LATEST_GEN_ID = 9`（`boot.ts`）一致。
- **五表 join**：`pokemon.ts` 把 `baseEntries`/`statEntries`/`typeEntries`/`abilityEntries`
  按 id join 成 UI 模型（`eggGroupEntries` 解码但未使用）。join 后 `name` 为 `pokemon-{id}` 占位、
  `image` 为 `/static/default.png`——卡面图走加密图片通道，名称由 i18n 名称组注入，见
  [../data/bundle-decode.md](../data/bundle-decode.md)。
- **筛选在全量默认形态上做，不分页**：页面经 `setCriteria()` **全量替换**条件（不是 merge），
  store 对按 species 去重的 ~1025 条筛选排序。历史坑「先分页再筛选 → 首页被滤空 →
  滚动不触发 → 死锁」见 [../data/filtering-sort.md](../data/filtering-sort.md)。
- 收藏走 `uni.getStorageSync`（兼容小程序与早期裸 localStorage 的 JSON 字符串）。

## 关键约束

- **循环依赖防护**：
  - `session/key.ts` 静态 import `api/auth.ts`（auth 只依赖 `http` 与 `session/token`，不构成顶层环）；曾有的 `key → api/zukanKey → token → key` 环靠 `token.ts` 的 `onSessionClear` 钩子注入断环，详见 [../security/auth-session.md](../security/auth-session.md)；
  - `authGate` 是模块单例而非 Pinia store，避免 `store ⇄ session` 环；
  - `clearSpriteCache()` 在 `mine.vue` 登出路径调用，而非 `clearSession()` 内部，避免 `session ⇄ resources` 环。
- **跨实例共享状态**：`<script setup>` 顶层的 `const` 编译后落在 `setup()` 内部，每实例一份。
  缓存 / 连接池 / 引用计数必须放独立 `.ts` 模块。
- **数据表单一来源**：属性走 `constants/pokemonTypes.ts`，世代号段走 `constants/generations.ts`，
  不要在页面里复制 map。
- **拆组件看数据隔离 / 可复用，不看行数**：能靠 props 进、events 出闭环一片状态，
  或会被第二个地方复用，就抽组件；页面始终只做数据获取、状态编排、组件组装。

## 命名约定

- 目录：kebab-case
- 文件：PascalCase（组件/类），camelCase（函数/普通文件）
- 常量：UPPER_SNAKE_CASE

## 常用命令

```bash
pnpm install
pnpm dev:h5            # H5 开发服务（端口 4000）
pnpm build:h5
pnpm type-check        # 必须 0 error
pnpm test              # vitest
pnpm lint              # oxlint（目前仅 warning）
pnpm format:check      # prettier，仅 src/**/*.ts
```

环境变量 `VITE_API_BASE_URL`（zukan-server 地址，末尾无斜杠），`.env.development` 默认 `http://localhost:8080`。
