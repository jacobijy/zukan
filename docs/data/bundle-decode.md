# Bundle 解码与数据建模

图鉴的数值数据来自加密 FlatBuffers bundle，由 WASM 解密后解码，
`src/services/pokemon/pokemon.ts` 把并行表 join 成 UI 模型。

> 加密格式、下载、缓存见 [../security/encryption-pipeline.md](../security/encryption-pipeline.md)
> 和 [../caching/resource-cache.md](../caching/resource-cache.md)。本文只讲数据结构与 id 对应。

## FlatBuffers bundle 清单

解码在 `src/infra/wasm/index.ts`，按文件头 4 字节 fid 分派：

| 远端路径 | fid | 解码器 | 内容 |
|----------|-----|--------|------|
| `gen-N.bin`（N=1..9） | `PKMB` | `decodePokemonGenBundle` | 第 N 世代全物种数值快照：base/stat/type/ability/eggGroup 五张并行表 |
| `moves/vg-NN.bin` | `PMOV` | `decodePokemonVgMovesBundle` | 招式学习记录（原始行式） |
| `pokemon_moves/common.bin` | `PMSB` | `decodePokemonMovesBundle` | 招式聚合表（baseline） |
| `pokemon_moves/mainline/vg-NN.bin` | `PMSB` | 同上 | 主线相对 common 的整行覆盖（kind=1） |
| `pokemon_moves/special/vg-NN.bin` | `PMSB` | 同上 | 独立表，不合并 common（kind=2） |
| `moves_data/common.bin` | `MDAT` | `decodeMovesDataBundle` | 招式定义（moves + 4 张关联表，含 `move_flag_map`） |
| `moves_data/vg-NN.bin` | `MDAT` | 同上 | 该版本组的招式覆写（仅 moves 表） |
| `i18n/<lang>/names.bin` | `PKNM` | `decodeI18nNamesBundle` | 单语言短文本，见 [../i18n/i18n-bundle.md](../i18n/i18n-bundle.md) |
| `i18n/<lang>/flavor.bin` | `PKFL` | `decodeI18nFlavorBundle` | 单语言长文本 |

### 世代快照语义（重要）

**`gen-N.bin` 是「全物种在第 N 世代的数值快照」**，不是「第 N 世代新增的宝可梦」。
约 1351 条形态 / 1025 个默认形态，id 从 1 起。默认世代是 9（`boot.ts::LATEST_GEN_ID`、
store 里 `DEFAULT_GEN_ID = 9`）。

## PKMB 五表 join（`mergeBundleToModel`）

PKMB 是五张**并行表**，都按 pokemon id 对齐：

| 表 | 字段 |
|----|------|
| `baseEntries` | id, speciesId, isDefault, height, weight |
| `statEntries` | id, hp/attack/defense/specialAttack/specialDefense/speed |
| `typeEntries` | id, type1Id, type2Id |
| `abilityEntries` | id, ability1Id, ability2Id, abilityHiddenId |
| `eggGroupEntries` | id, eggGroup1Id, eggGroup2Id |

`pokemon.ts` 用 Map 按 id 把后四张表 join 到 `baseEntries` 上，输出 `IPokemonBaseModel`。

名称通过 `NameResolvers` 注入（底层查 PKNM bundle）：
- `species(speciesId)` → 物种名
- `genus(speciesId)` → 分类（「种子宝可梦」）
- `form(id)` → 形态名（注意是 **pokemon id**，见下文重映射）
- `ability(abilityId)` / `eggGroup(eggGroupId)` → 特性名 / 蛋组名

i18n 未就绪时各字段回退占位符（`pokemon-{id}` / `form-{id}` / 数字 id），
i18n 加载完成后 store 重映射一次。`image` 固定 `/static/default.png` —— 卡面图走
`EncryptedSprite` 独立通道，不是 model 字段。

## 三套 id 空间（排查「图不对 / 名不对 / 404」的关键）

PokeAPI 有三个容易混淆的 id：

| id 字段 | 来源表 | 含义 | 前端用途 |
|---------|--------|------|----------|
| **pokemon id** | `pokemon.csv` | 一条「可战斗个体」，默认形态 + 所有非默认形态各占一个 | **sprite 请求用这个**；PKMB `baseEntries[].id` 也是这个 |
| **species id** | `pokemon_species.csv` | 物种（全国图鉴编号），一个物种多个形态 | 查物种名/分类/蛋组/世代号段 |
| **pokemon_forms id** | `pokemon_forms.csv` | 形态行，**独立自增 id 空间** | PKNM 形态表的主键 |

**关键：pokemon id 和 pokemon_forms id 是两个不同的自增空间**，非默认形态对不上。
例：deoxys-speed 的 pokemon id 是 10003，form id 是 10033；venusaur-mega 分别是 10033 / 10133。

### form 名称的 id 重映射

前端 `pokemon.ts` 用 **pokemon id** 查形态名（`names.form(b.id)`，`b.id` 是 pokemon id），
但 PokeAPI 的 `pokemon_form_names` 表主键是 **pokemon_forms id**。直接打包会让所有非默认形态名错位。

后端 `tools/sync-i18n.py::load_form_pokemon_map()` 在构建 PKNM 时重映射：
- 对每个 **pokemon_id** 取其 `is_default=1` 那行的 form id（每个 pokemon 恰好一条 default form）；
- 建立 `form_id → pokemon_id`；
- 打包 form 名称时把主键从 form_id 改写成 pokemon_id，跳过装饰性形态和重复。

**默认形态 form_id == pokemon_id，从来没坏过；坏的是非默认形态。** 改这张表时务必保留重映射。

## 图片 id 与缺失

- 图片请求**永远用 pokemon id**：`/assets/encrypted/pokemon/{b.id}/home.bin`。
- `pokemon_species.id`（全国编号）**不**用于拼图片路径，只用于查名/分类/世代。
- 不是每个 pokemon id 都有 `home.bin`，404 走默认占位，属于正常缺口（缺图清单见
  [../security/encryption-pipeline.md](../security/encryption-pipeline.md) 第 4.3 节）。

## 关键文件

- `src/services/pokemon/pokemon.ts` —— join、世代推算、名称解析
- `src/infra/wasm/index.ts` —— 解码器导出
- `src/infra/wasm/src/fb/` —— FlatBuffers 表定义与生成代码
- `src/constants/generations.ts` —— 世代号段（`genForPokemonId` 单一数据源）
