# Proposal

## Why

现有「能力值计算器」只能临时推算能力，刷新或返回后配置即丢失，也无法记录招式与道具。
用户希望把常用的单只宝可梦配置沉淀成**可命名、可复用、跨设备同步**的个人模板；同时不希望
被登录门槛挡住——未登录也能先建、先看，只有主动「保存到账号」时才登录上云。

## What Changes

- 新增**个人宝可梦模板**能力：对单只宝可梦的配置进行新建、查看、编辑、改名、删除（列表 → 编辑）。
- 模板内容（payload）对齐 `docs/data/templates.md`：
  - 公共字段：规则版本 `ruleset`、含形态的 `pokemon_id`、性格 PokeAPI id、招式 ≤4、道具（可空）；
  - 标准版（standard）记 IV / EV，Champions 版记能力点 SP；全部使用稳定数值 id。
- **本地优先**：未登录即可建立、查看、编辑模板并**保存草稿到本地**（`uni` storage）；列表与编辑页
  对本地和已上云条目统一可用，条目标注「未存档 / 待同步 / 已同步」状态。
- **「保存」即上云**：已登录直接新建（POST）/更新（PUT）；未登录走登录闸门（authGate），登录成功后
  继续提交。按后端稳定 `code` 处理 401 / 400 / 404 / 409。
- 退出编辑页时做脏检查，提供「保存草稿 / 放弃更改 / 取消」。
- 能力值计算器**保留纯计算用途**，新增「存为模板」入口把当前配置带入新建编辑页；抽取两者共享的
  「配置编辑内核」组件以复用，不在两个页面各写一份。
- 等级仅用于本地预览能力值，**不写入** payload（标准模板按竞技口径默认 Lv50 预览，Champions 固定 Lv50）。

## Capabilities

### New Capabilities
- `pokemon-templates`: 单只宝可梦配置模板的建立与管理——配置编辑、能力值实时预览、未登录本地草稿、
  登录后云端持久化与跨设备同步，以及模板列表 / 改名 / 删除。

### Modified Capabilities
<!-- 无既有 spec；能力值计算器仅新增跳转入口并抽取共享组件，行为契约由 pokemon-templates 承载，
     不在此修改其它 capability。 -->

## Impact

- **新增**：
  - `src/services/api/templates.ts`（薄 HTTP 客户端，仿 `teams.ts`），并从 `src/services/api/index.ts` 导出；
  - `src/services/templates/template-model.ts`（payload 类型、约束常量、归一 / 校验、性格 id 互转、未知字段保留）；
  - `src/store/templates.ts`（本地存储读写、草稿、同步状态与 CRUD，仿 `store/teams.ts`）；
  - `src/pages/templates/templates.vue`、`src/pages/templates/template-edit.vue`。
- **抽取 / 修改**：把 statcalc 的配置编辑部分抽成共享内核组件（`src/components/`），
  `src/pages/statcalc/statcalc.vue` 瘦身为纯计算器并加「存为模板」入口。
- **路由 / 入口**：`src/pages.json` 增加两条模板路由；`src/pages/features/features.vue` 加入口（必要时
  `src/pages/mine/mine.vue` 增加列表入口）。
- **i18n**：`src/services/i18n/ui-messages.ts` 增加 `templates` 文案（zh-Hans 与 en 同步）。
- **后端依赖**：`/api/v1/templates` 五个端点（已存在，见 `docs/data/templates.md`）。
- **测试**：为 template-model 的纯函数与 store 的草稿 / 同步状态流转新增 vitest 用例。
