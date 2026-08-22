# VirtualGrid 定高虚拟化

`src/components/dex/VirtualGrid.vue` 是图鉴列表的虚拟化核心，**定高**渲染。
DOM 只保留视口附近的行，长列表（~1025 张卡）也只挂载几十个节点。

## 工作方式

- 窗口算术抽成纯函数 `src/utils/virtualWindow.ts::computeVirtualWindow`，
  按「行」算偏移，off-by-one / 越界由 `tests/virtualWindow.spec.ts` 守着。
- 卡片高度**不硬编码**：运行时用首个渲染子元素实测（历史实测约 98px @ mobile、106px ≥640px）。
- 列数与 gap **不写在 JS 里**：从 `getComputedStyle(grid).gridTemplateColumns` 读回来，
  断点只在组件的 `grid-class` 里定义一次，避免 JS 和 CSS 两套布局各说各话。

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
