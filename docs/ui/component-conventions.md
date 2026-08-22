# 组件化约定

**先建组件，再写页面。不要先把整页代码堆在 `.vue` 里之后再回头拆。**

## 目录划分

```
src/components/
  shared/    跨页面通用：TabPageShell、ListRow、DetailNavbar、
             FavoriteButton、PokeballLogo、LoginModal、OptionSheet
  pokemon/   宝可梦领域：PokemonCard、TypeBadge、SpecimenHero、
             InfoGrid/InfoCard、StatsChart、MovesList/MoveCard、EvolutionChain
  dex/       图鉴列表上下文：DexToolbar、FilterBar、GenerationDrawer、
             DexEmptyState、FavoritesBanner、VirtualGrid
  calc/      计算器上下文：CalcCard、ChipRow、LevelStepper、
             DamageResultCard、CalcSideCard
  sprite/    图片加载：EncryptedSprite
  (根目录)    NavBar、TabBar（跨页面底栏 / 顶栏，非 shared 子目录）
src/constants/   跨文件共享的数据表（pokemonTypes、generations）
src/pages/<name>/<name>-options.ts   仅该页用的选项/常量表
```

新组件放进已有目录；只有确实出现新的业务上下文时才开新目录。

## 写页面前先套用现成件

- **tab 页**（features/data/mine 这类）直接用 `<TabPageShell title="…" :tabIndex="N">`，
  不要重新写 NavBar + padding + TabBar 骨架。
- **详情类页**用 `DetailNavbar` + `SpecimenHero` + `InfoGrid`/`InfoCard`
  （`detail.vue` 就是标准模板）。
- **列表行**用 `ListRow`（配 `list-row__icon--*` 配色）；**属性徽章**用 `TypeBadge`。
- **单选/多选设置项**点击后弹 `OptionSheet`（底部滑出，支持对勾、副标题、loading、
  多选确认按钮条），不要用 `uni.showActionSheet`——后者不支持多选/副标题/自定义样式。
  非 tab 子页用 `DetailNavbar`，从来源页 `uni.navigateTo` 打开（参考 `pages/settings/`）。
- **表单/选项分组**用 `CalcCard` + `ChipRow` + `LevelStepper`。
- 容器样式用 global.css 已有的 `glass-panel`、`archive-section`、`section-label`，
  不要新写等价的 scoped 版本。

## 硬性规则

1. **页面文件控制在 ~300 行以内。** 超了说明该拆组件，不是等重构再说。
   页面只留：数据获取、页面级状态编排、组件组装。
2. **同一段模板或 CSS 出现第二次就抽组件**，不要复制粘贴后微调。
3. **配色/名称等数据表只能有一处定义。** 属性相关一律从 `src/constants/pokemonTypes.ts` 取
   （`getTypeColor`/`getTypeLabel`/`getTypeShort`），世代号段从 `src/constants/generations.ts` 取。
4. **不要给组件加没人读的 prop / 字段。** 传了但组件不消费的 prop 是死代码，`type-check` 抓不到。
5. **命名避免撞车。** 组件名要反映用途（`calc/PokemonCard.vue` 已改为 `CalcSideCard`）。

## scoped CSS 的特异性陷阱（踩过两次）

如果基础规则（`.list-row__icon`）在组件的 scoped 里，而配色变体
（`.list-row__icon--gold`）经 prop 从页面传入、定义在 global.css，那么编译后
`.list-row__icon[data-v-xxx]` 是 (0,2,0)，会盖掉变体的 (0,1,0)，变体的 `color` 失效。

**规则：基础规则和它的变体必须同处一个作用域** —— 要么都在组件 scoped 里
（`InfoCard.vue` 的 `.info-card__icon--*` 走这条），要么都在 global.css 里
（`.list-row__icon*` 走这条）。

同理：**slot 内容由父组件渲染，带的是父组件的 scope id**，子组件的 scoped 样式选不中它；
跨组件共用的动画/样式（如 `.field-loader`）要放 global.css。

## `<script setup>` 顶层不是模块作用域（踩过一次，两个 bug）

写在 `<script setup>` 顶层的 `const cache = new Map()` 看着像模块级单例，编译后
**落在 `setup()` 内部** —— 每个组件实例一份：

```js
setup(__props) {
  const decryptedCache = new Map();   // ← 每实例独立，不是共享
```

`EncryptedSprite` 因此同时踩了两个坑：缓存命中率恒为 0（实例只查自己那一个 key），
以及 `if (!cache.has(key))` 守卫恒假导致 `revokeObjectURL` 从不执行、Blob URL 永久泄漏。
`type-check` 看不见这类问题。

**规则：需要跨实例共享的状态（缓存、连接池、引用计数）一律放独立 `.ts` 模块**，
组件只调用它的 API。核对方法是拉一次编译产物，确认 `const` 在顶层而不是 `setup(` 之后。
sprite 的现状见 [../caching/sprite-cache.md](../caching/sprite-cache.md)。

## 改完必做

1. `pnpm type-check` —— 0 error
2. `pnpm test` —— 全绿
3. `pnpm dev:h5` 起服务后用**移动端 UA** curl 一遍改动的页面与组件，确认 200
4. 涉及 CSS 变量绑定或 scoped 改写时，额外拉一次编译产物核对
   （`?vue&type=style&index=0&scoped=true&lang.css`）—— 这类问题 `type-check` 看不见
