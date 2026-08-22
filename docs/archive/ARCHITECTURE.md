# 项目架构说明

## 目录结构

```
zukan/
├── src/
│   ├── main.ts                    # 入口：SSR app，安装 Pinia/uni-icons，引入 global.css
│   ├── App.vue                    # 根组件，定义导航栏尺寸等共享 CSS 变量
│   ├── pokemon.d.ts               # 全局宝可梦接口（IPokemonBaseModel 等，无需显式导入）
│   ├── vite-env.d.ts
│   │
│   ├── pages/                     # 页面路由（pages.json 控制，无 Vue Router）
│   │   ├── index/index.vue         # 图鉴列表（主页面，VirtualGrid + PokemonCard）
│   │   ├── detail/detail.vue       # 宝可梦详情
│   │   ├── features/features.vue   # 功能中心（导航枢纽）
│   │   ├── data/data.vue           # 资料中心
│   │   ├── mine/mine.vue           # 个人中心
│   │   ├── calc/                   # 伤害计算器
│   │   │   ├── calc.vue            #   页面
│   │   │   ├── calc-engine.ts      #   计算引擎
│   │   │   └── calc-options.ts     #   选项/常量（页面专属）
│   │   └── simulate/simulate.vue   # 对战模拟器（UI 骨架，noop 占位）
│   │
│   ├── components/                 # UI 组件
│   │   ├── shared/                 #   跨页面通用
│   │   │   ├── TabPageShell.vue
│   │   │   ├── DetailNavbar.vue
│   │   │   ├── ListRow.vue
│   │   │   ├── FavoriteButton.vue
│   │   │   ├── PokeballLogo.vue
│   │   │   └── LoginModal.vue
│   │   ├── pokemon/                #   宝可梦领域
│   │   │   ├── PokemonCard.vue
│   │   │   ├── TypeBadge.vue
│   │   │   ├── SpecimenHero.vue
│   │   │   ├── InfoGrid.vue / InfoCard.vue
│   │   │   ├── StatsChart.vue
│   │   │   ├── MovesList.vue / MoveCard.vue
│   │   │   └── EvolutionChain.vue
│   │   ├── dex/                    #   图鉴列表上下文
│   │   │   ├── VirtualGrid.vue
│   │   │   ├── DexToolbar.vue
│   │   │   ├── FilterBar.vue
│   │   │   ├── GenerationDrawer.vue
│   │   │   ├── DexEmptyState.vue
│   │   │   └── FavoritesBanner.vue
│   │   ├── calc/                   #   计算器上下文
│   │   │   ├── CalcCard.vue
│   │   │   ├── CalcSideCard.vue
│   │   │   ├── ChipRow.vue
│   │   │   ├── LevelStepper.vue
│   │   │   └── DamageResultCard.vue
│   │   ├── sprite/                 #   图片加载
│   │   │   └── EncryptedSprite.vue
│   │   ├── NavBar.vue              #   跨页面顶栏
│   │   └── TabBar.vue              #   跨页面底栏
│   │
│   ├── services/                   # 服务层
│   │   ├── boot.ts                 #   启动引导（版本号、DEK 获取、prune 旧版本缓存）
│   │   ├── api/                    #   后端 API 接口
│   │   │   ├── auth.ts
│   │   │   ├── favorites.ts
│   │   │   ├── zukanKey.ts
│   │   │   └── index.ts
│   │   ├── http/                   #   HTTP 请求层
│   │   │   ├── index.ts
│   │   │   ├── request.ts
│   │   │   └── binaryRequest.ts
│   │   ├── pokemon/                #   宝可梦数据模型
│   │   │   ├── pokemon.ts          #     FB bundle 解码 → join → UI 模型
│   │   │   ├── moves.ts            #     技能数据
│   │   │   └── index.ts
│   │   ├── resources/              #   加密资源加载栈
│   │   │   ├── resourceManager.ts  #     FB bundle 三层缓存（memory LRU/IndexedDB/网络）
│   │   │   ├── spriteCache.ts      #     sprite Blob URL 共享缓存（引用计数+并发调度+离屏取消）
│   │   │   ├── spritePersist.ts    #     sprite 密文跨刷新缓存（IndexedDB）
│   │   │   ├── cdn.ts              #     签 URL
│   │   │   ├── dataVersion.ts      #     KV 版本号
│   │   │   └── index.ts            #     统一导出
│   │   └── session/                #   认证与会话
│   │       ├── key.ts              #     DEK 管理（单例 + 401 重试 + 403 重签）
│   │       ├── authGate.ts         #     登录弹层去重（模块单例，避免 store ⇄ session 环）
│   │       ├── token.ts            #     令牌管理
│   │       ├── types.ts
│   │       └── index.ts
│   │
│   ├── store/                      # 状态管理（Pinia）
│   │   └── pokemon.ts              #   图鉴列表 store（筛选/排序/收藏）
│   │
│   ├── constants/                  # 跨文件共享数据表
│   │   ├── pokemonTypes.ts         #   属性颜色/标签/缩写（getTypeColor 等）
│   │   └── generations.ts          #   世代号段定义
│   │
│   ├── utils/                      # 通用工具函数
│   │   ├── dexFilter.ts            #   图鉴筛选/排序逻辑
│   │   ├── virtualWindow.ts        #   虚拟化窗口计算
│   │   └── helpers.ts              #   其他辅助函数
│   │
│   ├── model/                      # 底层数据模型
│   │   └── TypesDefine.ts          #   枚举与基础类型定义
│   │
│   ├── infra/                      # 基础设施层（平台特定实现）
│   │   ├── wasm/                   #   Rust WASM 模块
│   │   │   ├── src/                #     Rust 源码
│   │   │   │   ├── fb/             #       FlatBuffers 表定义（generated/ 为编译产物）
│   │   │   │   └── lib.rs
│   │   │   ├── schemas/            #     FlatBuffers 模式定义（.fbs）
│   │   │   ├── pkg/                #     WASM 构建产物（gitignore）
│   │   │   ├── Cargo.toml / Cargo.lock
│   │   │   ├── build.rs
│   │   │   ├── index.ts            #     TS 桥接
│   │   │   └── package.json
│   │   ├── storage/                #   跨平台二进制存储
│   │   │   └── binaryStorage.ts    #     IndexedDB（H5）/ uni.setStorage（MP）
│   │   └── proto/                  #   Protobuf 定义
│   │       └── pokemon_data.proto
│   │
│   ├── static/                     # 静态资源
│   │   ├── styles/global.css       #   全局样式（含 Tailwind 以外的基础样式、动画）
│   │   ├── enums/                  #   枚举 JSON 数据（abilities, types, moves 等）
│   │   ├── img/                    #   图片资源
│   │   ├── simulator/              #   模拟器资源
│   │   ├── tabbar/                 #   底栏图标
│   │   ├── default.png / logo.png
│   │   └── ... (Legends Arceus Sprites 等原画目录)
│   │
│   └── core/                       # 核心业务逻辑（遗留）
│       └── data/typechart.ts       #   属性相克表（被 calc-engine 动态 import）
│
├── tests/                          # 单元测试（vitest，node 环境，无 uni 全局）
│   ├── dexFilter.spec.ts
│   ├── favorites.spec.ts
│   ├── pokemonStore.spec.ts
│   ├── spriteCache.spec.ts
│   ├── spritePersist.spec.ts
│   └── virtualWindow.spec.ts
│
├── tools/                          # 数据处理工具
│   ├── README.md
│   ├── python/                     #   Python 转换脚本（convert_*.py, adjust_*.py 等）
│   └── typescript/
│       └── convert-moves.ts        #   TS 技能数据转换
│
├── docs/                           # 文档
│   ├── ARCHITECTURE.md
│   ├── encryption.md               #    加密方案（AES-256-GCM ZKDX，精准且不过时）
│   ├── zukan-decryption.md         #    解密流程（与代码一致）
│   ├── calc-engine.md              #    伤害计算器数据流（改 calc 前必读）
│   ├── encrypted-assets.archived.md
│   └── restful.archived.md
│
├── CLAUDE.md                       # 项目指引
├── tailwind.config.js              # Tailwind CSS 配置（含属性颜色）
├── vite.config.ts                  # Vite 配置（uni-app 插件，端口 4000）
├── vitest.config.ts                # Vitest 配置（刻意独立于 vite.config.ts）
├── tsconfig.json
├── postcss.config.js
├── oxlintrc.json
├── stylelint.config.js
├── .prettierignore
├── index.html
├── package.json
└── pnpm-workspace.yaml
```

