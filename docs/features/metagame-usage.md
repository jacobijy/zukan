# 对战数据 · 宝可梦使用率排行榜

资料中心（`pages/data/data.vue`）新增「对战」分区，点「对战详情」进入对战数据子页，
按 **赛制（单人 Singles / 双人 Doubles）× 赛季（当前 / 历史）** 展示宝可梦**使用率排行榜**。

- 路由：`pages/meta/meta`（注册在 `src/pages.json`，`navigationStyle: custom`）。
- 页面用 `components/archive/ArchiveListShell.vue`：内建 DetailNavbar + 单列 68px 定高
  虚拟列表 + glass-panel + loading/empty，整体复刻 `pages/archive/moves.vue`。
- 控制区在 Shell 的 `#tools`：
  - `components/meta/FormatSwitch.vue` —— 单人/双人两段连体分段控件。
  - `components/archive/FilterChipButton.vue` —— 赛季选择按钮，点击弹
    `components/shared/OptionSheet.vue`（单选；当前赛季在副标题标「当前」）。
- 行组件 `components/meta/UsageRankingRow.vue`：排名（前三名金色）+ `sprite/EncryptedSprite`
  （`variant="front"`、96px 像素图，省带宽）+ 名称 + 使用率进度条 + 百分比；
  点行 `uni.navigateTo` 到 `pages/detail/detail?id=<speciesId>`。

## 数据链路（后端尚未就绪）

代码在 `src/services/meta/`，刻意分两层，让后端接入时只动取数一处：

| 文件 | 职责 |
|------|------|
| `types.ts` | **后端 DTO 契约**（snake_case：`UsageEntryDTO`/`UsageResponseDTO`/`SeasonDTO`）与 UI 模型（`UsageRankingItem`/`MetaSeason`） |
| `adapter.ts` | **纯函数、零平台依赖**：`toUsageRanking`（降序、过滤无效行、0..1→百分比、进度条相对榜首）、`toSeasonList`（当前赛季置顶） |
| `mock.ts` | ⚠️ 后端缺席期唯一数据出口，返回 **DTO 形态**；每赛制 30 条、1 当前 + 2 历史赛季。后端就绪后删除 |
| `service.ts` | module 级 promise 缓存（按 format / `format:season` 键，失败摘除可重试）；含唯一真实接入点说明 |
| `index.ts` | barrel |

进度条刻度是**相对当前榜单最大值**（榜首=100%）：真实使用率绝对数值偏小，用 0–100% 绝对
刻度会让多数条几乎不可见。

### 后端就绪时怎么接

1. 新建 `src/services/api/meta.ts`：用 `rest.get` 拉 `/meta/seasons?format=` 与
   `/meta/usage?format=&season=`（返回须符合 `types.ts` 的 DTO 契约），在
   `src/services/api/index.ts` 注册 `export * as metaApi from './meta'`。
2. 把 `service.ts` 的 `fetchSeasonsDto` / `fetchUsageDto` 改为调 `metaApi`，删除 `mock.ts`。
   **页面与 adapter 不用动。**

## 测试

- `tests/metaAdapter.spec.ts`：降序、0..1→百分比、相对 barWidth、无效行过滤、当前赛季置顶。
- 定高约束：行根节点用全局 `.archive-row`（68px），**不在根节点外加 margin**，否则破坏
  VirtualList 的定高步进；名称单行 truncate、进度条固定 6px。
