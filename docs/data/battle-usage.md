# 对战使用率数据（Pokémon Champions）

对战环境的**宝可梦使用率统计**：排名、主流配置（招式/特性/道具/性格/加点/队友）。
来自第三方数据站对《Pokémon Champions》级别对战的统计。**使用率 JSON 明文、更新频繁；
配套图标则 ZKDX 加密、按赛季版本化下发**（见下文[图标](#图标精灵--属性--道具)）。

> 当前游戏是 **Pokémon Champions**（赛季 **M6**），不是朱紫（SV）。Champions 用 **Mega 进化**，
> 没有太晶属性。图鉴的数值/加密 bundle 见 [bundle-decode.md](bundle-decode.md)，那是另一套数据。

## 总览

- 数据前缀：**`/assets/battle/`**（明文 JSON，公开、CDN 回源，短缓存）。
- 图标前缀：**`/assets/encrypted/battle/${season}/icons/`**（ZKDX 密文、immutable，DEK 公开、匿名可获取）。
- 精灵标识：**Showdown 风格 slug**（`salamence`、`ninetales-alola`），不是数字 id。
- 对战格式：`Singles`（单打）/ `Doubles`（双打）。
- 多语言：9 种（`en, zh-Hans, zh-Hant, ja, de, fr, es, it, ko`）。

| 文件 | 大小 | 用途 |
|---|---|---|
| `meta.json` | ~4K | 赛季、dataVersion、生成时间 |
| `leaderboard.json` | ~16K | 两个格式的使用率排名（紧凑） |
| `link.json` | ~8K | slug → 图鉴物种 id（全国号） |
| `i18n/pokemon.json` | ~60K | slug → 精灵多语言名 |
| `i18n/moves.json` | ~172K | 招式英文名 → 多语言 |
| `i18n/abilities.json` | ~44K | 特性英文名 → 多语言 |
| `i18n/items.json` | ~40K | 道具英文名 → 多语言 |
| `i18n/natures.json` | ~4K | 性格英文名 → 多语言 |
| `p/<Singles\|Doubles>/<slug>.json` | 各 263 份 | 单只完整配置，**按需拉取** |

## 典型使用流程

**排行榜页**（一次拉三份，可缓存）：

```
GET /assets/battle/leaderboard.json   # 排名 -> slug 列表
GET /assets/battle/i18n/pokemon.json  # slug -> 显示名
GET /assets/battle/link.json          # slug -> 图鉴物种（点进详情/取图鉴图片）
```

**单只详情页**（按需）：

```
GET /assets/battle/p/<Singles|Doubles>/<slug>.json
# rows 里的 name 是英文引用名，用 i18n/<类别>.json 翻译
```

单打/双打切换时只换 `p` 的路径段；排行榜两个列表都在 `leaderboard.json` 内。

## meta.json

```json
{
  "game": "Pokemon Champions",
  "season": "M6",
  "seasons": ["M6", "M5", "M4", "M3", "M2", "M1"],
  "formats": ["Singles", "Doubles"],
  "generatedAt": "2026-09-26T13:25:22.695Z",
  "dataVersion": "20260926132522695"
}
```

- `season` 当前赛季；`dataVersion` 数据版本（= 构建时间戳），**用作缓存失效键**。
- `generatedAt` 上游生成时间（上游约每日刷新）。

## 历史赛季（`/assets/battle/<season>/`）

**当前赛季**数据在根路径（上文各节）；**历史赛季**（M1–M5，`meta.seasons` 除 `season` 外的
赛季）各自一个子树，内部结构与根完全相同，仅替换赛季段：

```
/assets/battle/M5/leaderboard.json
/assets/battle/M5/p/<Singles|Doubles>/<slug>.json
/assets/battle/M5/link.json
/assets/battle/M5/i18n/{pokemon,moves,abilities,items,natures}.json
```

- `meta.json` 始终在根，`seasons` 数组声明全部可用赛季（当前 + 历史），供前端渲染赛季切换。
- **路径约定与前端 `service.ts` 完全对应**：`battlePath(season, suffix)` —— 当前赛季传
  `null` 走根路径，历史赛季传赛季名走 `<season>/` 子树。
- **数据是最终快照（immutable）**：赛季结束后不再变化。后端只抓取一次存本地，检测到本地
  不完整才重新抓取（见 [../features/metagame-usage.md](../features/metagame-usage.md)）。
- 历史赛季的精灵阵容可能更小（如 M1 仅 213 只），`leaderboard` / `p` 数量因此不同；`link`
  / `i18n` 复用当前季产物（物种关联、名表不随赛季变），多余键无妨、缺失键按通用降级处理。
- **图标**：历史赛季页面继续用**当前赛季**图标（`battleImage.ts` 恒取 `meta.season`），
  不为历史赛季另发图标。

## leaderboard.json

紧凑排名，按 `rank` 升序：

```json
{
  "Singles": [
    { "id": "salamence", "rank": 1 },
    { "id": "garchomp", "rank": 2 },
    { "id": "primarina", "rank": 3 }
  ],
  "Doubles": [ /* 同形状 */ ]
}
```

- 名单为该格式**有排名的精灵**（当前各 262 只，名次连续）。
- 显示名不在此文件，用 `id` 查 `i18n/pokemon.json`。

## p/<格式>/<slug>.json —— 单只完整配置

```json
{
  "id": "salamence",
  "rank": 1,
  "rows": {
    "move":     [ { "rank": 1, "name": "Double-Edge", "pct": 77.8 } ],
    "ability":  [ { "rank": 1, "name": "Intimidate", "pct": 99.1 } ],
    "item":     [ { "rank": 1, "name": "Salamencite", "pct": 97.4 } ],
    "nature":   [ { "rank": 1, "name": "Adamant", "pct": 47, "up": "Attack", "down": "Sp. Atk" } ],
    "spread":   [ { "rank": 1, "pct": 14.1, "hp": 1, "atk": 32, "def": 1, "spa": 0, "spd": 0, "spe": 32 } ],
    "teammate": [ { "rank": 1, "name": "Primarina" } ]
  }
}
```

各分组形状（`pct` = 使用率/持有率百分比，数值，无 `%`）：

| rows 分组 | 字段 | 说明 |
|---|---|---|
| `move` / `ability` / `item` | `rank, name, pct` | 主流招式/特性/道具 |
| `nature` | `rank, name, pct, up, down` | 性格；`up/down` 加减能力的英文名（可翻译） |
| `spread` | `rank, pct, hp, atk, def, spa, spd, spe` | **SP 加点**分布（Champions 用 SP 取代传统 EV；每项 0..32） |
| `teammate` | `rank, name` | 常见队友，**无百分比**（仅排序） |

- `rank` 是该精灵自身在本格式的排名（= 排行榜名次）。
- 各组按 rank 升序；并非每组都有数据（部分精灵某项为空）。
- rows 内所有 `name` 都是**英文引用名**，按下表用对应 i18n 文件翻译：

| rows 分组 | 翻译用 |
|---|---|
| `move` | `i18n/moves.json` |
| `ability` | `i18n/abilities.json` |
| `item` | `i18n/items.json` |
| `nature`（含 `up/down`） | `i18n/natures.json`；`up/down` 是能力名（图鉴自带） |
| `teammate` | `i18n/pokemon.json` |

## i18n 文件

统一形状：`{ "<英文键>": { "name": { "<lang>": "<文本>" } } }`。

`i18n/pokemon.json` 以 **slug** 为键，并在可区分形态时附 `form`：

```json
{
  "salamence": { "name": { "en": "Salamence", "zh-Hans": "暴飞龙", "ja": "ボーマンダ" } },
  "ninetales-alola": {
    "name": { "en": "Ninetales-Alola", "zh-Hans": "九尾", "ja": "キュウコン" },
    "form": { "zh-Hans": "阿罗拉的样子", "ja": "アローラのすがた" }
  }
}
```

其余文件以英文名（= rows 里的 `name`）为键，例如：

```json
{ "Double-Edge": { "name": { "en": "Double-Edge", "zh-Hans": "舍身冲撞", "ja": "すてみタックル" } } }
```

- 翻译缺失时回退 `en`，再回退显示原始键。
- 语言切换无需重新拉 `p`：只换 i18n（建议按 UI 语言缓存）。

## link.json —— 关联回图鉴

把使用率 slug 关联到图鉴的**物种 id**（PokeAPI species，对主线精灵即全国图鉴号 1..1025）：

```json
{
  "salamence": { "id": 373 },
  "ninetales-alola": { "id": 38 },
  "maushold": { "id": 925 },
  "vivillon-fancy": { "id": 666, "form": "fancy" }
}
```

- 用途：从使用率跳图鉴详情，或在对战图标缺失时回退复用图鉴自己的精灵图片。
- 对战数据现已自带一套图标（精灵/属性/道具），见下文[图标](#图标精灵--属性--道具)。
- 大部分 slug 与图鉴 identifier 相同；命名差异（性别默认、拼写）已在数据侧归一。
- 同物种下的花纹/形态差异用 `form`（PokeAPI form identifier）给出，如 Vivillon。
- **全 263 个 slug 都能关联到物种**；若个别查无，前端应优雅降级（仅显示名字）。

## 图标（精灵 / 属性 / 道具）

对战页的一套图标 **ZKDX 加密、按赛季版本化下发**，解密 DEK 由公开接口下发，匿名即可获取。赛季 `season`
来自 `meta.json`（当前 `M6`），密文前缀：

```
/assets/encrypted/battle/${season}/icons/...
```

| 类别 | 密文路径（相对 icons） | 文件名键 | 尺寸 | 数量 |
|---|---|---|---|---|
| 精灵 | `pokemon/<slug>.bin` | 精灵 slug（基础或战斗形态） | 128×128 | 350 |
| 属性 | `types/<type>.bin` | 属性英文名**小写** | 64×64 | 18 |
| 道具 | `items/<name>.bin` | 道具**英文显示名** | 40×40 | 159 |
| 形态清单 | **明文** `/assets/battle/icons/forms.json` | — | — | 80 基础 |

### 加载与解密（每个图标）

复用图鉴已有的加密图片管线（见 [../security/encryption-pipeline.md](../security/encryption-pipeline.md)
与 [../caching/sprite-cache.md](../caching/sprite-cache.md)）：

```
1. 取 DEK：getKey()  →  GET /api/v1/zukan/key（公开，匿名可访问，见 ../security/auth-session.md）
2. 拉密文：GET /assets/encrypted/battle/${season}/icons/<类别>/<键>.bin
3. 解密：  decryptZukan(bytes, dek)   →  明文 PNG 字节
4. 显示：  URL.createObjectURL(new Blob([bytes], { type: 'image/png' }))  →  <image :src>
```

- 密文本身**无鉴权**、`immutable` 长缓存（加密即保护）；DEK 亦由公开接口下发，无需登录。
- **未登录也能正常出图**：`getKey()` 匿名即可拿到 DEK，不再有「降级为名字 / 占位」的前置门槛；
  对战页对匿名完全开放。
- IDB 持久化**密文**、缓存 key 带 `season`；赛季切换时路径与 key 同时变化，旧图天然失效。

> **引擎接入要点**：现有加密图片引擎的资源标识是 `number`（精灵 / 道具的数字 id）。对战图标用
> 字符串 slug / 显示名，需把引擎的 key 与远端路径泛化为 `string`，新增一个「扁平、无 variant、
> 版本化」的对战图标 kind（参考 `src/services/resources/imageKind.ts`、`imageCache.ts`）。

**道具图**：文件名就是 rows 里 `item.name`（= `i18n/items.json` 的键），可能含空格，用
`encodeURIComponent` 编码，无需另建映射：

```
rows item.name "Garchompite Z"
  → /assets/encrypted/battle/M6/icons/items/Garchompite%20Z.bin
rows item.name "Choice Scarf"
  → /assets/encrypted/battle/M6/icons/items/Choice%20Scarf.bin
```

图标只覆盖对战中实际被持有的 159 个道具；`i18n/items.json` 多 7 个 0 出场键（基础树果 /
薄雾种子 / 脱壳甲）无图，取不到时降级（仅显示名 / 占位图）。

**精灵图**：

- 263 个基础精灵直接用排行榜 / 详情里的 slug。
- 另有 **87 个战斗形态**（Mega、Mega Z、形态转换等），其形态 slug **不在** leaderboard /
  link / i18n/pokemon 中，要用 `forms.json` 发现，不能自行猜测（形态名不规则，如
  `Mega Garchomp Z`、`Aegislash Blade Forme`）。

**forms.json**（明文）：只列“含多个形态”的 80 个基础 slug，值是该基础的全部形态（含基础
自身），按 slug 排序：

```json
{
  "garchomp": [
    { "slug": "garchomp", "en": "Garchomp" },
    { "slug": "garchomp-mega", "en": "Mega Garchomp" },
    { "slug": "garchomp-mega-z", "en": "Mega Garchomp Z" }
  ],
  "charizard": [
    { "slug": "charizard", "en": "Charizard" },
    { "slug": "charizard-mega-x", "en": "Mega Charizard X" },
    { "slug": "charizard-mega-y", "en": "Mega Charizard Y" }
  ]
}
```

- `en` 是形态英文显示名；形态的其它语言名当前 i18n 未提供，可用基础精灵名结合图鉴形态名本地化。
- 用法：详情页用基础 slug 查 `forms.json`，有键则展示形态切换（头像随之换密文
  `pokemon/<形态slug>.bin`）；无键即单形态。

**属性图**：18 类，文件名小写（`dragon`、`fairy`、`normal`…）。任一图标 404 都应优雅降级；
可经 `link.json` 回退图鉴的加密精灵图（图鉴图 DEK 同样公开、匿名可取）。

## 缓存建议

更新频繁，**数据 JSON 不要 immutable；图标相反——immutable + 按赛季版本化**（见上文图标小节）：

| 资源 | 建议 |
|---|---|
| 图标 `icons/{pokemon,types,items}/*.bin` | `immutable`（赛季路径版本化，更新换 URL，旧图自动失效） |
| `meta.json` | 短缓存（如数分钟）或 `no-cache`，用它探新版本 |
| `leaderboard.json` / `link.json` / `i18n/*` | 短缓存（数十分钟）；按 `meta.dataVersion` 主动失效 |
| `p/<格式>/<slug>` | 可较长，但用 `dataVersion` 作版本键失效 |
| 历史赛季 `/<season>/…` 整棵子树 | 数据 immutable，可长缓存（当前与根一致走短缓存 300s） |

推荐做法：先拉 `meta.json` 比对 `dataVersion`，变化后再重新拉排行榜/配置，避免无谓下载。

## 注意事项

- 数据源是**第三方站点**（非官方接口），字段/可用性可能随其更新变化；解析请容忍未知/缺失字段。
- Champions 内部怪兽编号**不对齐全国图鉴**，关联一律以 `link.json` 为准，不要自行用内部序号。
- 个别形态（Maushold 三只/四只、Vivillon 花纹）在源数据标注不规范：物种名与 `link` 始终准确，
  仅 `i18n/pokemon.form` 可能省略。
- **数据 JSON 明文公开；图标 ZKDX 加密、DEK 公开下发（匿名可获取）**；鉴权与加密全链路见
  [../security/encryption-pipeline.md](../security/encryption-pipeline.md)。
