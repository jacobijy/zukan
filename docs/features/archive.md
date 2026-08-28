# 资料中心图鉴栏目（属性 / 招式 / 特性 / 道具）

资料中心（`pages/data/data.vue`）的「图鉴概览」5 行各自跳一个图鉴栏目，
每个栏目是**列表页 + 详情页**一对，共 8 个页面，注册在 `src/pages.json`
的 `pages/archive/*`：

| 栏目 | 列表页 | 详情页 | 行组件 |
|------|--------|--------|--------|
| 属性 | `archive/types` | `archive/type-detail?slug=` | `archive/TypeRow` |
| 招式 | `archive/moves` | `archive/move-detail?id=` | `archive/MoveRow` |
| 特性 | `archive/abilities` | `archive/ability-detail?id=` | `archive/AbilityRow` |
| 道具 | `archive/items` | `archive/item-detail?id=` | `archive/ItemRow` |
| 宝可梦总数 | —（`uni.reLaunch` 回 `/pages/index/index`） | — | — |

组件都在 `src/components/archive/`：行组件 ×4、`ItemIcon`（道具图标/占位）、
`FlavorTextCard`（描述卡，按需 `ensureFlavor()`）、`TypeMatchupCard`（相克表）、
`PokemonMiniList`/`PokemonMiniRow`（详情页的宝可梦反查列表）、
`ArchiveListShell`（列表页骨架：DetailNavbar + SearchBar 插槽 + 虚拟列表）。

## 数据来源

| 数据 | 来源 | 服务/查询 |
|------|------|-----------|
| 招式列表/数值 | MDAT `moves_data/common.bin` 的 `moves` 表 | `services/pokemon/archive.ts::loadMoveList()`（module 级 promise 缓存） |
| 特性 → 宝可梦 | gen-9 bundle `abilityEntries` join `baseEntries` | `loadAbilityPokemonIndex()`（仅默认形态、三特性槽位 OR） |
| 属性 → 宝可梦 | gen-9 bundle `typeEntries`（双属性 OR） | `loadTypePokemonIndex()` |
| 属性相克 | `core/data/typechart.ts` | `services/pokemon/typeMatchup.ts`（attack/defenseMatchups 纯函数） |
| 招式/特性/道具名 | PKNM 名称组 lookup（moves/abilities/items 表） | `i18nStore.moveName/abilityName/itemName` |
| 招式/特性/道具描述 | PKFL 描述组 moves/abilities/items 表 | `i18nStore.moveFlavorText/abilityFlavorText/itemFlavorText` |
| 特性/招式效果简述 | PKFL `abilityEffects/moveEffects`（**仅英文**） | `i18nStore.abilityEffect/moveEffect`，非英文语言隐藏效果段 |
| 招式分类/目标名 | PKNM `moveDamageClasses`/`moveTargets` 表 | `i18nStore.moveDamageClassName/moveTargetName`（lookup 已收这两张表） |
| 道具图标 | 本地静态 `src/static/img/Artwork Items/aitem_<id>.png`（390 张） | `constants/itemIcons.ts::itemIconUrl(id)`，无图返回 null → 占位盒 |

聚合纯函数（`buildMoveList`/`buildAbilityIndex`/`buildTypePokemonIndex`）
不碰网络，测试在 `tests/archiveIndex.spec.ts`；相克在 `tests/typeMatchup.spec.ts`；
flavor 多表构建在 `tests/flavor.spec.ts`。

## 关键约定

- **列表虚拟化**：招式（~900）/特性（~370）/道具（~2200）列表走
  `components/dex/VirtualList.vue`——单列定高（68px）虚拟列表，
  **根元素是 `scroll-view`**（小程序端的滚动容器；H5 同样工作），
  窗口算术复用 `utils/virtualWindow.ts::computeVirtualWindow`（columns=1）。
  属性只有 18 行，不虚拟化。`ArchiveListShell` 用 flex 布局给 VirtualList
  确定高度，不嵌套 scroll-view。
- **道具图标 manifest**：`src/static` 不经过 vite 模块图（原样拷贝），
  不能用 `import.meta.glob`；`scripts/gen-item-icons.mjs` 扫描目录生成
  `constants/itemIcons.ts`（id 集合 + URL，目录空格 encode 为 `%20`），
  增删图标后跑 `pnpm gen:item-icons`。无图道具显示中性占位盒。
- **描述按需加载**：`FlavorTextCard` 与 `PokedexEntry` 同模式——
  watch id immediate → `ensureFlavor()`，文本直接读 store（语言切换自动刷新）。
  描述组回落英文的判定是四张 flavor 表**总 size 为 0**（cs/pt-br/ja-roma），
  单表个别 id 缺失不整包回落。
- **定高前提**：`.archive-row`（global.css）固定 68px，行内标题单行 truncate，
  不能放可变高度内容——同 VirtualGrid 的定高耦合。
