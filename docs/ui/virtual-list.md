# VirtualGrid 定高虚拟化

`src/components/dex/VirtualGrid.vue` 是图鉴列表的虚拟化核心，**定高**渲染。
DOM 只保留视口附近的行，长列表（~1025 张卡）也只挂载几十个节点。

## 工作方式

- 窗口算术抽成纯函数 `src/utils/virtualWindow.ts::computeVirtualWindow`，
  按「行」算偏移，off-by-one / 越界由 `tests/virtualWindow.spec.ts` 守着。
- 卡片高度**不硬编码**：运行时用首个渲染子元素实测（历史实测约 98px @ mobile、106px ≥640px）。
- 列数与 gap **不写在 JS 里**：从解析后的 `grid-template-columns` 读回来，
  断点只在组件的 `grid-class` 里定义一次，避免 JS 和 CSS 两套布局各说各话。

## 跨端：根元素是 scroll-view

根元素统一为 `<scroll-view scroll-y>`（H5 与小程序同一套模板，不做 `#ifdef` 双根），
与 `VirtualList.vue` 一致。普通 `<view>` 在小程序里没有 scroll 事件
（`bindscroll` 为 scroll-view 专属），用它做滚动容器会让 scrollTop 恒为 0、
滚动后窗口不更新（现象：首屏之后空白，「下拉不加载新卡片」）。

- **滚动事件**：读跨端一致的 `e.detail.scrollTop`，rAF 节流（跟手、不用 debounce）。
- **几何测量**：H5 用 DOM 实测（`clientHeight` / `getComputedStyle` /
  `getBoundingClientRect`）；小程序无 DOM，用
  `uni.createSelectorQuery().in(instance.proxy)` 实测 scroll-view 高度、grid 的
  `gridTemplateColumns`/`rowGap`、首子元素高度。
- **首帧估算**：小程序挂载时先用 `uni.getSystemInfoSync()`（windowWidth/windowHeight）
  估算列数、卡高、视口高，否则首帧拿不到几何会降级全量渲染 ~1025 张卡；
  measure 后用实测值覆盖。
- **回顶**：小程序不能直接写 DOM scrollTop，用受控 `:scroll-top`。该属性仅在值
  变化时滚动，故回顶时先置非 0、`nextTick` 归 0，保证连续回顶也生效。
- **高度前提**：调用方须让组件有确定高度 —— index.vue 在其外包一层
  `flex-1 min-h-0`，组件 `scroller-class` 用 `h-full`（微信 scroll-view 必须有
  明确高度才能滚动）。

## 改 PokemonCard 高度前先想清楚

定高假设要求：同一断点内**每张卡高度恒定**。下面这些改动会打破假设，导致卡片重叠或滚动条长度错误：

- 多行名称（名称长度不固定又不截断）
- 可变徽章数
- 任何随数据变化高度的动态内容

届时两条出路：

1. **逐项测量的虚拟化**：`ResizeObserver` 报高 + 前缀和定位；或
2. **退回 `content-visibility: auto`**：跳绘制但保留全部实例（失去 DOM 节点裁剪，长列表首屏成本回升）。

## 改算法先跑测试

```bash
pnpm test -- virtualWindow
```

窗口算术的边界（首尾行、overscan、列数取整、空列表）都在用例里，动 `computeVirtualWindow` 前先确认这些绿。
