# 对战数据 · 使用率排行榜与宝可梦对战配置

资料中心（`pages/data/data.vue`）「对战」分区 → 「对战详情」进入对战数据，分两层页面，
后端接口当前未就绪，全部走 mock DTO → adapter 纯函数 → UI 模型。

## 1. 使用率排行榜 `pages/meta/meta`

按 **赛制（单人 Singles / 双人 Doubles）× 赛季（当前 / 历史）** 展示宝可梦**使用率排行榜**。

- 注册在 `src/pages.json`（`navigationStyle: custom`）；用 `components/archive/ArchiveListShell.vue`
  （内建 DetailNavbar + 单列 68px 定高虚拟列表 + glass-panel + loading/empty）。
- `#tools`：`components/meta/FormatSwitch.vue`（单人/双段分段控件）+
  `archive/FilterChipButton.vue`（赛季按钮 → `shared/OptionSheet.vue` 单选，当前赛季副标题标注）。
- 行组件 `components/meta/UsageRankingRow.vue`：排名（前三金色）+ `sprite/EncryptedSprite`
  （`variant="front"`、96px 像素图）+ 名称 + 使用率进度条 + 百分比。
- **点行进第二个页面**（不进宝可梦基础详情）：
  `navigateTo('/pages/meta/pokemon-meta?id=<speciesId>&format=<fmt>&season=<season>')`。

## 2. 宝可梦对战配置 `pages/meta/pokemon-meta`

展示该宝可梦在传入的赛制 × 赛季下的**特性 / 道具 / 招式选用率**。

- 页壳复刻 `pages/archive/ability-detail.vue`：`DetailNavbar`（title=物种名，
  `fallback-url="/pages/meta/meta"`）+ `scroll-view` 普通滚动（数据量小，不虚拟化）。
- hero（`glass-panel`）：`EncryptedSprite variant="home" eager` + 物种名 +
  赛制 / 赛季上下文胶囊（赛季 label 经已缓存的 `loadSeasons` 反查）。
- 三个分区各用通用组件 `components/meta/MetaRateSection.vue`（有数据才渲染）：
  props `title` / `iconKind: 'ability'|'item'|'move'` / `rows: MetaRateRowVM[]`。
  - 图标分流：item → `archive/ItemIcon`；move → `pokemon/TypeBadgeIcon`（属性贴纸）；
    ability → 中性盒 + spark glyph。
  - 名称在页面 computed 用 `useI18nStore` 的 `abilityName/itemName/moveName` 解析；
    招式 `typeSlug` 由已缓存的 `loadMoveList()`（`typeId`）+ `utils/helpers::typeStrs` join。

## 数据链路 `src/services/meta/`

| 文件 | 职责 |
|------|------|
| `types.ts` | 后端 **DTO 契约**（snake_case：`UsageEntryDTO`/`UsageResponseDTO`/`SeasonDTO`/`CategoryUsageEntryDTO`/`PokemonMetaResponseDTO`）与 UI 模型（`UsageRankingItem`/`MetaSeason`/`CategoryUsageItem`/`PokemonUsageMeta`/`MetaRateRowVM`） |
| `adapter.ts` | **纯函数、零平台依赖**：`toUsageRanking`（排行榜）、`toSeasonList`（当前置顶）、`toCategoryUsage`（类别内降序、过滤、组内相对榜首）、`toPokemonUsageMeta` |
| `mock.ts` | ⚠️ 后端缺席期唯一数据出口，返回 **DTO 形态**。排行榜：每赛制 30 条、1 当前 + 2 历史；配置：mulberry32 确定性伪随机（种子含 id/format/season）从小 id 安全池抽取，任意宝可梦都有数据。后端就绪后删除 |
| `service.ts` | module 级 promise 缓存（赛季按 format、榜单按 `format:season`、配置按 `species:format:season`；失败摘除可重试）；含唯一真实接入点说明 |
| `index.ts` | barrel |

进度条刻度**相对各自榜单 / 类别榜首**（榜首=100%）：真实使用率绝对数值偏小，绝对
0–100% 刻度会让多数条几乎不可见。

### 后端就绪时怎么接

1. 新建 `src/services/api/meta.ts`：用 `rest.get` 拉 `/meta/seasons`、`/meta/usage`、
   `/meta/pokemon`（返回符合 `types.ts` DTO 契约），在 `src/services/api/index.ts`
   注册 `export * as metaApi from './meta'`。
2. 把 `service.ts` 的三个 `fetch*Dto` 改为调 `metaApi`，删除 `mock.ts`。**页面与 adapter 不动。**

## 测试

- `tests/metaAdapter.spec.ts`：排行榜（降序、0..1→%、相对 barWidth、无效过滤、赛季置顶）
  与宝可梦配置（每组各自降序过滤、组内相对榜首、空组）。
- 排行榜行根节点用全局 `.archive-row`（68px）、不在根外加 margin（定高虚拟化前提）；
  配置页不虚拟化，行高自适应。
