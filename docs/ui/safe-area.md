# 顶部安全区 / 刘海适配（env 基线 + JS 兜底）

页面标题不与手机刘海 / 灵动岛 / 状态栏冲突。三端共用同一套 CSS 变量，注入分两层。

## 变量

| 变量 | 定义处 | 含义 |
|------|--------|------|
| `--status-bar-height` | `App.vue` 的 `page`（基线）+ 页面根（JS 兜底） | 顶部状态栏 / 刘海高度 |
| `--navbar-content-height` | `App.vue` 的 `page` | 红条内容区，`clamp(52px,10vmin,60px)` |
| `--navbar-total-height` | 同上 / 页面根 | `calc(status-bar + navbar-content)`，页面占位统一消费它 |
| `--navbar-control-height` | `App.vue` 的 `page` | 红条内控件，content 的 0.72 |

直接消费 `--status-bar-height` 的只有三个固定组件：`NavBar` / `DetailNavbar` /
`GenerationDrawer` 的 `padding-top`；页面滚动区一律用 `--navbar-total-height` 定位。

## 两层注入

```
第一层  env 基线（全局，App.vue 的 page）
        --status-bar-height: env(safe-area-inset-top, 0px)
                         │  现代浏览器 / 新 webview 一处即正确
                         ▼
第二层  JS 权威值（逐页根，usePageSafeArea 内联 :style）
        applySafeArea 读 uni.getSystemInfoSync().statusBarHeight
        → safeAreaState 响应式真相源 → 页面根内联覆盖本页变量
                         │  env 返 0 的老基础库 / 部分安卓 XWeb 靠它修正
                         ▼
        H5 / App（有 DOM）另由 applySafeArea 直接写 :root
```

env 正确时两层值相等、页面根覆盖**无害**；env 返 0 时 JS 值修正。`env()` 的值由
宿主渲染器从 OS 安全区填充（原理见下「为什么需要 JS 兜底」）。

### 相关文件

- `src/infra/platform/safeArea.ts` — 纯归一：H5→`env(...)`；mp/app→`statusBarHeight` 数值，坏值回 `0px`。
- `src/infra/platform/applySafeArea.ts` — 启动时读系统信息：有 DOM 写 `:root`，并写 `safeAreaState`。
- `src/infra/platform/safeAreaState.ts` — 响应式单例（`statusBarHeight` / `setStatusBarHeight`）。
- `src/composables/usePageSafeArea.ts` — 页面根 `:style` 所需两变量的纯 computed。

## 为什么微信不能只在 App.vue 一处注入 JS 值

- 小程序逻辑层（JSCore）**没有 DOM / CSSOM**，不能运行时改全局样式表；`App()` 不渲染
  任何节点、手里没有页面渲染树。
- 每个 Page 是独立渲染树，数据进视图**只有本页 setData 一条路**。故运行时值注定逐页有一个
  写入点（值是全局共享的，入口不是）。静态 `app.wxss` 能全局，是因为它在构建期已固化。
- `env()` 能破例全局，正因它是**静态样式表**里由渲染引擎直接填的设备常量，绕开了 JS 投递。

## 两条 CSS 自定义属性规则（踩过）

1. **页面根必须同时重声明 `--status-bar-height` 和 `--navbar-total-height`。**
   `--navbar-total-height` 在 `page` 上算定后已是替换好的值；后代只改
   `--status-bar-height`，继承来的 `--navbar-total-height` **不会重算**。`usePageSafeArea`
   因此把两者一起下发。
2. **默认值放 `:root`，不要在 `page` 上重声明固定的 `--status-bar-height`。** 同元素上
   stylesheet 声明会盖掉从 `:root` 继承的注入值。App.vue 里 `page` 的 env 是基线、
   页面根内联（inline）优先级更高，能正常覆盖。

## H5：普通浏览器与 PWA

- 普通浏览器：视口在安全区外，`env(safe-area-inset-top)` = 0，表现与不占位一致。
- iPhone Safari 全屏 / PWA：`index.html` 的 viewport 配了 **`viewport-fit=cover`**，视口铺进
  刘海区，env 才报非 0。缺 cover 时 env 恒 0（浏览器默认已替网页避开不安全区）。

## 为什么需要 JS 兜底

env 与 `getSystemInfoSync().statusBarHeight` 是**同一块刘海、两条通道**：env 经 CSS 渲染器
实现，老基础库 / 部分安卓 XWeb 内核历史上映射不全、会返 0；JS API 是原生代码直接走 OS
测量经 bridge 返回，版本兼容性最好。两层并用 = 现代端简洁、老端有救。

## 验证

1. `pnpm type-check` → 0 错误；`pnpm test` → 含 `tests/safeArea.spec.ts` 全绿。
2. **H5**：桌面 env=0、导航不偏移。DevTools 切移动设备 + Console
   `document.documentElement.style.setProperty('--status-bar-height','50px')`，导航与内容
   应整体下移 50px → 消费链路通。env 非 0 像素靠 iPhone Safari / PWA 真机。
3. **微信**：watch 重编译后，各页面 wxml 根出现内联 `--status-bar-height` /
   `--navbar-total-height` 绑定；开发者工具切 iPhone 刘海 / 安卓挖孔机型 + 真机，
   看标题落在状态栏下、不压刘海。Console 读 `uni.getSystemInfoSync().statusBarHeight` 随机型变化。
4. **App**：vue 页跑在 webview（有 DOM），`applySafeArea` 写 `:root`；真机 / 模拟器确认。

**判据统一：标题上沿沿落在时间·电量状态栏那行的正下方，不重叠。**
