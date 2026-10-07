# Design

## Context

- 现有能力值计算器 `src/pages/statcalc/statcalc.vue` 是「配置 + 计算」耦合的单页：含规则版本分段、
  宝可梦 / 等级 / 性格选择、六维 IV/EV（或能力点 SP）输入与实时结果，但**没有招式、道具，也不持久化**。
- 仓库已有两套可复用范式：
  - **teams**：opaque payload + 薄 API 客户端（`services/api/teams.ts`）+ 纯函数 model
    （`services/teams/team-model.ts`）+ Pinia store（`store/teams.ts`）+ `authGate` / `LoginModal`。
  - **favorites**：本地存储为大本营（`store/pokemon.ts` 中 `load/saveLocalFavorites`），登录后合并。
- 后端 `/api/v1/templates` 提供 5 个端点，**没有 bulk 合并端点**，且存在重名（409）与每用户 100 条配额。
- 数据事实：bundle 中非默认形态的宝可梦 `id` 本身即 10000+（前端无需换算）；`NatureDef` 同时携带
  WASM 内部 `id`（0..24）与 PokeAPI `pokeId`（1..25）。

## Goals / Non-Goals

**Goals:**
- 两个入口（计算器 / 模板）共享同一套「配置编辑内核」，不重复实现宝可梦、性格、六维输入与能力计算。
- 以本机存储为大本营：未登录即可完整建立 / 查看 / 编辑 / 存草稿；仅「保存到账号」触发登录。
- 分层与命名严格对齐 teams / favorites，降低认知与维护成本。

**Non-Goals:**
- 不改动后端；不为 Champions 缺失的新道具补 PokeAPI id（本次写 `null`，另开任务）。
- 不做模板与队伍之间的互相转换，不做招式 / 道具检索体验的增强。
- 不持久化等级；不引入 DEK / 加密（普通用户 JSON）。

## Decisions

### 1. 两个独立入口 + 共享内核，不做页内开关
模板天然需要「列表 → 编辑」来浏览 / 改名 / 开关式开关无法承载列表，最终仍会退化成独立模块；
且计算器要零摩擦（不登录、无保存干扰），模板要命名与管理。故保留独立的计算器页，新增模板列表 /
编辑页，二者复用抽取出的内核。
- 备选：单页 + 开关。被否——无列表管理能力，且把两种心智与登录摩擦混在同一页。
- 软衔接：计算器加单向「存为模板」，把配置带入新建编辑页（内存态），不做反向开关。

### 2. 分层（对齐 teams）
- `services/api/templates.ts`：薄 HTTP 客户端，`getToken()` 拼 Bearer，不做领域 clamp；类型区分
  `TemplateSummary`（列表）与 `Template`（详情）。从 `services/api/index.ts` 以 namespace 导出。
- `services/templates/template-model.ts`：payload 类型、约束常量（IV/EV/SP 范围、EV 总 510、SP 总 66）、
  归一 `normalizePayload`、校验 `validateTemplate`、性格 id 互转、**未知字段保留**（前向兼容）。纯函数、无平台依赖、可单测。
- `store/templates.ts`：本地存储读写、草稿（draft）、同步状态机与 CRUD 编排、错误码分支；
  返回可判别结果（`SaveOutcome` 等），i18n 文案留给页面映射，store 不依赖 vue-i18n。

### 3. 本机存储：单 key 存整份记录数组
仿 favorites，用一个 key（`pokemonTemplates`）存 `TemplateRecord[]`：
`{ id, name, payload, createdAt, updatedAt, sync }`。启动 `getStorageSync` 读入，每次变更经 store action
`setStorageSync` 写回并 try/catch。单条 payload 仅数百字节、上限 100 条，体积无压力。
- 备选：每模板一个 key。被否——列表需多次读取，墓碑与排序也难统一管理。

### 4. 同步状态机：保存才上云，不做后台自动同步
状态：`local`（未存档）/ `synced`（已同步）/ `dirty`（待同步）/ `deleted`（墓碑）。
与 favorites 的「操作即实时同步」不同，模板**只在用户点保存时上云**：后端无 bulk、有重名 / 配额冲突，
且不应把随手草稿自动推入账号。保存成功后用响应 id 回写并置 `synced`。

### 5. 草稿脏检查
编辑页持有「上次已持久化快照」（新建为空、打开时为该记录内容）。当前 draft 与快照比对得出是否脏；
返回时按「无改动直接走 / 有改动三选（保存草稿 · 放弃 · 取消）」处理。保存草稿：新建写 `local`、
已上云写 `dirty`。

### 6. 共享配置编辑内核
从 statcalc 抽出内聚组件（建议放 `src/components/templates/` 或 `components/calc/`）：
- 规则版本分段、宝可梦选择行、性格 / Stat Alignment 选择、六维输入 + 实时结果
  （底层继续用 `StatInputRow.vue`、`statcalc-engine.ts` 与 `statcalc-options.ts`，不改其纯函数契约）。
- 计算器页 = 内核 + 重置（不含名称 / 招式 / 道具 / 保存）；模板编辑页 = 名称 + 内核 + 招式卡 + 道具行 + 保存。
- 招式块复用 teams 的交互：`OptionSheet`（multi / max 4）+ `loadMovePoolForForm` 取可学招式池，
  已选项用 `SelectedMoveChip`；道具用 `OptionSheet` + `i18nStore.lookup.items`。

### 7. 存储口径映射（在 model 层完成）
- 性格：编辑器内部沿用 WASM `id`（0..24）；保存时取 `NatureDef.pokeId`（1..25），读回时按
  `pokeId → 内部 id` 反查。Champions 的 21 种过滤维持现状。
- 宝可梦：直接用 `selected.id`（非默认形态在 bundle 中已是 10000+），**不做** +10000 换算，也不拆 species/form。
- 道具：存 PokeAPI item id；Champions 中 PokeAPI 尚不存在的道具写 `null`。

## Risks / Trade-offs

- [登录账号在其它设备已有模板 / 改名，本地与云端分叉] → 保存与登录同步时先 `GET /templates` 按 id 合并，
  冲突（409）就地提示改名；不做静默覆盖。
- [本机 storage quota / 沙箱失败] → 写入 try/catch，内存 state 保留并提示，仿 favorites。
- [抽取内核影响现有计算器] → 保持 `statcalc-engine` / `statcalc-options` 纯函数与 `statcalc.spec.ts` 不变，仅做薄封装组合。
- [SP 机制为社区推断口径] → 取值集中在 model 常量，后端不解析，官方口径更新时只改常量。
- [登出后删除云端条目的墓碑，在登录到「另一个账号」时误删] → 登录同步先 GET，墓碑仅当该账号云端列表确含此 id 时才 DELETE，否则忽略并清除墓碑。

## Migration Plan

纯前端新增，无数据迁移：本机 key 首次缺省按空数组处理；后端端点已就绪，无 breaking 变更。
回滚 = 移除入口与新增文件（本机 key 可保留，不影响其它功能）。

## Open Questions

- 模板列表入口除「功能」页外，是否同时在「我的」页放置（不影响架构，落地时可定）。
- 是否需要「一键把全部本地模板上云」的批量操作；当前按需逐条保存、冲突逐条处理，批量能力可后续再议。
