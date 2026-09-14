# 多语言

语言文本以加密 FlatBuffers bundle 分发：每语言一个**名称组整包** `names.bin`，
描述组则是**按实体族 × 固定 id 档位的分片**（`flavor/<family>-sNN.bin`）+ 一个
效果文件 `effects.bin`。下载解密复用 `resourceManager` 基础设施
（见 [../caching/resource-cache.md](../caching/resource-cache.md)）。

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
/assets/encrypted/fb/i18n/<lang>/flavor/<family>-s<NN>.bin   # 描述分片
/assets/encrypted/fb/i18n/<lang>/flavor/effects.bin          # 机制效果（部分语言）
```

- `<lang>`：bundle 目录名（`zh-hans` 等）
- `<family>` ∈ `species | moves | abilities | items`（**实体族**）
- `<NN>`：两位零填充**片号**，由实体 id 确定性算出：`NN = (id - 1) // 128`

**契约常量** `FLAVOR_SLICE_SIZE = 128` 前后端各持一份，修改需两端同步并重新打包。

## bundle 结构

### 名称组（PKNM，root `I18nNamesBundle`）——每语言一个整包

- schema：`src/infra/wasm/schemas/i18n_names_bundle.fbs`
- 含 `language_id` / `language`，以及 33 张表。特殊形状：
  - `species: [SpeciesName]`（id + name + genus）
  - `forms: [FormName]`（id + form_name + pokemon_name，主键已重映射成 pokemon id）
  - `locations`、`shapes`
  - 其余 `moves`/`abilities`/`items`/`types` 等是 id + 单文本的 `NamedEntry`
- 体积 ~170–290 KB，界面就近按需加载（boot 预取）。

### 描述组（PKFL，root `I18nFlavorBundle`）——按族 × 档分片，每片自包含

- schema：`src/infra/wasm/schemas/i18n_flavor_bundle.fbs`
- **每片都是一个完整合法的 `I18nFlavorBundle`**（fid `PKFL`）：
  - `text_pool: [string]`：**本片内**去重字符串池，`text_pool[0]` 恒为空串表示「无文本」；
  - **只有所属族的向量非空**：`species` 片只填 `species: [FlavorRef{id,text,version}]`，
    `moves` 片只填 `moves`，其余向量为空数组；
  - `language_id` / `language` 与整包语义一致。
- 现有解码器 `decodeI18nFlavorBundle` **直接复用**——它对「只填部分向量」的 bundle
  天然兼容，无需改动、无需新增 fid。
- **无损保留全部历史版本**：每个实体在每个游戏版本下的描述行都在，不做 latest-only
  裁剪；「取 version 最大一条」是**客户端**的展示决策（见下）。
- 体积：EN species 片最大 ~400 KB，moves/abilities/items 片 8–118 KB；合计约等于
  旧整包 2.7 MB，但每次只拉一片。

### 效果文件（PKFL，`effects.bin`）——无版本维度的机制说明

- `ability_effects` / `move_effects` 是 `ProseRef{id, short_effect, effect}`，**无 version**，
  每条只有一句简述 + 详述（「10% 概率畏缩」「令目标睡眠」）。
- `move_effects` 的主键是上游 **`move_effect_id`**（稀疏，1..10006），**不是 move id**——
  客户端按 move id 查它默认查不到（见下「已知缺陷」）。
- 仅 **en / fr / de** 等有数据的语言产出；其余语言请求得到 **404**。

## 补充文本来源（游戏解包）

描述/名称除 PokeAPI 上游外，还合并了游戏解包文本（服务端
`tools/supplement/`，Z-A + Champions）：

- **物种图鉴描述**来自 Z-A（`version_id=47`），**招式说明**来自 Champions
  （`version_group_id=32`）——两者都是当前最高 version，前端「取 version 最大一条」
  时自然展示游戏文案，PokeAPI 历史版本行原样保留、可追溯。
- 官方优先：PokeAPI 已有的 `(id,lang,version)` 行不被覆盖，只补缺口 + 追加高版本。
- 因此会出现：同一实体多条 version 行的最高一条是游戏文案、甚至 id 超出 PokeAPI
  范围的新实体（如 move 920「归无之光」）。**客户端不需要区分来源**，照常按
  `(id, version)` 读取。

## 名称注入与回落

`src/store/i18n.ts` 加载 PKNM 后构建查找表，`pokemon.ts::mergeBundleToModel` 通过
`NameResolvers`（species/genus/form/ability/eggGroup）取名：

- store 未就绪时 resolver 为 `null`，merge 回落占位符（`pokemon-{id}` / `form-{id}` / 数字 id）；
- 名称就绪后 store 触发一次重映射，占位符被真实名替换。

### 上游数据缺口与回落

| 语言 | 名称组 | 描述组 | 效果文本 |
|------|--------|--------|----------|
| en, ja, ja-hrkt, ko, zh-hans, zh-hant, fr, de, es, es-419, it | 完整 | 完整 | 仅 en/fr/de 有 |
| ja-roma | 仅物种名 | 空 | 无 |
| cs, pt-br | 整体为空 | 空 | 无 |