## 分层说明

### 1. 页面层（Pages）
- 由 `pages.json` 控制路由，无 Vue Router
- 每个页面控制在 ~300 行以内，只做数据获取、页面级状态编排、组件组装
- 页面专属的选项/常量表放在 `pages/<name>/<name>-options.ts`

### 2. 组件层（Components）
- 按业务上下文分目录：`shared/`、`pokemon/`、`dex/`、`calc/`、`sprite/`
- 跨页面通用的骨架组件（TabPageShell、DetailNavbar、ListRow 等）放在 `shared/`
- 遵循 scoped CSS 特异性规则：基础规则与变体必须同处一个作用域

### 3. 服务层（Services）
- **API 接口**（`api/`）：封装后端 REST 调用
- **HTTP 请求层**（`http/`）：请求/响应处理，含二进制请求
- **宝可梦数据**（`pokemon/`）：FB bundle 解码 → 四张并行表 join → UI 模型
- **加密资源加载**（`resources/`）：三层缓存、sprite 调度、跨刷新持久化
- **认证会话**（`session/`）：DEK 管理、401 恢复、登录弹层去重

### 4. 状态层（Store）
- Pinia setup 风格，单 store（`pokemon.ts`）
- 对 `defaultPokemons`（按 species 去重后的 ~1025 条）筛选排序得到 `matchedPokemons`
- 不分页 —— 列表渲染交给 VirtualGrid 定高虚拟化

