# 宝可梦图鉴 (Pokedex) 应用

## 项目简介

这是一个基于 Vue 3 和 uni-app 框架开发的跨平台宝可梦图鉴应用，旨在为用户提供多端兼容的宝可梦数据查询、详情展示以及对战模拟功能。用户可以在不同平台上（如微信小程序、H5网页、手机App等）体验一致的宝可梦数据服务。

## 功能特色

- **宝可梦列表与检索**：支持分页浏览、类型筛选和通用过滤功能，方便用户查找感兴趣的宝可梦。
- **详情展示**：展示宝可梦的基础信息、进化链、技能列表和种族值图表。
- **伤害计算器**：提供战斗伤害计算功能，帮助玩家了解对战机制。
- **对战模拟**：基于核心逻辑模拟器进行简单的对战推演。
- **多端适配**：支持编译到多个平台，包括 H5、微信小程序、支付宝小程序、百度小程序、QQ小程序、快手小程序、京东小程序、飞书小程序、小红书小程序和快应用等。

## 技术栈

- **前端框架**：Vue 3.5.27
- **跨端框架**：uni-app 3.0.0
- **构建工具**：Vite 5.2.8
- **状态管理**：Pinia ^3.0.3
- **UI 库**：@dcloudio/uni-ui ^1.5.8
- **样式方案**：TailwindCSS ^4.2.2, Sass ^1.89.2
- **语言**：TypeScript ^4.9.4
- **工具库**：lodash-es ^4.18.1, vue-i18n 9.14.5

## 目录结构

```
pokedex/
├── src/
│   ├── components/           # 通用 UI 组件
│   │   ├── pokemon/          # 宝可梦专属展示组件
│   │   │   ├── BasicInfo.vue
│   │   │   ├── EvolutionChain.vue
│   │   │   ├── MovesList.vue
│   │   │   ├── PokemonCard.vue
│   │   │   ├── PokemonHeader.vue
│   │   │   └── StatsChart.vue
│   │   ├── FilterBar.vue
│   │   ├── NavBar.vue
│   │   ├── Pagination.vue
│   │   ├── TabBar.vue
│   │   └── TypeFilter.vue
│   ├── core/                 # 核心业务逻辑
│   │   └── simulator/        # 战斗模拟核心
│   ├── model/                # 数据模型定义
│   ├── pages/                # 页面路由入口
│   ├── services/             # 数据服务层
│   ├── static/               # 静态资源
│   ├── store/                # Pinia 状态管理
│   ├── utils/                # 辅助函数
│   ├── App.vue
│   ├── main.ts
│   └── ...
├── package.json
├── vite.config.ts
└── README.md
```

## 安装与运行

### 环境要求

- Node.js (推荐使用 LTS 版本)
- pnpm

### 安装步骤

1. 克隆项目到本地：

```bash
git clone <your-repo-url>
cd pokedex
```

2. 安装依赖：

```bash
pnpm install
```

### 运行项目

#### 开发模式

- **H5 平台**：
  ```bash
  pnpm dev:h5
  ```

- **微信小程序**：
  ```bash
  pnpm dev:mp-weixin
  ```

- **支付宝小程序**：
  ```bash
  pnpm dev:mp-alipay
  ```

- **百度小程序**：
  ```bash
  pnpm dev:mp-baidu
  ```

- **QQ 小程序**：
  ```bash
  pnpm dev:mp-qq
  ```

- **其他平台**：
  - 头条: `pnpm dev:mp-toutiao`
  - 快手: `pnpm dev:mp-kuaishou`
  - 京东: `pnpm dev:mp-jd`
  - 飞书: `pnpm dev:mp-lark`
  - 小红书: `pnpm dev:mp-xhs`
  - 快应用: `pnpm dev:quickapp-webview`

#### 构建生产版本

- **H5 平台**：
  ```bash
  pnpm build:h5
  ```

- **微信小程序**：
  ```bash
  pnpm build:mp-weixin
  ```

- **其他平台**：
  - 支付宝: `pnpm build:mp-alipay`
  - 百度: `pnpm build:mp-baidu`
  - QQ: `pnpm build:mp-qq`
  - 头条: `pnpm build:mp-toutiao`
  - 快手: `pnpm build:mp-kuaishou`
  - 京东: `pnpm build:mp-jd`
  - 飞书: `pnpm build:mp-lark`
  - 小红书: `pnpm build:mp-xhs`
  - 快应用: `pnpm build:quickapp-webview`

### 类型检查

```bash
pnpm type-check
```

## 部署说明

- **H5**：构建后的文件位于 `dist/build/h5`，可部署至任意静态服务器（Nginx, Apache, Vercel等）。
- **小程序**：构建后的文件位于 `dist/build/mp-weixin` 等对应目录，需使用对应小程序开发者工具上传代码。

## 主要技术特点

### 架构模式

- **MVVM 架构**：基于 uni-app 生态的 MVVM 模式，使用 Vue 3 的 Composition API。
- **组件化设计**：UI 拆分为独立可复用组件。
- **模块化设计**：核心模拟逻辑封装在 `src/core/simulator` 中。

### 设计模式

- **单例模式**：使用 Pinia Store 进行全局状态管理。
- **模块化设计**：将核心模拟逻辑分离到独立模块中，包括能力、计算器、条件、招式等类。

### 代码规范

- 使用 TypeScript 进行严格类型检查。
- 使用 Stylelint 进行 CSS/SCSS 规范检查。
- 使用路径别名 `@/*` 指向 `./src/*`。

## 注意事项

1. 项目使用了 uni-app 的特定版本（带有长哈希的版本号），这可能是内部测试版，可能存在不稳定性。
2. 项目使用了 TailwindCSS v4，这是一个较新的主版本，配置方式可能与 v3 有显著差异。
3. 项目中的 Node 类型定义版本较高，请确保开发环境兼容。

## 贡献

欢迎提交 Issue 和 Pull Request 来改进这个项目！

## 许可证

[在此处添加许可证信息]