# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 常用命令

- 安装依赖：`pnpm install`
- 启动 H5 开发服务：`pnpm dev:h5`
- 构建 H5 产物：`pnpm build:h5`
- 类型检查：`pnpm type-check`
- 启动小程序等平台开发构建：`pnpm dev:mp-weixin`、`pnpm dev:mp-alipay`、`pnpm dev:mp-baidu`、`pnpm dev:mp-qq` 等
- 构建小程序等平台产物：`pnpm build:mp-weixin`、`pnpm build:mp-alipay`、`pnpm build:mp-baidu`、`pnpm build:mp-qq` 等

`package.json` 中目前没有测试脚本或 lint 脚本。项目配置了 Stylelint，但没有暴露对应的 package script。

## 架构概览

这是一个基于 Vue 3、uni-app 和 Vite 的宝可梦图鉴应用。`src/main.ts` 创建 SSR app，安装 Pinia，注册 `uni-icons`，并引入 `src/static/styles/global.css`。`vite.config.ts` 启用 uni-app Vite 插件，开发服务端口为 4000，并将 `@/*` 映射到 `src/*`；`tsconfig.json` 中也配置了同样的路径别名。

路由由 uni-app 的 `src/pages.json` 控制，不使用 Vue Router。当前注册的页面包括图鉴列表、详情、功能中心、资料中心和个人中心。`src/pages/` 下还存在一些额外页面文件（例如 calc/simulate/contact），但它们目前没有注册到 `pages.json`；如果需要依赖这些页面跳转，先把对应页面加入 `pages.json`。

主列表流程集中在 `src/pages/index/index.vue`。该页面从 Pinia store 加载数据，在页面级状态中组合搜索、类型筛选、仅收藏、世代筛选、排序和无限滚动，然后渲染 `PokemonCard` 列表。顶部导航和底部 TabBar 分别封装为 `NavBar.vue` 和 `TabBar.vue`；TabBar 使用 `uni.reLaunch` 切换页面，并通过 storage key 在页面间播放指示器滑动动画。

宝可梦数据目前来自 `src/services/pokemon.ts`，该文件返回 mock 数据。`src/store/pokemon.ts` 使用 setup 风格的 Pinia store 封装该服务，通过 `src/utils/helpers.ts` 格式化编号，在内存中分页加载列表，并用浏览器 `localStorage` 持久化收藏。由于这里直接使用 `localStorage`，如果目标包含非 H5 平台，需要确认平台兼容性。

全局宝可梦接口声明在 `src/pokemon.d.ts`，因此许多 `.vue` 文件会直接使用 `IPokemonBaseModel` 和 `IPokemonCardModel`，无需显式导入。`src/model/` 存放更底层的数据模型和枚举，例如基础种族值和属性定义。

样式主要写在 Vue 模板中的 Tailwind utility class 中，少量组件使用 scoped SCSS/CSS 处理尺寸或动画。`tailwind.config.js` 配置了宝可梦属性颜色，并扫描 `index.html` 和所有源码 Vue/TS/JS 文件。导航栏尺寸相关的共享 CSS 变量定义在 `src/App.vue`，被 `NavBar` 和页面布局 padding 复用。

静态资源位于 `src/static/`，其中包含大量 `src/static/img/` 图片资源和默认图片。uni-app 模板和数据中的静态资源通常使用 `/static/...` 路径引用。
