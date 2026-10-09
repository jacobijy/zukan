# 微信小程序平台坑点与规避

本文是微信小程序**平台特殊问题的速查与规避清单**：每条给「现象 / 平台根因 / 怎么避」，
用于写代码前扫一眼、出问题时按报错定位。**为什么这么适配、完整实现**不在此展开，见
[mp-weixin-build.md](mp-weixin-build.md)（构建与适配）、[mp-weixin-remote-debug.md](mp-weixin-remote-debug.md)
（远程调试）、[../ui/virtual-list.md](../ui/virtual-list.md)（虚拟化）。

图鉴主目标是 H5，小程序是次要平台，**大部分坑都源于「拿浏览器的习惯往小程序上套」**。

## 三条本质差异（先记住）

1. **小程序没有浏览器的那套 Web 环境**：无标准 `WebAssembly`、无 Blob URL（`URL` 为
   `undefined`）、无 `import.meta.url`、无远程 `fetch` wasm、无 DOM、无 SVG 标签。
2. **WXSS ≠ CSS**：`:hover`、通用选择器 `*`、`::backdrop`、`:where()`、选择器反斜杠
   转义都不支持；规则被不支持时可能被**静默整条剔除**，留下空块再报语法错。
3. **type-check / 单测看不见这些问题**：条件编译两个分支都会过 vue-tsc，小程序产物里
   的 wxml/wxss/js 形态只能**构建后 grep 产物核对**。

## 一、WXSS / 样式

| 现象 / 报错 | 平台根因 | 规避 |
|---|---|---|
| `unexpected token '}'`，定位到一个空 `@media{}` | WXSS 不支持 `:hover`，块内规则被静默剔除，只剩空媒体块 | 触摸端**不写 `:hover`**（按压态用 `:active`）；别留空 `@media` 块。`PanelActions.vue` 踩过 |
| 整个 `app.wxss` 编译失败，选择器带 `\/`、`\:`、`\[` | WXSS 不支持选择器反斜杠转义（Tailwind 斜杠/冒号/任意值类产生） | 用 `weapp-tailwindcss` 插件在产物末端改成安全类名，勿手改 |
| 报错指向 `*`、`:host`、`::backdrop`、`:where()` 行 | WXSS 不支持这些选择器；Tailwind preflight 与 `optimizeUniversalDefaults` 未收敛 | 小程序端关 preflight、开 `experimental.optimizeUniversalDefaults` |
| `width:100%` / grid 1fr 横向溢出屏幕 | 微信 WebView 默认 **content-box**（Skyline 才是 border-box） | 在 global.css **逐元素列举**补 box-sizing；**不能写裸 `*`**（被收窄成 view/text，漏 scroll-view） |
| `<view>` 内联 svg 不显示 | 小程序标签不支持 SVG | 图标走字体字形（`build:icons` 生成 ttf + glyphs.ts） |
| slot 内容的配色变体选不中 / scoped 样式失效 | slot 内容带**父组件** scope id，子组件 scoped 选不中 | 基础规则与配色变体放同一作用域；详见 component-conventions |

## 二、脚本 / 模块系统

| 现象 / 报错 | 平台根因 | 规避 |
|---|---|---|
| 动态 `import('x')` 拿到 `undefined`，或 `"x".then is not a function` | 编译器把 `import('x')` 错编成 `await "x.js"`，只 await 字符串、不加载 | **不用动态 import 断环**；靠依赖方向（注入 resolver / 纯函数 + 回调）。`moveRefs.ts` 是唯一已知例外（仅 H5 调用链） |
| `ReferenceError: WebAssembly is not defined` | 小程序无标准 `WebAssembly` 全局 | 用 `WXWebAssembly`；vite 插件 `adaptWasmToWx` 已改 glue |
| wasm 初始化 `invalid value type 'externref'` | 旧开发者工具的模拟引擎未开 reference-types，**wasm 本身没问题** | **先升级开发者工具再怀疑代码**；别用 `target-feature=-reference-types` 硬关 |
| `<component is=""/> is not supported` | 小程序编译器不支持动态组件 | devtools 等用 `#ifdef H5` 包住，非 H5 显示降级提示 |
| `URL.createObjectURL` → TypeError | 小程序无 Blob URL | 解密图片用 `FileSystemManager.writeFile` 写本地文件、返回**路径**（收口在 `objectUrl.ts`） |

## 三、scroll-view / 滚动 / 虚拟化

