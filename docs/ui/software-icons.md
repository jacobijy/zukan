# 版本来源图标（图鉴描述版本选择器）

HOME 官方的**作品版本徽章**：每枚代表一款正作/衍生游戏。当前用于宝可梦详情页
**图鉴描述的游戏版本选择器**（[`PokedexEntry.vue`](../../src/components/pokemon/PokedexEntry.vue)
+ [`PokedexVersionPicker.vue`](../../src/components/pokemon/PokedexVersionPicker.vue)）：
描述组无损保留每只宝可梦在各游戏版本下的文案，用对应作品图标当版本标签切换。
将来也可作为详情页「登场作品 appears_in」的来源标记（见文末待办）。

> 这些图标**不**用于世代切换抽屉（[`GenerationDrawer.vue`](../../src/components/dex/GenerationDrawer.vue)）：
> 抽屉按全国图鉴号段筛选，与具体作品不是一回事。

## 性质

- **不加密、纯静态**：直接随包发布，**不要**走 ZKDX 解密或 `resourceManager` / `imageCache`
  （那套只给加密精灵图/道具图标，见 [caching/sprite-cache.md](../caching/sprite-cache.md)）。
- 来源：Pokémon HOME CDN 的 `spriteatlas_softwareicon` 图集，已逐 Sprite 切片。
  取数/切片工具在后端仓 `zukan-server`：`tools/homedata/fetch_ui.py`（`--group software`）。
- 规格：**22 枚，全部 128×128，RGBA 透明底 PNG**。

## 位置与引用

```
src/static/img/software-icons/PokeTitle_S_<编号>_<后缀>.png
```

静态资源用绝对路径引用（与 `/static/default.png` 一致）：

```ts
`/static/img/software-icons/PokeTitle_S_109_SV_S.png`
```

## 文件 → 游戏 → 世代 映射

| 文件 | 编号 | 游戏 | 世代（对齐 `GENERATIONS`） |
|---|---|---|---|
| `PokeTitle_S_101_X.png` / `_101_Y.png` | 101 | 《X》/《Y》 | gen6 |
| `PokeTitle_S_102_OR.png` / `_102_AS.png` | 102 | 《终极红宝石 ΩR》/《始源蓝宝石 αS》 | gen6 |
| `PokeTitle_S_103_Sun.png` / `_103_Moon.png` | 103 |《太阳》/《月亮》 | gen7 |
| `PokeTitle_S_104_US.png` / `_104_UM.png` | 104 |《究极之日》/《究极之月》 | gen7 |
| `PokeTitle_S_105_P.png` / `_105_E.png` | 105 |《Let's Go! 皮卡丘》/《…伊布》 | gen7（关都复刻） |
| `PokeTitle_S_106_SW.png` / `_106_SH.png` | 106 |《剑》/《盾》 | gen8 |
| `PokeTitle_S_107_BD.png` / `_107_SP.png` | 107 |《晶灿钻石》/《明亮珍珠》 | gen8（神奥复刻） |
| `PokeTitle_S_108_LA.png` | 108 |《阿尔宙斯》 | gen8（洗翠） |
| `PokeTitle_S_109_SV_S.png` / `_109_SV_V.png` | 109 |《朱 Scarlet》/《紫 Violet》 | gen9 |
| `PokeTitle_S_110_LZA.png` | 110 |《Z-A》 | gen9（卡洛斯，新作） |
| `PokeTitle_S_000_Bank.png` | 000 | Pokémon Bank（虚拟银行） | 衍生/工具 |
| `PokeTitle_S_001_Home.png` | 001 | Pokémon HOME | 衍生/工具 |
| `PokeTitle_S_111_Champ.png` | 111 | Pokémon Champions | 衍生/新作 |
| `PokeTitle_S_501_GO.png` | 501 | Pokémon GO | 衍生 |

## 详情页版本选择器：PokeAPI version_id → 图标

图鉴描述（species flavor）每行带的是 **PokeAPI `version_id`**（不是上方的 HOME 编号）。
两者的映射是单一数据源 [`src/constants/versionIcons.ts`](../../src/constants/versionIcons.ts)
里的 `VERSION_ICON_BY_VERSION`，**只登记有图标的正作版本**（X/Y 起）：

