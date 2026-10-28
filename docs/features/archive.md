# 资料中心图鉴栏目（属性 / 招式 / 特性 / 道具 / 蛋组）

资料中心（`pages/data/data.vue`）的「图鉴概览」6 行各自跳一个图鉴栏目，
每个栏目是**列表页 + 详情页**一对，共 10 个页面，注册在 `src/pages.json`
的 `pages/archive/*`：

| 栏目 | 列表页 | 详情页 | 行组件 |
|------|--------|--------|--------|
| 属性 | `archive/types` | `archive/type-detail?slug=` | `archive/TypeRow` |
| 招式 | `archive/moves` | `archive/move-detail?id=` | `archive/MoveRow` |
| 特性 | `archive/abilities` | `archive/ability-detail?id=` | `archive/AbilityRow` |
| 道具 | `archive/items` | `archive/item-detail?id=` | `archive/ItemRow` |
| 蛋组 | `archive/egg-groups` | `archive/egg-group-detail?id=` | `archive/EggGroupRow` |
| 宝可梦总数 | —（`uni.reLaunch` 回 `/pages/index/index`） | — | — |

组件都在 `src/components/archive/`：行组件 ×5、`ItemIcon`（道具图标/占位）、
`EggGroupIcon`（蛋组图标，当前共用占位图）、
`FlavorTextCard`（特性/道具描述卡，按需 `ensureFlavor()`）、
`MoveFlavorCard`（招式描述卡，单条最新说明 + 效果段）、`TypeMatchupCard`（相克表）、
`PokemonMiniList`/`PokemonMiniRow`（详情页的宝可梦反查列表）、
`ArchiveListShell`（列表页骨架：DetailNavbar + `#tools` 插槽 + `#list` 插槽，
加载/空态/列表三态与确定高度的 flex 容器都在壳内；**不含 VirtualList**）。

蛋组栏目只有 15 行（PokeAPI egg_groups id 1..15，元数据在
`constants/eggGroups.ts`，中文兜底名即该处），不虚拟化。行/详情头部用
`EggGroupIcon`（40px 浅紫磁贴槽 + 32px 位图），**当前 15 个蛋组共用同一枚
3D 蛋栏目占位图**（`static/img/egg-group-icons/placeholder.png`，与
`hub-icons/egg.png` 同源，资料中心入口 `data-egg` 也用它）；后续补各蛋组
正式彩图时往该目录加 `<slug>.png` 并在组件内 `ICON_PATHS` 加映射即可。
蛋组 → 宝可梦反查的默认形态去重口径同属性/特性。

详情页的招式卡（`components/pokemon/MoveCard.vue`）可点：`uni.navigateTo` 跳到
`archive/move-detail?id=`。宝可梦详情页（`pages/detail/detail.vue`）的蛋组/特性
信息卡同样可点：model 的 `eggGroupIds`（与 `eggGroups` 名字数组严格同序）与
`abilityIds` + `hiddenAbilityId`（与 `abilities` / `hiddenAbility` 同序）驱动 chip
列表，分别跳 `archive/egg-group-detail?id=` 与 `archive/ability-detail?id=`。

## 数据来源

