# 属性图标（TypeBadgeIcon）

HOME 官方的**属性贴纸图标**（彩色属性图形 + 白轮廓）。当前用于招式卡
[`MoveCard.vue`](../../src/components/pokemon/MoveCard.vue) 最右侧的属性标识；
将来任何需要「纯图标属性标记」的地方都复用同一组件。

## 性质

- **不加密、纯静态**：直接随包发布，**不要**走 ZKDX 解密或 `resourceManager` /
  `imageCache`（那套只给加密精灵图/道具图标，见 [caching/sprite-cache.md](../caching/sprite-cache.md)）。
- 来源：Pokémon HOME CDN 的 `image_seal_p_type` 资源（`seal_p_Type_*`），已逐 Sprite 切片。
  取数/切片工具在后端仓 `zukan-server`：`tools/homedata/fetch_ui.py`。
- 规格：透明底 PNG，尺寸随图形略有差异（m 档约 136–162px 见方），引用时用 `aspectFit`；
  分 `s` / `m` / `l` 三档。

## 文件编号 = 标准 type id（关键）

```
src/static/img/type-icons/type_NN{s,m,l}.png
```

- **`NN` 就是标准属性 id**：与 `Types` 枚举（`src/model/TypesDefine.ts`）/ PokeAPI
  `types` id / i18n `types` 名称表**完全同值**——normal=01、fighting=02、flying=03、
  poison=04、ground=05、rock=06、bug=07、ghost=08、steel=09、fire=10、water=11、
  grass=12、electric=13、psychic=14、ice=15、dragon=16、dark=17、fairy=18。
- 目录里另有 **19–36**：是同一套 18 属性的**第二套美术变体**（HOME 贴纸有两种风格），
  UI 不使用，不要拿来按「18 + NN」续号。
- 拼路径**不要手写**，统一走单一数据源
  [`pokemonTypes.ts`](../../src/constants/pokemonTypes.ts) 的 `typeIconPath(slug, size)`
  （slug → 标准 id → 文件）；映射用例守在 `tests/typeIcons.spec.ts`。

## 两个属性组件怎么选

| 组件 | 长相 | 用途 |
|------|------|------|
| [`TypeBadge.vue`](../../src/components/pokemon/TypeBadge.vue) | 文字胶囊/方块（渐变或纯色 + 属性名） | 需要**带文字**的属性标签：详情页、筛选、计算器行内等绝大多数位置 |
| [`TypeBadgeIcon.vue`](../../src/components/pokemon/TypeBadgeIcon.vue) | **白底圆形徽章**内嵌属性贴纸图标 | 空间紧、只要图标的属性标记（招式卡最右） |

`TypeBadgeIcon` props：`type`（slug）、`size?: 's'|'m'|'l'`（默认 `m`，圆盘 24/32/44px）。
组件把贴纸落在白圆盘上（细环 + 圆外轻阴影、`overflow:hidden`），未知 slug 自动回落文字版
`TypeBadge`；无障碍名取内容语言的属性名。

> 招式**伤害分类**（物理/特殊/变化）是另一组贴纸 `src/static/img/waza_category/`，
> 单一数据源在 `src/constants/moveCategory.ts`（`moveCategoryIconPath`），别和属性图标混。
