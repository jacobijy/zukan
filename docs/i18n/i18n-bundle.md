# 多语言

语言文本以加密 FlatBuffers bundle 分发，每语言独立两个文件：名称组 `names.bin` 和描述组 `flavor.bin`。
下载解密复用 `resourceManager` 基础设施（见 [../caching/resource-cache.md](../caching/resource-cache.md)）。

实现位于 `src/services/i18n/`，状态在 `src/store/i18n.ts`。

## 两套独立的语言设置

| 设置 | storage key | 含义 | 当前完整提供 |
|------|-------------|------|--------------|
| **UI 语言** | `zukan_ui_language` | 界面静态文案（按钮、标签等） | `zh-Hans`、`en` |
| **内容语言** | `zukan_content_language` | 宝可梦游戏数据（物种/招式/特性名与描述） | 服务端打包的 14 种 bundle id |

两者默认均为 `'auto'`，按系统语言解析；用户可各自独立切换。
- 内容语言 id 与服务端 `languages.csv` / bundle 目录名严格一致（`zh-hans` 等，**小写带连字符**）。
- UI locale 是 `zh-Hans` / `en`（中文用大写 H），`toUiLocale()` 把所有 `zh-*` 映到简中、其余映到英文。
- 系统检测 `detectSystemLanguage()` 优先 `uni.getSystemInfoSync`，回退 `navigator.language`，兜底 `zh-hans`。

代码见 `src/services/i18n/languages.ts`。

## 14 种内容语言

`zh-hans zh-hant en ja ja-hrkt ja-roma ko fr de es es-419 it pt-br cs`

远端路径：
```
/assets/encrypted/fb/i18n/<lang>/names.bin
/assets/encrypted/fb/i18n/<lang>/flavor.bin
```

## bundle 结构

### 名称组（PKNM，root `I18nNamesBundle`）

- schema：`src/infra/wasm/schemas/i18n_names_bundle.fbs`
- 含 `language_id` / `language`，以及 28 张表。特殊形状：
  - `species: [SpeciesName]`（id + name + genus）
  - `forms: [FormName]`（id + form_name + pokemon_name）
  - `locations`、`shapes`
  - 其余 `moves`/`abilities`/`items`/`types` 等是 id + 单文本的 `NamedEntry`
- 体积 ~170–290 KB，界面就近按需加载。

### 描述组（PKFL，root `I18nFlavorBundle`）

- schema：`src/infra/wasm/schemas/i18n_flavor_bundle.fbs`
- `text_pool: [string]`：去重字符串池，`text_pool[0]` 恒为空串表示「无文本」。
- `species`/`moves`/`abilities`/`items` 是 `FlavorRef { id, text, version }`，
  `text` 是池下标；`ability_effects`/`move_effects` 是 `ProseRef`（仅英文有数据）。
- 体积 ~600 KB–2.7 MB，占总体积约 90%，延迟 / 按需加载。

## 名称注入与回落

`src/store/i18n.ts` 加载 PKNM 后构建查找表，`pokemon.ts::mergeBundleToModel` 通过
`NameResolvers`（species/genus/form/ability/eggGroup）取名：

- store 未就绪时 resolver 为 `null`，merge 回落占位符（`pokemon-{id}` / `form-{id}` / 数字 id）；
- 名称就绪后 store 触发一次重映射，占位符被真实名替换。

### 上游数据缺口与回落

| 语言 | 名称组 | 描述组 | 效果文本 |
|------|--------|--------|----------|
| en, ja, ja-hrkt, ko, zh-hans, zh-hant, fr, de, es, es-419, it | 完整 | 完整 | 仅英文有 |
| ja-roma | 仅物种名 | 空 | 无 |
| cs, pt-br | 整体为空 | 空 | 无 |

回落基线是 `en`（`FALLBACK_LANGUAGE`）：首选 bundle 为空时整体回落英文；
`ja-roma` 这类局部缺口按字段回落，有数据的字段用自身，缺的字段 fallback en。

## form 名称的 id 重映射

前端用 **pokemon id** 查形态名，但 PokeAPI 形态表主键是 pokemon_forms id（两个不同自增空间）。
后端 `sync-i18n.py` 打包 PKNM 时已把 form 名主键从 form_id 改写成 pokemon_id。
详见 [../data/bundle-decode.md](../data/bundle-decode.md) 「三套 id 空间」一节 —— 改形态名错位先查那里。

## 图鉴描述（flavor）的按需加载

描述组不随 boot / 名称预取（体积占 i18n 约 90%），由详情页的
`pokemon/PokedexEntry.vue` 按需触发：

- 纯函数在 `src/services/i18n/flavor.ts`：`buildSpeciesFlavor(bundle)` 把
  `species: FlavorText[]` 收成 `speciesId → 文本`。
- **同一物种按 version_id 存了多条**（每个游戏版本一条），构建时只保留
  **version 最大**（最新）的一条；打包顺序不保证升序，故显式比较而非取最后。
- 文本经 `cleanFlavorText` 清理：去软连字符 U+00AD、把游戏内换行
  （`\n`/`\f`/`\r`）折成空格。
- store 侧：`ensureFlavor()` 并发去重加载当前语言，`speciesFlavorText(speciesId)`
  同步查询；切换内容语言时 `flavor` 置空，下次进详情重载。描述是 **species 级**，
  用 `speciesId` 查（形态共享）。
- **回落按整包而非逐 id**：英文 flavor 包 ~2.7MB（多版本×全表），故完整语言
  （zh-hans / ja / … 11 种）直接用首选包、**不拉英文**；仅当首选包构建出空 Map
  （cs / pt-br / ja-roma 描述组为空）时才回落英文。这与名称组「总是先载英文基线
  再 overlay」不同——名称包小，flavor 包大。

## UI 静态文案

UI 文案不走进程 bundle，写在 `src/services/i18n/ui-messages.ts`（按 locale 分组的消息表），
`ui-i18n.ts` 提供查找。新增 UI 语言：扩展 `UiLocale`、`UI_LANGUAGES`，补对应消息。

## 启动与切换

- `boot.ts` 预取最新世代数值 bundle + 解析后的内容语言名称组（`prefetchI18nNames`）。
- 切换内容语言：`resourceManager.getI18nNames(lang)` → store 更新查找表 → 模型重映射；
  需要描述时再 `prefetchI18nFlavor(lang)`。

## 缓存 key

```
fb:v{N}:i18n:names:<lang>
fb:v{N}:i18n:flavor:<lang>
```

版本号升级由 `pruneOtherVersions` 统一清理。名称 + 描述每语言约占 2 条，不挤占数值 bundle 的内存 LRU。