| 数据 | 来源 | 服务/查询 |
|------|------|-----------|
| 招式列表/数值 | MDAT `moves_data/common.bin` 的 `moves` 表 | `services/pokemon/archive.ts::loadMoveList()`（module 级 promise 缓存） |
| 特性 → 宝可梦 | gen-9 bundle `abilityEntries` join `baseEntries` | `loadAbilityPokemonIndex()`（仅默认形态、三特性槽位 OR） |
| 属性 → 宝可梦 | gen-9 bundle `typeEntries`（双属性 OR） | `loadTypePokemonIndex()` |
| 蛋组 → 宝可梦 | gen-9 bundle `eggGroupEntries`（双蛋组 OR，g1 恒有值，g2=0 跳过） | `loadEggGroupPokemonIndex()`；蛋组元数据（id/兜底名）在 `constants/eggGroups.ts` |
| 属性相克 | `core/data/typechart.ts` | `services/pokemon/typeMatchup.ts`（attack/defenseMatchups 纯函数） |
| 招式/特性/道具名 | PKNM 名称组 lookup（moves/abilities/items 表） | `i18nStore.moveName/abilityName/itemName` |
| 招式/特性/道具描述 | PKFL 描述组 moves/abilities/items 表 | 取最新一条 `i18nStore.moveFlavorText/abilityFlavorText/itemFlavorText`（version=vg_id）；实测各版本组招式说明基本相同，不做版本切换 |
| 特性/招式效果简述 | PKFL `abilityEffects/moveEffects`（**仅 en/fr/de**） | `i18nStore.abilityEffect/moveEffect`；招式效果经 `Move.effect_id` join 改键，非 en/fr/de 回落英文显示，特性则隐藏效果段 |
| 招式分类/目标名 | PKNM `moveDamageClasses`/`moveTargets` 表 | `i18nStore.moveDamageClassName/moveTargetName`（lookup 已收这两张表） |
| 道具图标 | 加密资源 `encrypted-assets/items/<id>.bin`（ZKDX 密文，明文 30×30 PNG） | `resources/itemImage.ts`（与 sprite 同一套 `imageCache`/`imagePersist` 引擎的 item 实例）；404 无资源 → 中性占位盒 |

聚合纯函数（`buildMoveList`/`buildAbilityIndex`/`buildTypePokemonIndex`/
`buildEggGroupIndex`）
不碰网络，测试在 `tests/archiveIndex.spec.ts`；相克在 `tests/typeMatchup.spec.ts`；
flavor 多表构建在 `tests/flavor.spec.ts`。

## 关键约定

- **列表虚拟化**：招式（~900）/特性（~370）/道具（~2200）列表走
  `components/dex/VirtualList.vue`——单列定高（68px）虚拟列表，
  **根元素是 `scroll-view`**（小程序端的滚动容器；H5 同样工作），
  窗口算术复用 `utils/virtualWindow.ts::computeVirtualWindow`（columns=1）。
  属性只有 18 行，不虚拟化。
- **ArchiveListShell 不含 VirtualList（插槽链只有两级）**：各列表页把
  `<VirtualList>` 整体塞进 `#list`，`ArchiveListShell` 只负责 navbar / `#tools` /
  加载·空态 / 给 VirtualList 的 `h-full` 容器。刻意不让壳内嵌 VirtualList 再透传
  作用域插槽 —— 那会形成 **页面 → 壳 → VirtualList 的三级作用域插槽链**，uni-app
  编译到微信时会在壳的循环里重复展开同一个 `<slot>`（报
  `More than one slot named "d" ...`，且只第一行能收到内容，其余行内容缺失）。
  两级（页面 → VirtualList）用动态 slot 名，微信接受。
- **道具图标走加密资源通道**：`ItemIcon` 不是本地静态图，而是和宝可梦立绘
  同一条管线 —— 服务器 `encrypted-assets/items/<id>.bin`（扁平、无 variant），
  经 `resources/itemImage.ts`（`imageCache`/`imagePersist` 的 item 实例）下载 /
  解密 / 缓存，视口懒加载与引用配对复用 `composables/useEncryptedImage.ts`。
  服务器无该道具（404）回落中性占位盒。缓存不变量见 [../caching/sprite-cache.md](../caching/sprite-cache.md)。
- **描述按需加载**：`FlavorTextCard`（特性/道具）、`MoveFlavorCard`（招式）与
  `PokedexEntry` 同模式—— watch id immediate → `ensureFlavorEntry()`，文本直接读
  store（语言切换自动刷新）。招式卡额外 `ensureMoveEffects()`；招式说明只取最新
  版本组一条（各版本组基本相同，无切换必要）。
  描述组回落英文的判定是四张 flavor 表**总 size 为 0**（cs/pt-br/ja-roma），
  单表个别 id 缺失不整包回落。
- **定高前提**：`.archive-row`（global.css）固定 68px，行内标题单行 truncate，
  不能放可变高度内容——同 VirtualGrid 的定高耦合。
