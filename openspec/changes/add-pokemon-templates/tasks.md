# Tasks

## 1. 领域模型与校验（template-model）

- [ ] 1.1 在 `src/services/templates/template-model.ts` 定义 payload 类型（`Ruleset` / `Stats` / `StandardTemplate` / `ChampionsTemplate`）与约束常量 `LIMITS`（名称 1–50、payload ≤32 KiB、每用户 100 条、IV 0–31、EV 单项 252 / 总 510、SP 单项 32 / 总 66）；验证类型被后续模块正常导入。
- [ ] 1.2 实现性格 id 互转：编辑器内部 WASM `id`(0..24) ↔ 存储用 PokeAPI `pokeId`(1..25)，并在 Champions 下约束为 21 种（复用 `statcalc-options` 的 `NATURES` / `CHAMPION_ALIGNMENTS`）；验证几个已知条目（如 Adamant pokeId=11）双向转换正确。
- [ ] 1.3 实现纯函数 `normalizePayload`（IV/EV/SP 钳制、EV 对齐 4 倍数、招式去重保序 ≤4、性格与道具合法性回落、**未知字段保留**）与 `validateTemplate`（名称 trim 后长度、payload 序列化大小）；验证对越界输入均回落为合法数据。
- [ ] 1.4 新增 `tests/templateModel.spec.ts`，覆盖钳制、EV 总和 / SP 总和、招式去重截断、性格 id 互转、未知字段保留；验证 `pnpm vitest run templateModel` 通过。

## 2. API 客户端

- [ ] 2.1 新建 `src/services/api/templates.ts`：实现 `listTemplates` / `getTemplate` / `createTemplate` / `updateTemplate` / `deleteTemplate`，类型区分 `TemplateSummary` 与 `Template`，手动拼 Bearer、DELETE 用 `dataType:'text'`；从 `src/services/api/index.ts` 以 `templatesApi` namespace 导出；验证无 token 时抛 401。
- [ ] 2.2 新增 `tests/templatesApi.spec.ts`（仿 `tests/teamsApi.spec.ts`，mock rest），覆盖列表 / 201 新建 / 200 更新 / 204 删除及鉴权头；验证 `pnpm vitest run templatesApi` 通过。

## 3. 本地存储与 Pinia store

- [ ] 3.1 实现本机存储读写（key `pokemonTemplates`）：缺省按空数组、读入时过滤非法项、写入 try/catch（quota 失败仅告警）；定义 `TemplateRecord` 与同步状态 `local` / `synced` / `dirty` / `deleted`；验证读回结构与写入一致。
- [ ] 3.2 新建 `src/store/templates.ts`：实现 `beginCreate` / `open` / `setName` / `replacePayload`、保存草稿（新建写 `local`、已上云改动写 `dirty`）、删除（`local` 直接删、`synced` 未登录打 `deleted` 墓碑）；返回可判别结果且不依赖 vue-i18n；验证草稿写入后重载可还原。
- [ ] 3.3 实现 `save` 上云编排：`authGate.requireLogin()`（关闭 → aborted），新建 POST / 已有 PUT，**用响应 id 回写**并置 `synced`；按 `code` 分支 401（会话恢复重试）/ 400 / 404（摘除本地）/ 409（保留草稿与 id，提示改名）；登录同步先 GET 按 id 合并，墓碑仅当云端列表确含该 id 才 DELETE；验证各分支返回正确的 outcome。
- [ ] 3.4 新增 `tests/templatesStore.spec.ts`（仿 `tests/teamsStore.spec.ts`），覆盖草稿持久化、`local→synced→dirty` 流转、删除墓碑、409/404 分支；验证 `pnpm vitest run templatesStore` 通过。

## 4. 抽取共享配置编辑内核

- [ ] 4.1 把 `statcalc.vue` 中的规则版本分段、宝可梦选择行、性格 / Stat Alignment 选择、六维输入 + 实时结果抽成共享内核组件（落 `src/components/templates/`），props/emit 驱动；保持 `statcalc-engine.ts` / `statcalc-options.ts` 纯函数契约不变。
- [ ] 4.2 将 `src/pages/statcalc/statcalc.vue` 改为「内核 + 重置」的纯计算器页；验证 `pnpm vitest run statcalc` 通过，并在 H5 手动回归两种规则下的选择 / 计算与原行为一致。

## 5. 模板列表与编辑页面

- [ ] 5.1 新建 `src/pages/templates/templates.vue`：新建按钮、记录列表（精灵图 + 名称 + 「未存档 / 待同步 / 已同步」标记）、行内改名 / 删除菜单、空态；未登录直接渲染本机数据、不发请求；验证本地草稿在未登录下正确列出与删除。
- [ ] 5.2 新建 `src/pages/templates/template-edit.vue`：名称输入 + 内核 + 招式卡 + 道具行 + 右上保存；持有「已持久化快照」做脏检查，返回时无改动直接走、有改动弹「保存草稿 / 放弃更改 / 取消」；验证三种退出选择与续编行为正确。
- [ ] 5.3 接入招式与道具：招式用 `OptionSheet`（multi、max 4）+ `loadMovePoolForForm` 取池、已选用 `SelectedMoveChip`；道具用 `OptionSheet` + `i18nStore.lookup.items`（无道具写 null，Champions 缺失 id 写 null）；验证招式去重 ≤4、道具可清空。
- [ ] 5.4 在 `src/pages.json` 增加 `pages/templates/templates` 与 `pages/templates/template-edit` 两条路由；在 `src/pages/features/features.vue` 增加「我的模板」入口（`src/pages/mine/mine.vue` 入口按需）；验证从功能页可进入列表与编辑。

## 6. 文案、入口与文档

- [ ] 6.1 在 `src/services/i18n/ui-messages.ts` 增加 `templates` 文案（列表 / 编辑 / 状态标记 / 保存 / 退出三选 / 错误 / 存为模板），zh-Hans 与 en 同步；验证切换语言后无缺失或回落 key。
- [ ] 6.2 在能力值计算器加入「存为模板」入口，把当前宝可梦、规则版本、性格、IV/EV 或 SP 预填到新建编辑页；验证跳转后配置完整、随后可保存或存草稿。
- [ ] 6.3 在 `docs/` 的 UI 组件 / 页面清单登记新增的内核组件与模板页面（`docs/data/templates.md` 已为 payload 唯一定义，无需改其结构）；验证文档清单与实际文件一致。

## 7. 集成验证

- [ ] 7.1 端到端走查：未登录 → 计算器「存为模板」→ 编辑 → 退出存草稿 → 重进应用草稿仍在 → 登录 → 保存上云 → 重新登录 / 另一设备可见；重名时可改名保存。
- [ ] 7.2 运行全量 `pnpm vitest run` 与项目类型检查（`pnpm type-check`），并分别对 H5 与微信小程序条件编译确认无平台分支错误。
- [ ] 7.3 运行 `openspec validate add-pokemon-templates --strict`，验证 change 与 delta spec 全部合法。
