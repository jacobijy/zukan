# 组件化约定

**先建组件，再写页面。不要先把整页代码堆在 `.vue` 里之后再回头拆。**

## 目录划分

```
src/components/
  shared/    跨页面通用：TabPageShell、ListRow、DetailNavbar、
             FavoriteButton、PokeballLogo、LoginModal、OptionSheet、SearchBar
  pokemon/   宝可梦领域：PokemonCard、TypeBadge、SpecimenHero、
             ShinyToggle（闪光开关）、GenderSlider（性别滑块，蓝红双色 + genderRate 门禁）、
             InfoGrid/InfoCard、StatsChart、MovesList、MoveCard、EvolutionChain、
             PokedexEntry（图鉴描述，按需取 flavor）、PokedexVersionPicker（描述按游戏版本切换的软件图标条）
  dex/       图鉴列表上下文：DexToolbar、FilterBar、GenerationDrawer、
             DexEmptyState、FavoritesBanner、VirtualGrid（定高网格，scroll-view 根元素跨端）、
             VirtualList（单列定高虚拟列表，scroll-view 根元素，archive 列表用）
  archive/   资料中心图鉴栏目：MoveRow/AbilityRow/ItemRow/TypeRow、
             ItemIcon（道具图标，走加密图片通道）、FlavorTextCard（特性/道具描述）、
             MoveFlavorCard（招式描述）、TypeMatchupCard（相克表）、
             PokemonMiniList/PokemonMiniRow、
             ArchiveListShell（列表页骨架，#list 插槽注入 VirtualList，不内嵌）
  calc/      计算器上下文：CalcCard、ChipRow、LevelStepper、
             DamageResultCard、CalcSideCard、StatInputRow
  sprite/    图片加载：EncryptedSprite（宝可梦立绘，走加密图片通道）
  meta/      对战数据：FormatSwitch（单人/双人分段）、UsageRankingRow（排行榜行）、
             MetaRateSection（选用率；招式行经 moveRefs 反查属性徽章 + 物理/特殊/变化）、
             BattleItemIcon（道具行赛季版本化加密图标，404 / 未登录回落 bag glyph）、
             SpreadSection（SP 加点分布）、TeammateSection（常见队友）
  teams/     自建队伍：MemberPicker（全屏物种/形态选择）、MemberCard（成员内联编辑，
             内挂 4 个 OptionSheet）、SpreadEditor（SP 六维）、SelectedMoveChip、TeamListRow
  devtools/  dev-only 排障工具：AssetProbeForm、AssetProbeCard（资源探测器）、
             TextBrowseForm、TextEntryRow（i18n 文本浏览；文案硬编码中文，刻意不接 i18n）
  (根目录)    NavBar、TabBar（跨页面顶栏 / 底栏，非 shared 子目录）
src/composables/ 跨组件复用的组合式逻辑：useEncryptedImage（加密图片的视口懒加载 /
             离屏取消 / 引用配对，EncryptedSprite 与 ItemIcon 共用）
src/constants/   跨文件共享的数据表（pokemonTypes、generations、spriteVariants、
             versionIcons（PokeAPI version_id→HOME 软件图标，纯静态 /static 非加密，
             详情页图鉴描述版本切换用，见 software-icons.md））
src/pages/<name>/<name>-options.ts   仅该页用的选项/常量表
```

新组件放进已有目录；只有确实出现新的业务上下文时才开新目录。

## 写页面前先套用现成件

- **tab 页**（features/data/mine 这类）直接用 `<TabPageShell title="…" :tabIndex="N">`，
  不要重新写 NavBar + padding + TabBar 骨架。
- **详情类页**用 `DetailNavbar` + `SpecimenHero` + `InfoGrid`/`InfoCard`
  （`detail.vue` 就是标准模板）。
- **列表行**用 `ListRow`（配 `list-row__icon--*` 配色）；**属性徽章**用 `TypeBadge`。
- **单选/多选设置项**点击后弹 `OptionSheet`（iOS 风格底部面板：标题左、「取消/确定」
  文字按钮在右；选项是扁平行 + 细分割线，选中项右侧蓝色对勾；点选项只打草稿，**确定
  才 emit、取消放弃**——所以 `@update:model-value` 只在点确定后触发）。支持副标题、loading、
  搜索过滤。选项数 ≥ `searchThreshold`（默认 12）时自动出现搜索框，长列表无搜索词时只渲染
  前 `renderLimit` 项兜底。不要用 `uni.showActionSheet`——后者不支持多选/副标题/自定义样式/
  搜索过滤。宝可梦（1000+）、招式池这类长列表务必走 OptionSheet 的搜索（参考 `pages/calc/`）。
  非 tab 子页用 `DetailNavbar`，从来源页 `uni.navigateTo` 打开（参考 `pages/settings/`）。
