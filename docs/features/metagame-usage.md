# 对战数据 · 使用率页面（Pokémon Champions）

资料中心「对战」分区 → 「对战详情」进入对战数据，分两层页面。数据是**明文公开 JSON**
（不加密），字段契约见 [../data/battle-usage.md](../data/battle-usage.md)。

要点：标识为 Showdown **slug**（非数字 id）；上游排行榜**只给名次、无使用率数值**；
单只配置含 6 组；历史赛季不提供（仅当前 M6）。

## 1. 使用率排行榜 `pages/meta/meta`

赛制（单人/双人）下的宝可梦排名（各 262）。

- 用 `components/archive/ArchiveListShell.vue`：DetailNavbar + 单列 68px 定高虚拟列表。
- `#tools`：`meta/FormatSwitch.vue`（单人/双人）+ **只读当前赛季标签**（`loadBattleMeta().season`）；
  已移除赛季弹层（历史赛季 404）。
- 行组件 `meta/UsageRankingRow.vue`：排名（前三金色）+ 精灵图 + 名称（+形态小字）；
  **无百分比 / 进度条**（上游 leaderboard 无数值）。
- 点行 → `pages/meta/pokemon-meta?slug=<slug>&format=<fmt>`。

## 2. 宝可梦对战配置 `pages/meta/pokemon-meta`

传入 slug + format，展示该精灵的六组数据：

| 分区 | 组件 | 数据 |
|------|------|------|
| 特性 / 道具 / 招式 | `meta/MetaRateSection.vue` | 英文引用名翻译 + pct + 相对 rank1 的进度条 |
| 性格 | `MetaRateSection` kind=nature | 名称 + pct，副行 `↑up ↓down`（图鉴 stat 名翻译） |
| SP 加点 | `meta/SpreadSection.vue` | pct + 紧凑读数（`HP1 ATK32 SPE32`，0 值省略） |
| 常见队友 | `meta/TeammateSection.vue` | 精灵图 + 名（无 pct），点按在同 format 下跳到该队友配置 |

hero：精灵图（link 映射 speciesId）+ 名 + 格式 / 赛季胶囊。空组自动隐藏。

## 数据流

- HTTP：`http/assetRequest.ts::fetchAssetJson`（`/assets/*`，无 `/api/v1`；复用
  `binaryRequest.buildAssetUrl`，dev `_dc` cache-bust）。
- 取数 / 缓存：`services/meta/service.ts` —— `loadBattleMeta`、`loadLeaderboardSlugs`、
  `loadLinkMap`、`loadPokemonConfig`（均 module promise 缓存）。
- 多语言：`services/meta/battleDict.ts` 按类缓存 `i18n/*.json`；`entryName/entryForm`
  同步查表（当前语言 → en → 原键）。语言代码由 `battleLang.ts::toBattleLang` 从内容语言映射。
- 纯转换：`services/meta/adapter.ts`（按 rank、相对 barWidth、spread 取整钳制、缺组 []）。

上游约每日刷新：后续可先用 `loadBattleMeta().dataVersion` 比对，变化后丢弃 service 缓存重拉。