描述组缺口的**语言级**判定：cs / pt-br / ja-roma **不产出任何分片**（请求任意分片
都是 404），直接按 `FALLBACK_LANGUAGE = 'en'` 定位英文分片；其余 11 种语言按首选语言
取片，个别 id 缺失返回 null（UI 显示「暂无描述」），**不逐 id 回落英文**。
效果段仅在 en/fr/de 非空，其余语言隐藏。

## 描述分片的按需寻址与加载（改造核心）

### 片号计算（前端唯一需要的新逻辑）

给定实体 id 与族名，**不请求任何清单**即可定位文件：

```ts
const SLICE = 128;                                  // 与后端契约一致
const slice = Math.floor((id - 1) / SLICE);         // 0-based
const path  = `/assets/encrypted/fb/i18n/${lang}/flavor/${family}-s${String(slice).padStart(2, '0')}.bin`;
```

例：species 152 → `species-s01.bin`；move 827 → `moves-s06.bin`；item 2228 → `items-s17.bin`。

### 404 语义（必须处理）

- 空档位（该族该档没有任何实体描述）→ 服务端不产文件 → **404**。
- 空语言（cs/pt-br/ja-roma）→ 任意片 404。
- 已覆盖语言的稀疏片 404 → **「该档无描述」**，不是错误，不得触发整包回落或报错。

### 改造点清单

1. **`src/services/resources/resourceManager.ts`**
   - 新增 `FLAVOR_SLICE_SIZE = 128`、`type FlavorFamily = 'species'|'moves'|'abilities'|'items'`
   - `specI18nFlavorSlice(lang, family, slice)`：
     `cacheKey: fb:v{N}:i18n:flavor:{lang}:{family}:s{NN}`；
     `remotePath: /assets/encrypted/fb/i18n/{lang}/flavor/{family}-s{NN}.bin`
   - `getI18nFlavorSlice(lang, family, slice)` → 复用 `decodeI18nFlavorBundle`（解码器零改动）
   - `getI18nFlavorEffects(lang)` → `effects.bin`（同 decoder）
   - 旧 `getI18nFlavor(lang)`（整包）**停产**；devtools 若要浏览全量，按族从 `s00`
     聚合到最大片号（容忍 404）。
2. **`src/store/i18n.ts`**
   - `ensureFlavor()`（整包）→ `ensureFlavorEntry(family, id)`：算片号 → 取片 →
     `buildFlavorBundle(slice)`（复用，只该族 Map 非空）→ **按 `(lang, family)`
     累积合并**到对应查找表，片到达即响应式刷新。
   - 访问器签名**保持不变**（`speciesFlavorText(id)` 等），组件只改 ensure 调用。
   - 效果表单独 `ensureFlavorEffects()`（仅 en/fr/de 有数据）。
   - 切语言清空已合并的片缓存。
3. **组件**（两处，仅改 ensure 一行）
   - `components/pokemon/PokedexEntry.vue`：`ensureFlavorEntry('species', speciesId)`
   - `components/archive/FlavorTextCard.vue`：按 `kind` 对应族 +
     move/ability 详情额外 `ensureFlavorEffects()`
4. **`src/services/i18n/flavor.ts`**：`buildFlavorBundle` 对空向量兼容（已兼容）；
   `flavorSize()` 语义保留（判断语言是否为空可用静态名单替代）。

### 缓存 key

```
fb:v{N}:i18n:names:<lang>
fb:v{N}:i18n:flavor:<lang>:<family>:s<NN>
fb:v{N}:i18n:flavor:<lang>:effects
```

版本号升级由 `pruneOtherVersions` 统一清理。分片化后「每语言 2 条」变「每族每档 1 条」
（约 30+ 条/语言），不再挤占数值 bundle 的 12 条内存 LRU——建议片缓存走持久层、
内存只留已合并的查找表。

## 已知缺陷（服务端已记录，前端暂照现状）

- `moveEffect(moveId)` 按 move id 查 `move_effects`，而该表主键是
  `move_effect_id`（稀疏），两者不对齐 → 招式详情的「效果」段现状查不到。
  修复需服务端打包时按 `Move.effect_id` join 改键，属独立缺陷，本期不修。

## form 名称的 id 重映射

前端用 **pokemon id** 查形态名，但 PokeAPI 形态表主键是 pokemon_forms id（两个不同自增空间）。
后端 `sync-i18n.py` 打包 PKNM 时已把 form 名主键从 form_id 改写成 pokemon_id。
详见 [../data/bundle-decode.md](../data/bundle-decode.md) 「三套 id 空间」一节 —— 改形态名错位先查那里。

## UI 静态文案

UI 文案不走进程 bundle，写在 `src/services/i18n/ui-messages.ts`（按 locale 分组的消息表），
`ui-i18n.ts` 提供查找。新增 UI 语言：扩展 `UiLocale`、`UI_LANGUAGES`，补对应消息。

## 启动与切换

- `boot.ts` 预取最新世代数值 bundle + 解析后的内容语言名称组（`prefetchI18nNames`）。
- 切换内容语言：`resourceManager.getI18nNames(lang)` → store 更新查找表 → 模型重映射；
  需要描述时再按实体 `ensureFlavorEntry`。
