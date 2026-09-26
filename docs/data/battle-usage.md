# 对战使用率数据（Pokémon Champions）

对战环境的**宝可梦使用率统计**：排名、主流配置（招式/特性/道具/性格/加点/队友）。
来自第三方数据站对《Pokémon Champions》级别对战的统计，**明文 JSON、不加密、更新频繁**。

> 当前游戏是 **Pokémon Champions**（赛季 **M6**），不是朱紫（SV）。Champions 用 **Mega 进化**，
> 没有太晶属性。图鉴的数值/加密 bundle 见 [bundle-decode.md](bundle-decode.md)，那是另一套数据。

## 总览

- 资源前缀：**`/assets/battle/`**（静态资源，公开、CDN 回源，短缓存）。
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

- 用途：从使用率跳图鉴详情、复用图鉴自己的精灵图片（使用率数据不带图）。
- 大部分 slug 与图鉴 identifier 相同；命名差异（性别默认、拼写）已在数据侧归一。
- 同物种下的花纹/形态差异用 `form`（PokeAPI form identifier）给出，如 Vivillon。
- **全 263 个 slug 都能关联到物种**；若个别查无，前端应优雅降级（仅显示名字）。

## 缓存建议

更新频繁，**不要 immutable**：

| 资源 | 建议 |
|---|---|
| `meta.json` | 短缓存（如数分钟）或 `no-cache`，用它探新版本 |
| `leaderboard.json` / `link.json` / `i18n/*` | 短缓存（数十分钟）；按 `meta.dataVersion` 主动失效 |
| `p/<格式>/<slug>` | 可较长，但用 `dataVersion` 作版本键失效 |

推荐做法：先拉 `meta.json` 比对 `dataVersion`，变化后再重新拉排行榜/配置，避免无谓下载。

## 注意事项

- 数据源是**第三方站点**（非官方接口），字段/可用性可能随其更新变化；解析请容忍未知/缺失字段。
- Champions 内部怪兽编号**不对齐全国图鉴**，关联一律以 `link.json` 为准，不要自行用内部序号。
- 个别形态（Maushold 三只/四只、Vivillon 花纹）在源数据标注不规范：物种名与 `link` 始终准确，
  仅 `i18n/pokemon.form` 可能省略。
- 该数据为明文公开，**不涉及 DEK/加密**；鉴权与加密文档见 [../security/](../security/)。