### 5. 基础设施层（Infra）
- **WASM**（`wasm/`）：Rust 编译的 WASM 模块，用于：
  - 高性能加密解密（ZKDX 格式）
  - FlatBuffers 解码
  - 大规模伤害计算
  - 模拟战斗回放
- **二进制存储**（`storage/binaryStorage.ts`）：跨平台抽象，H5 用 IndexedDB，MP 用 uni.setStorage
- **Protobuf**（`proto/pokemon_data.proto`）：Protobuf 数据定义（与 FlatBuffers 并存，不同用途）

### 6. 核心层（Core）
- 遗留模块，仅剩 `data/typechart.ts`（属性相克表）
- 被 `calc-engine.ts` 动态 import，是移除的服务端模块的残留

## 数据流向

```
服务器加密资源（encrypted FB bundle + sprite ZKDX）
        │
        ▼
  ┌──────────────────────────────────────────────────┐
  │  Services/Resources                              │
  │  ┌──────────────┐  ┌─────────────┐  ┌─────────┐ │
  │  │resourceManager│  │ spriteCache │  │spritePersist│
  │  │(3层缓存)      │  │(引用计数+   │  │(IDB密文) │ │
  │  │              │  │ 并发调度     │  │         │ │
  │  └──────┬───────┘  └──────┬──────┘  └─────────┘ │
  └─────────┼────────────────┼───────────────────────┘
            │                │
            ▼                ▼
  ┌──────────────────┐  ┌──────────────────────┐
  │WASM 解密 + 解码   │  │WASM 解密 → Blob URL │
  │(infra/wasm)      │  │(infra/wasm)         │
  └────────┬─────────┘  └──────────┬───────────┘
           │                       │
           ▼                       ▼
  ┌──────────────────┐  ┌──────────────────────┐
  │pokemon.ts        │  │EncryptedSprite.vue   │
  │(4表join → UI模型) │  │(IntersectionObserver)│
  └────────┬─────────┘  └──────────────────────┘
           │
           ▼
  ┌──────────────────┐
  │Store/Pinia       │
  │(筛选/排序/收藏)   │
  └────────┬─────────┘
           │
           ▼
  ┌──────────────────┐
  │VirtualGrid +     │
  │PokemonCard       │
  │(定高虚拟化渲染)    │
  └──────────────────┘
```

## 缓存层级总览

| 缓存 | 位置 | 层级 | 持久化 | 版本失效 |
|------|------|------|--------|----------|
| FB bundle 解码结果 | `resourceManager.ts` | 内存 LRU（12 条） | — | 版本号变化 |
| FB bundle 密文 | `resourceManager.ts` via `binaryStorage` | IndexedDB | 跨刷新 | `pruneOtherVersions` |
| sprite Blob URL | `spriteCache.ts` | 内存 LRU（200 条） | — | 刷新即清空 |
| sprite 密文 | `spritePersist.ts` via `binaryStorage` | IndexedDB（仅 IDB 后端） | 跨刷新 | `pruneSpriteVersions` |
| 密钥 DEK | `session/key.ts` | 内存单例 | — | 登出 / 403 重签 |

## 命名约定

- 目录名：**kebab-case**
- 文件名：**PascalCase**（类/组件），**camelCase**（函数/普通文件）
- 常量：**UPPER_SNAKE_CASE**

## 关键约束

- **循环依赖防护**：`session/key.ts` 动态 import `api/auth.ts`；`authGate` 是模块单例而非 Pinia store；`clearSpriteCache()` 在 `mine.vue` 的登出路径调用而非 `clearSession()` 内部
- **VirtualGrid 定高假设**：改 `PokemonCard` 高度前需考虑虚拟化影响
- **跨实例共享**：`<script setup>` 顶层的 `const` 不是模块级单例 —— 需要跨实例共享的状态必须放独立 `.ts` 模块
- **组件化**：同一段模板或 CSS 出现第二次就抽组件；配色/名称等数据表只能有一处定义

## 测试

- 配置在 `vitest.config.ts`，刻意不复用 `vite.config.ts`
- 环境是 `node`，没有 uni 全局
- 测数据要跨越分页边界；属性筛选的测试数据必须含双属性宝可梦
- 写完用例把 bug 注回去确认它变红