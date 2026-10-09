# VirtualGrid / VirtualList 定高虚拟化

`src/components/dex/VirtualGrid.vue`（图鉴网格）与 `src/components/dex/VirtualList.vue`
（单列列表）是列表虚拟化核心，**定高**渲染。
DOM 只保留视口附近的行，长列表（~1025 张卡 / 数百行）也只挂载几十个节点。

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

- **滚动事件**：读跨端一致的 `e.detail.scrollTop`，**rAF 节流**（跟手、不用 debounce）。
  一帧内多个 scroll 事件只取最后一次 —— 不节流时，新行进边界处一帧内 scrollTop 的
  中间/回弹值会让窗口首行索引短暂来回，**整屏行内容（含名称）先变成另一条、下一帧
  纠正跳回**（错位回弹）。VirtualGrid / VirtualList 必须同一套节流。
- **几何测量**：H5 用 DOM 实测（`clientHeight` / `getComputedStyle` /
  `getBoundingClientRect`）；小程序无 DOM，用
  `uni.createSelectorQuery().in(instance.proxy)` 实测 scroll-view 高度、grid 的
  `gridTemplateColumns`/`rowGap`、首子元素高度。
- **首帧估算**：小程序挂载时先用 `uni.getSystemInfoSync()`（windowWidth/windowHeight）
  估算列数、卡高、视口高，否则首帧拿不到几何会降级全量渲染 ~1025 张卡；
  measure 后用实测值覆盖。
- **回顶**：小程序不能直接写 DOM scrollTop，用受控 `:scroll-top`。该属性仅在值
  变化时滚动，故回顶时先置非 0、`nextTick` 归 0，保证连续回顶也生效。**数据集变更
  （筛选 / 切赛季赛制）时必须走这套驱动物理 scroll-view 回顶**——只重置内部
  scrollTop 会让物理视口停在原位、窗口却渲染顶部行，视口内整片空白、keyed 行的排名
  错位（`VirtualList` 在对战数据页踩过，已与 VirtualGrid 对齐）。
- **高度前提**：调用方须让组件有确定高度 —— index.vue 在其外包一层
  `flex-1 min-h-0`，组件 `scroller-class` 用 `h-full`（微信 scroll-view 必须有
  明确高度才能滚动）。
- **几何测量必须忽略 0×0（H5 踩过）**：`switchTab` 销毁/塌陷 scroller 时，
  ResizeObserver 会以 `clientHeight=0` 触发**最后一次**。若把它写进
  `viewportHeight`，`active` 翻假 → 窗口算术降级 → `windowEntries` 退回**全量
  ~1025 条**，上千张 eager 卡瞬时挂载、各拉一个 `front.bin`（网络面板里切页突发
  几百个请求；小程序不复现，因其走 SelectorQuery 且切 tab 只 onHide 不卸载，
  `measureMp` 本就带 `>0` 守卫）。`measureDom` 因此只在 `clientHeight>0` 时覆盖，
  离屏/卸载的测量保留上次有效值。判断「该不该降级」只能信活着的正尺寸。

## 虚拟列表内的图片：直接 eager，不用 IntersectionObserver

VirtualGrid / VirtualList 本身已经做了**行级可见性裁剪**（只挂载视口 + overscan
附近的项），比 IntersectionObserver 的像素级判定更激进。因此列表项内的图片
（`PokemonCard` 内 `EncryptedSprite`、`ItemRow` 内 `ItemIcon`）一律传 `eager`：

- 组件被挂载 ⇒ 必在视口附近 ⇒ onMounted 立即加载；
- 滑出窗口 ⇒ VirtualGrid 直接卸载该卡片 ⇒ onUnmounted abort 在途 + release
  （等价于 observer 的离屏取消，且更直接）；
- overscan 2 行 ≈ 200px 提前量，与原 observer 的 200px margin 相当。

**为什么不能再靠 observer 的 `relativeToViewport()`**：微信里被观察节点在
scroll-view **内部**滚动时，相对页面视口的判定不触发（节点被 scroll-view 裁剪），
于是滑动后新卡片的图片其实已下载/解密成功，结果却写不回组件、一直停在骨架 ——
表现为「图已下载但不渲染」。`relativeTo('.scroll-view')` 虽可解，但图片组件在
深层自定义组件内、选不到作为祖先的 scroll-view（组件级 observer 作用域受限），
故虚拟化场景统一走 eager。非虚拟列表（详情页主图等）仍按需 eager / observer。

### 同一 `<image>` 换 id：保留旧图，不要清空（url → url）

mp-weixin 把 scoped-slot 的填充内容编译成**父侧** `wx:for`，且 `wx:key` 被固定成
**位置索引 i0** —— 与子组件 `<slot>` 上写的 `:key` 无关（`:key` 只作为 slot prop
下发、父侧不用）。因此虚拟列表滚动时，同一个原生 `<image>` 实例会被位置复用、
连续换 `pokemon-id`。`useEncryptedImage` 的 id-watch 此时**不能**立刻
`blobUrl = null`：那会把 `<image>` 拆成骨架、下一帧再换新图，即使新图已在缓存
也硬闪一下。做法是：

- id 变化只 abort 在途、**保留旧 blobUrl 与旧引用**（旧图不被 revoke）；
- `load()` 成功拿到新图后，先 `releaseHeld()` 旧引用、再一次性替换 url（url → url）；
- 无 id / `hasSprite=false` / noSprite / 真失败等**真该清空**的分支，由 `load()`
  内部各自 `releaseHeld()`（旧版靠 watch 提前释放，保留旧图后释放职责移到 load）。

原生 `<image>` 换 src 本就保留旧画面直到新图就绪，配合上面才有平滑滚动。

## VirtualList：单列版，v-for 直接写在 `<slot>` 上

`src/components/dex/VirtualList.vue` 是 VirtualGrid 的**单列定高版**（对战数据排行、
招式 / 特性 / 道具列表用），两者同构：

- 根 `<scroll-view scroll-y>` → wrap 撑 spacer → inner 绝对定位；
- **`v-for` 与 `:key` 直接写在 `<slot>` 元素上**，不在 slot 外再包 `<view>`；
- inner 是**单列 grid**（`display:grid; grid-template-columns:minmax(0,1fr);
  grid-auto-rows:<行高>px`），填充组件是 grid item，默认 stretch 到固定行高。

**不要**在 slot 外包一层 view 再把 v-for 放 view 上：数据 key 时框架移动 view、其内部
按位置命名的插槽 `d-N` 在 setData 过渡帧重名（`More than one slot named "d-N"`）；
若退回位置 key 又会让每个槽位每次滚动换数据、叠加旧的清空逻辑而闪烁。v-for 直接在
slot + 单列 grid 同时避开两者。图片仍须 `eager` 且换 id 保留旧图（见上两节）。

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
