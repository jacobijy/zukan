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
├── pages/                     # 页面路由（pages.json 控制，无 Vue Router）
│   ├── index/index.vue        #   图鉴列表（主页面，VirtualGrid + PokemonCard）
│   ├── detail/detail.vue      #   宝可梦详情
│   ├── features/features.vue  #   功能中心（导航枢纽）
│   ├── data/data.vue          #   资料中心
│   ├── mine/mine.vue          #   个人中心
│   ├── calc/                  #   伤害计算器（calc.vue + calc-engine.ts + calc-options.ts）
│   └── simulate/simulate.vue  #   对战模拟器（UI 骨架，noop 占位）
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

## 分层

1. **页面层**：`pages.json` 控制路由。页面只做数据获取、页面级状态编排、组件组装，控制在 ~300 行。
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
6. **core/ 残留**：`core/data/typechart.ts` 是移除的服务端模块残留，被 `calc-engine.ts` 动态 import。

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

## 关键约束

- **循环依赖防护**：
  - `session/key.ts` 动态 import `api/auth.ts`，避免 `session ⇄ api` 顶层环；
  - `authGate` 是模块单例而非 Pinia store，避免 `store ⇄ session` 环；
  - `clearSpriteCache()` 在 `mine.vue` 登出路径调用，而非 `clearSession()` 内部，避免 `session ⇄ resources` 环。
- **跨实例共享状态**：`<script setup>` 顶层的 `const` 编译后落在 `setup()` 内部，每实例一份。
  缓存 / 连接池 / 引用计数必须放独立 `.ts` 模块。
- **数据表单一来源**：属性走 `constants/pokemonTypes.ts`，世代号段走 `constants/generations.ts`，
  不要在页面里复制 map。
- **页面文件 ≤ ~300 行**，超了先拆组件。

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