| 现象 / 报错 | 平台根因 | 规避 |
|---|---|---|
| 切赛季/赛制后列表整片空白、有条目丢失、排名不更新 | 数据变了但只重置内部 `scrollTop`，**没驱动 scroll-view 回顶**，物理视口停在原位 | 数据变更走受控 `:scroll-top` 回顶；`VirtualGrid` / `VirtualList` 均已内置 |
| 首屏之后空白、滚动不加载新卡片 | 用普通 `<view>` 做滚动容器，小程序 view 无 `bindscroll`，scrollTop 恒 0 | 滚动容器一律 `<scroll-view scroll-y>` |
| 受控回顶「第二次不生效」 | `:scroll-top` 仅在**值变化**时滚动，连续两次都是 0 则第二次不动 | 回顶时 `0 → 1 → nextTick 归 0` 翻转（1px 抖动不可见） |
| scroll-view 不滚动 | 微信 scroll-view 必须有**明确高度** | 组件内 `h-full`，外层包 `flex-1 min-h-0` 给确定高 |
| 图已下载解密但列表里一直停在骨架 | 节点在 scroll-view 内部滚动时，IntersectionObserver 相对页面视口不触发 | 虚拟列表内图片统一 `eager`（行级裁剪已等价于 observer） |
| 滚动出现新条目时，**已存在的行（含名称）短暂变成另一条又跳回** | onScroll 对每个 scroll 事件立即赋值；边界处一帧内 scrollTop 的中间/回弹值让窗口首行索引短暂来回 | onScroll 用 **rAF 节流**，一帧只取最后一次 scrollTop（VirtualGrid / VirtualList 已对齐） |
| 滚动换条目时图片先变骨架/空白再换新图（闪烁） | scoped-slot 内容被编成父侧 `wx:for` 且 `wx:key` 固定为**位置索引 i0**（子组件 `<slot>` 上的 :key 传不过去），同一 `<image>` 连续换 id；id-watch 若立刻清空 blobUrl 就闪 | id 变化时**保留旧 url 不清空**，新图就绪再替换（url→url），旧引用换图时才释放 |
| 首屏卡顿 / 瞬时全量渲染上千卡 | 小程序无 DOM，首帧拿不到几何会降级全量渲染 | 挂载先用 `getSystemInfoSync()` 估算，再用 `createSelectorQuery()` 实测覆盖 |

## 四、构建 / watch / 包体

| 现象 / 报错 | 平台根因 | 规避 |
|---|---|---|
| wasm 实例化 `BufferSource argument is empty` | watch 期间 `copyFileSync` 非原子（先截断成 0 再写），监听器抓到 0 字节拷进 dist；该空文件 mtime 够新，此后一直不重拷 | 拷包内资源用**原子写**：同目录 `.tmp` + `rename`（`copy-wasm.mjs` 已改） |
| 文件放进 src 但小程序包里找不到 | 只有 **src/static** 下的文件才会被原样拷进包 | 包内资源放 src/static |
| 上传超 2MB | 单主包/分包 ≤ 2MB、整包 ≤ 30MB | `slim-mp-weixin.mjs` 从**产物**剔除未用的 s/l 档（源与测试保留） |
| 误判包体虚高（显示 4.x M） | `du -sh` 小文件按 4K 块对齐 | 用 `find . -type f -printf '%s\n' \| awk '{s+=$1}END{print s}'` 算真实字节 |
| 无法真机预览 / 上传，appid 是 `touristappid` | `manifest.json` 的 appid 留空 | 发布前填真实 appid |

## 五、导航 / 保活 / 安全区

| 现象 | 平台根因 | 规避 |
|---|---|---|
| 无 Vue Router、跳转行为不一致 | 路由由 `pages.json` 控制 | tab 跳转用 `utils/navigation` 的 `navigateToAuto`（tab→switchTab，否则 navigateTo） |
| 切 tab 回来要重新加载、回顶端 | `reLaunch` 每次销毁重建 | 路径 B：原生 tabBar + `hideTabBar` + 自定义胶囊，保活交给平台 |
| 顶部被状态栏 / 刘海遮挡 | 小程序安全区需逐页处理 | 新页面根节点绑 `usePageSafeArea()`；占位只用 `var(--navbar-total-height)` |
| 弹层退出过渡卡死 / 不消失 | uni-app 上 `transitionend` 不可靠 | 弹层 `v-if` 关闭即卸载，入场用 CSS `animation` |

## 高频报错 → 速查

- `unexpected token '}'`（空媒体块）→ 一、`:hover`
- `BufferSource argument is empty`（空 wasm）→ 四、原子写
- `invalid value type 'externref'` → 二、先升级开发者工具
- `<component is=""/> is not supported` → 二、动态组件
- 切数据后列表空白 / 排名错 → 三、受控回顶
- 滚动后不加载 → 三、scroll-view + 明确高度
- 滚动时行错位回弹 / 图片闪烁 → 三、onScroll rAF 节流 + 换 id 保留旧图

## 提交前自检（改动涉及小程序时）

- [ ] 没写 `:hover`，没有空的 `@media` / 空规则块。
- [ ] 没有用动态 `import()` 给小程序调用链断环（或已确认该链仅 H5）。
- [ ] 滚动容器是 `<scroll-view>` 且有明确高度；数据集变更已能回顶。
- [ ] 包内资源在 src/static，拷贝脚本原子写。
- [ ] `pnpm type-check` 0 error、`pnpm test` 全绿。
- [ ] **构建后 grep / 查看产物**：wxml 有对应绑定、wxss 无空块与非法选择器、
      无 `"./xxx.js"` 紧跟 `.then` 的漏网动态 import。
