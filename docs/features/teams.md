# 自建队伍 · 组队器页面（Teams）

功能页签 → 「我的队伍」进入，分两层页面。数据契约见
[../data/teams.md](../data/teams.md)（普通 JSON、登录后保存、内容对后端不透明）。

要点：每支队伍含赛制（单打/双打）+ **最多 6 个成员**；成员只存稳定 id，展示名渲染层解析；
写操作前统一过登录闸门。

## 1. 我的队伍 `pages/teams/teams`

- 未登录 → 登录引导卡（`authGate.open()`，不主动弹层）。
- 已登录 → 摘要列表（`store.load(true)`，按 updated_at 降序）；空态 + 「新建队伍」。
- 行：`teams/TeamListRow.vue`（队名 + 更新时间 UTC + ⋯）。
- 行内「⋯」→ `OptionSheet`：重命名（进编辑页）/ 删除（`uni.showModal` 二次确认 → `store.remove`）。
- 新建 → `store.beginCreate(defaultName)` → `team-edit`（无 id）；点行 → `team-edit?id=<id>`。

## 2. 编辑队伍 `pages/teams/team-edit`

DetailNavbar 右槽「保存」；顶部队名输入 + `FormatSwitch`（赛制）；成员卡列表 + 添加位。

成员卡 `teams/MemberCard.vue`（折叠头 → 展开内联编辑，状态自持）：

| 字段 | 选择方式 |
|------|----------|
| 物种（含形态） | 全屏覆盖层 `teams/MemberPicker.vue`：SearchBar + `VirtualList`，多形态先选物种再选形态 |
| 特性 | `OptionSheet` single，选项 = 该形态 ability1/2 + 隐藏（标注「隐藏特性」） |
| 道具 | `OptionSheet` single，全量道具（搜索，含「无」） |
| 性格 | `OptionSheet` single，21 种 Champions Stat Alignment（副行 `↑up ↓down`） |
| 招式 | `OptionSheet` multi（`max=4`，搜索；已选 `SelectedMoveChip` 可移除） |
| SP 加点 | `teams/SpreadEditor.vue`：六维 LevelStepper（0..32）+ 合计 |
| 一键填充 | 「套用对战热门配置」→ meta rank1 配置反查 id；无统计则降级提示 |

## 数据流

- HTTP：`api/teams.ts` 走 `rest`（自动补 `/api/v1`，Bearer 头，204 用 text）。
- 状态/编排：`store/teams.ts` —— 摘要缓存、`draftName/draftPayload`、登录闸门、错误码分支。
- 归一/校验：`team-model.ts` 纯函数（成员≤6、招式去重≤4、SP clamp、未知字段保留、
  名字 1–50、payload ≤32KiB）。
- 成员选项：`member-options.ts`（形态 abilityEntries → 特性 id；`loadMovesForPokemon` 去重）。
- 热门配置：`popular.ts` —— `link` 反查 slug + meta config + 英文名反查 id（en names bundle）。
- 登录：`authGate.requireLogin()`，`LoginDismissedError` 静默中止；两页各挂 `LoginModal`。