| PokeAPI version_id | 游戏 | 图标 code |
|---|---|---|
| 23 / 24 | 《X》/《Y》 | `101_X` / `101_Y` |
| 25 / 26 | 《终极红宝石》/《始源蓝宝石》 | `102_OR` / `102_AS` |
| 27 / 28 | 《太阳》/《月亮》 | `103_Sun` / `103_Moon` |
| 29 / 30 | 《究极之日》/《究极之月》 | `104_US` / `104_UM` |
| 31 / 32 | 《Let's Go! 皮卡丘》/《…伊布》 | `105_P` / `105_E` |
| 33 / 34 | 《剑》/《盾》 | `106_SW` / `106_SH` |
| 37 / 38 | 《晶灿钻石》/《明亮珍珠》 | `107_BD` / `107_SP` |
| 39 | 《阿尔宙斯》 | `108_LA` |
| 40 / 41 | 《朱》/《紫》 | `109_SV_S` / `109_SV_V` |
| 47 | 《Z-A》（解包追加，数据出现即显示） | `110_LZA` |

version_id 以服务端 `tmp/csv/versions.csv` 为准，勿凭记忆（容易把 35/36 DLC 当成 BD/SP——
实际 BD/SP 是 37/38，35/36、50/51 是剑盾 DLC，42/43、52/53 是朱紫 DLC，44–46 是红绿蓝 VC）。

`iconFlavorOptions(该物种有描述的版本)` 过滤出「有图标 ∩ 有描述」的版本并按 version 升序，
`versionIconPath(versionId)` 拼静态绝对路径。渲染用 `<image mode="aspectFit">`，统一白色圆角槽位
（满版 app 图标与透明底 logo 借此归一），`flex-wrap` 多行、不横向滚动；选中描蓝环。
版本的本地化**显示名**（图标 `aria-label`）另走 names bundle 的 `versions` 表
（`i18nStore.versionName(id)`），不硬编码。

### 边界

- **只覆盖 X/Y（gen6）起**。gen1–5（红/蓝/金/银/宝石/珍钻/黑白…，约占一只老物种描述的多数）
  没有 HOME 图标，**不进选择器**——这是有意为之（已与产品确认「只用图标」）。
- **兜底**：某物种在所有有图标版本都没描述（只剩 gen1–5 文案）时，不渲染选择器，
  退回「取 version 最大一条」的纯文本（`speciesFlavorText`），不留空白。
- **DLC 版本（35/36、42/43、50–53）无独立图标也不映射**：DLC 物种的 species 描述归在
  主版本（剑盾 33/34、朱紫 40/41），无需 DLC 图标。
- 默认选中该物种有图标版本里 **version 最大**的一枚；切形态 / 切内容语言后选中失效则重置。
  世代/筛选语义与 [`dexFilter.ts`](../../src/utils/dexFilter.ts) 无关，图标只作用于详情页描述。

## 与「登场作品 appears_in」的关系（待办）

后端主数据里每只宝可梦有 `appearSoftwareAper`（HOME TT 代码）字段，已导出为 `appears_in`
（如妙蛙种子 `sm/xy/oras/sv/lgpe`）。要在详情页按 `appears_in` 显示对应作品徽章，还需要一张
**TT/sw 代码 ↔ 本图标编号（101–111）** 的映射：后端 `export_master.py` 的 `TT_GAMES` 目前是
半成品（`TT001=rdgrn`、`TT010=bdsp2` 等待核对），**该映射尚未对齐，先不要直接拿 TT 码拼图标名**。
上面的版本选择器走的是另一条键（PokeAPI `version_id`），不依赖此 TT 映射。

## 重新获取（如需更新）

HOME 出新版、徽章变化时，在后端仓执行（产物同样不加密、再人工拷回本目录）：

```bash
cd ~/Code/zukan-server
tmp/home/venv/bin/python -m tools.homedata.fetch_ui --group software
# 产物：tmp/home/ui/spriteatlas_softwareicon/PokeTitle_S_*.png
```
