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
| `pokemon_moves/common.bin` | `PMSB` | `decodePokemonMovesBundle` | 招式聚合表（**全物种最新主线基线**，见[下文](#招式基线-common-的并集语义)） |
| `pokemon_moves/mainline/vg-NN.bin` | `PMSB` | 同上 | 主线相对 common 的整行覆盖（kind=1） |
| `pokemon_moves/special/vg-NN.bin` | `PMSB` | 同上 | 独立表，不合并 common（kind=2） |
| `moves_data/common.bin` | `MDAT` | `decodeMovesDataBundle` | 招式定义（moves + 4 张关联表，含 `move_flag_map`） |
| `moves_data/vg-NN.bin` | `MDAT` | 同上 | 该版本组的招式覆写（仅 moves 表） |
| `evolution.bin` | `EVO1` | （新增）`EvolutionBundle` | 全代进化树：species/edges/details 三表，见[下文](#evo1-进化树-evolutionbundle) |
| `i18n/<lang>/names.bin` | `PKNM` | `decodeI18nNamesBundle` | 单语言短文本，见 [../i18n/i18n-bundle.md](../i18n/i18n-bundle.md) |
| `i18n/<lang>/flavor.bin` | `PKFL` | `decodeI18nFlavorBundle` | 单语言长文本 |

### 世代快照语义（重要）

**`gen-N.bin` 是「全物种在第 N 世代的数值快照」**，不是「第 N 世代新增的宝可梦」。
约 1351 条形态 / 1025 个默认形态，id 从 1 起。默认世代是 9（`boot.ts::LATEST_GEN_ID`、
store 里 `DEFAULT_GEN_ID = 9`）。

### 招式基线 common 的并集语义（重要）

前端详情页 / 伤害计算器**只读** `pokemon_moves/common.bin`（`loadMovesForPokemon`），
从不回退 mainline/special。所以 common 必须覆盖**全部形态**，不能只含某一代图鉴：

- common 是「每只宝可梦**最新主线世代**招式表」的并集：vg-25（朱紫）打底（867 条），
  凡朱紫图鉴没有的形态，按主线版本组从新到旧（vg-23 → vg-01）回填它最新一代的**完整**
  招式表（+401，共 1268 条）。例：尼多后（id=31）不在朱紫，回退到 vg-23（BDSP）。
- mainline `vg-NN.bin`（diff，kind=1）只写「相对 common 整行不同」的宝可梦；被回填进
  common 的形态与其来源代同值，故不会重复出现在该代 diff 里。特殊 VG
  （Colosseum/XD/阿尔宙斯/日版初代/Champions，kind=2）**不参与**基线——实测没有任何
  形态「只在特殊代、主线/朱紫都没有」，不丢覆盖。
- 仅外传独有的形态（24 条）在任何正作代都无招式数据，不进 common，前端按「无招式」空态。

打包在 `zukan-server/tools/upstream/aggregate_pokemon_moves.py`（朱紫打底 + 主线回填）；
**前端不做 vg 选择**，vg 选择完全固化在打包侧。

## PKMB 五表 join（`mergeBundleToModel`）

PKMB 是五张**并行表**，都按 pokemon id 对齐：

| 表 | 字段 |
|----|------|
| `baseEntries` | id, speciesId, isDefault, height, weight, **hasSprite** |
| `statEntries` | id, hp/attack/defense/specialAttack/specialDefense/speed |
| `typeEntries` | id, type1Id, type2Id |
| `abilityEntries` | id, ability1Id, ability2Id, abilityHiddenId |
| `eggGroupEntries` | id, eggGroup1Id, eggGroup2Id |

- **`hasSprite: bool`**（`PokemonBase` 末位字段）：该 pokemon id 下是否有任一正面立绘
  （打包时判定 `assets/public/pokemon/<id>/` 下存在 `artwork.png` / `home.png` / `shiny.png` 任一）。
  `false` 表示官方暂无可展示正面图，当前共 8 个，全是故勒顿/密勒顿的 build/mode 形态：
  **10264–10271**（其中 10265–10267、10269–10271 无任何资源目录；10264、10268 仅有 `versions/9/scarlet-violet.png` 世代小图，无正面立绘）。
  前端可据此在卡片/详情里**暂时屏蔽或隐藏**该形态，而非等图片 404 再回退。这是数据层判定，比运行时 404 更早、更确定。

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
- 数据层可用 `baseEntries[i].hasSprite` 提前判定该形态是否有正面立绘（`false` 建议直接屏蔽，见上文 PKMB 表）。

<a id="evo1-进化树-evolutionbundle"></a>
## EVO1 进化树（`EvolutionBundle`）

`evolution.bin`（fid `EVO1`）是**全代合并的单文件**（进化树结构跨代稳定，不按世代拆分），
约 30 KB。由三张紧密排列的 struct 数组组成，全部用**数组下标**寻址，零拷贝、无需查表：

| 顶层 vector | 行数 | 对齐/索引方式 |
|-------------|-----|---------------|
| `species` | 1025 | **按 `species_id - 1` 直接下标定位**（species_id 1..1025 连续，含不进化的孤立物种） |
| `edges` | 484 | 被 `species[i].edgeStart / edgeCount` 切分 |
| `details` | 550 | 被 `edge.detailStart / detailCount` 切分 |

### 三个 struct 的字段（按内存顺序）

```text
EvolutionSpecies {        // species[id-1]，每个物种一行
  parentSpecies: u16      // 由何物种进化而来（evolves_from_species_id）；0 = 链根/无前置
  chainId: u16            // 所属进化链 id（pokemon_species.evolution_chain_id），仅用于同链分组
  edgeStart: u16          // 在 edges[] 中的起始下标（无进化目标时 edgeCount=0）
  edgeCount: u8           // 该物种可进化出的分支数
  pad: u8
}

EvolutionEdge {           // 一条进化分支（from = 拥有该 edge 的物种）
  targetSpecies: u16      // 进化目标物种 id
  detailStart: u16        // 在 details[] 中的起始下标
  detailCount: u8         // 该分支的触发条件条数（多为 1；跨版本组不同时 >1）
}

EvolutionDetail {         // 一条触发条件（pokemon_evolution.csv 的一行，纯数值）
  triggerItem: u16        // 触发道具（进化石等）；0=无
  heldItem: u16           // 升级时携带的道具；0=无
  knownMove: u16          // 需知晓的招式；0=无
  partySpecies: u16       // 同行的另一只物种；0=无
  tradeSpecies: u16       // 通信交换对象物种；0=无
  location: u16           // 升级地点 id；0=无
  minimumSteps: u16       // 需走路数；0=无
  minimumDamageTaken: u16 // 需承受伤害（某幽灵系进化）；0=无
  evolvedForm: u16        // 进化后的形态 id；0=不限
  baseForm: u16           // 进化起点形态限制；0=不限
  versionGroupId: u8      // 该条件适用的版本组
  triggerId: u8           // evolution_trigger_id：1=升级 2=交换 3=使用道具 4=蜕皮…（名字查 PKNM evolution_triggers）
  knownMoveType: u8       // 0=无
  partyType: u8           // 0=无
  gender: u8              // 0=不限 1=雌性 2=雄性
  timeOfDay: u8           // 0=不限 1=day 2=night 3=dusk 4=full-moon
  minimumLevel: u8        // 0=无等级要求
  minimumHappiness: u8
  minimumBeauty: u8
  minimumAffection: u8
  relativePhysicalStats: u8  // 0=不限 1=攻击<防御 2=相等 3=攻击>防御
  minimumMoveCount: u8
  region: u8              // 0=不限 7=阿罗拉 8=伽勒尔 9=洗翠
  flags: u8               // 位域，见下
}
```

**所有 id 类字段 `0` 表示「无 / 不限」**（名称一律走 PKNM i18n bundle 按 id 查，不进进化 bundle）。

`flags` 位定义：

| bit | 掩码 | 含义 |
|-----|------|------|
| 0 | `0x01` | `needs_overworld_rain` 需在户外下雨时升级 |
| 1 | `0x02` | `turn_upside_down` 需倒置主机 |
| 2 | `0x04` | `needs_multiplayer` 需附近有其他玩家 |
| 3 | `0x08` | `near_special_rock` 需在特殊岩石/磁场附近 |
| 4 | `0x10` | `is_default` 该版本组下的**默认**进化路径（展示优先取这条） |

### 关联与遍历

```text
pokemon_id ──(PKMB base.speciesId)──▶ species_id
                                            │
                          species = bundle.species(species_id - 1)
                                            │
                 上溯链根：while species.parentSpecies != 0 { … }
                 下钻子树：edges[species.edgeStart .. +edgeCount]
                              └─ edge.targetSpecies  → 孩子物种
                                 details[edge.detailStart .. +detailCount]
                                    └─ 各版本组的触发条件
```

- **父→子和子→父是双向冗余的**：孩子的 `parentSpecies` 指向 from，from 的 `edges` 列出所有孩子。
- 同一进化边可能有多条 `EvolutionDetail`（如叶伊布在旧版本组是「苔藓岩石附近升级」、
  新版本组追加「叶之石」）。前端可按 `versionGroupId` 过滤到当前版本组，
  或取 `flags & 0x10`（is_default）那条作为默认展示，其余作为「其他版本/方式」。
- `chainId` 仅用于把同一进化链的物种分组（如伊布一家同链），寻址用下标即可，不需要它。

### 抽样校验数据（实现自测用）

- 妙蛙种子（species 1）：`parentSpecies=0`、`chainId=1`；它的 edge 指向 2（妙蛙草）。
- 妙蛙草（2）→ 妙蛙花（3）的默认 detail：`minimumLevel=32`。
- 伊布（species 133）：`edgeCount=8`（水/雷/火/太阳/月亮/叶/冰/仙子伊布）；
  水伊布（134）的 detail `triggerId=3`（道具）、`triggerItem=84`（水之石）。
- 叶伊布（470）：`detailCount >= 2`（跨版本组多种触发方式）。

> 当前 `IPokemonBaseModel.evolutionChain` 还是空数组占位；接入 EVO1 后由本 bundle 替换。

## 关键文件

- `src/services/pokemon/pokemon.ts` —— join、世代推算、名称解析
- `src/infra/wasm/index.ts` —— 解码器导出
- `src/infra/wasm/src/fb/` —— FlatBuffers 表定义与生成代码
- `src/constants/generations.ts` —— 世代号段（`genForPokemonId` 单一数据源）