- **表单/选项分组**用 `CalcCard` + `ChipRow` + `LevelStepper`。
- 容器样式用 global.css 已有的 `glass-panel`、`archive-section`、`section-label`，
  不要新写等价的 scoped 版本。

## 硬性规则

1. **拆不拆组件看「数据隔离」和「可复用」，不看行数。** 满足下面任一条就抽组件：
   - **能与页面其余部分数据隔离** —— 这块 UI 靠 props 进、events 出，自身闭环一片
     状态/逻辑，抽出去后页面不用再关心它的内部状态；
   - **会被复用** —— 第二个地方（现在或可预见）要用到同一段模板/CSS/交互就抽，
     不要复制粘贴后微调（历史重构删掉的 1000+ 行几乎全是这种重复）。
   反过来，单纯行数大、但状态与页面深度耦合又无复用的内联块，不必为凑「短文件」硬拆。
   页面始终只留：数据获取、页面级状态编排、组件组装。
2. **配色/名称等数据表只能有一处定义。** 属性相关一律从 `src/constants/pokemonTypes.ts` 取
   （`getTypeColor`/`getTypeLabel`/`getTypeShort`），世代号段从 `src/constants/generations.ts` 取，
   不要在页面里再写一份 map。
3. **不要给组件加没人读的 prop / 字段。** 传了但组件不消费的 prop 是死代码，`type-check` 抓不到
   （`store/pokemon.ts` 的 `formattedId` 是活例子）。
4. **命名避免撞车。** 组件名要反映用途（`calc/PokemonCard.vue` 已改为 `CalcSideCard`）。
5. **dev-only 页面走「页壳 + 动态 import 实现体」。** 门禁只有一处
   （`src/services/devtools/enabled.ts` 的 `devtoolsEnabled = import.meta.env.DEV`），
   页壳里 `if (!devtoolsEnabled) return;` 之后再 `await import('./Impl.vue')` —— `DEV` 被
   Vite 静态替换成字面量，正式构建该分支恒假，Rollup 连整个分包一起丢掉。每条 `import()`
   都必须是守卫块里的**字面量**（`id === 'x' ? import('./A.vue') : import('./B.vue')`），
   不要用 `loaders[id]()` 查表或 `import('./Dev'+id+'.vue')` 拼接。页壳仍要留在 pages.json
   （静态 JSON 无法条件注册）。核对方式：`pnpm build:h5 && grep -rl "<实现体标识>" dist/build/h5`
   应无命中 —— **只能拉产物验证，`type-check` 与用例都看不见**。详见
   [../security/encryption-pipeline.md](../security/encryption-pipeline.md) 资源探测器小节。

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

## 弹层关闭要直接 `v-if` 卸载，别靠 `transitionend`（踩过一次）

给遮罩/弹层做退出动画时，常见写法是 `v-if="mounted"` + 监听面板的 `transitionend`
再把 `mounted` 置 false。**在 uni-app H5 的 `<view>` 上 `transitionend` 不可靠**
（`propertyName` 匹配尤其不稳），结果节点不卸载：遮罩变透明但 `pointer-events: auto`
还在，全屏盖住下层，把背后的按钮点击吃掉。`OptionSheet` 因此出现「弹一次选择框、
关掉后设置页返回按钮失灵」。

**规则：弹层用 `v-if="visible"` 关闭即卸载，入场用 CSS `animation`，不做退出过渡。**
这是 `LoginModal` 已验证可靠的模式。要等退出动画播完，得在 DOM 元素（非 uni 组件）
上自己绑 transitionend 并兜底 setTimeout，复杂度不值得——直接卸载。

## 改完必做

1. `pnpm type-check` —— 0 error
2. `pnpm test` —— 全绿
3. `pnpm dev:h5` 起服务后用**移动端 UA** curl 一遍改动的页面与组件，确认 200
4. 涉及 CSS 变量绑定或 scoped 改写时，额外拉一次编译产物核对
   （`?vue&type=style&index=0&scoped=true&lang.css`）—— 这类问题 `type-check` 看不见
