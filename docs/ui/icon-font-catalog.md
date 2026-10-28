# 图标字体与栏目图标清单

工程内的单色线性图标统一走**自建图标字体**：`.vue` 里写一份 `data-ic` 内联 SVG，
`pnpm build:icons` 收集后生成 `zukan-icons.ttf` + `glyphs.ts`（当前 **41 个** glyph）。
H5 渲染内联 SVG，微信小程序渲染字体字符。本文记录：机制与规格、三个 tab 页的栏目
图标对照表、全量 glyph 索引。

> 本文管**单色 UI 图标**与两个入口页的**栏目/功能位图**两件事。其他彩色图片资源：
> 属性贴纸见 [type-icons.md](type-icons.md)，HOME 作品版本徽章见
> [software-icons.md](software-icons.md)，加密精灵图 / 道具图标见
> [../caching/sprite-cache.md](../caching/sprite-cache.md)。

## 1. 机制与双端写法

每个单色图标在模板里写两份，靠条件编译切换（微信端不支持内联 SVG 的组件样式封装）：

```vue
<!-- #ifdef MP-WEIXIN -->
<text class="ic text-[24px]">{{ glyph('focus') }}</text>
<!-- #endif -->
<!-- #ifndef MP-WEIXIN -->
<svg data-ic="focus" viewBox="0 0 24 24" fill="none" stroke="currentColor"
     stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="h-6 w-6">
  <path d="..."></path>
</svg>
<!-- #endif -->
```

- **收集规则**：`scripts/build-icons.mjs` 扫描 `src/**/*.vue` 中的 `data-ic="<name>"` SVG；
  模板里没出现、但微信端/动态需要的图标放
  [`src/components/icon/extra/`](../../src/components/icon/extra/)（tab 图标、品牌图标、
  heart/star 等），构建时一并并入。
- 产物：`src/static/fonts/zukan-icons.ttf`、[`src/components/icon/glyphs.ts`](../../src/components/icon/glyphs.ts)
  （`GLYPH` 码点表，自动生成勿手改；该文件不在 prettier 合规集内，勿手跑 format）。
  `dev/build:mp-weixin` 会自动跑 `build:icons`。
- **同名必须同形（含 stroke-width）**：构建有一致性门禁，两个文件出现同名不同 path
  会直接失败。复制图标改名时必须连 path 一起改。
- 微信端字号即图标尺寸（`text-[24px]`）；H5 端尺寸由 svg 的 `h-* w-*` 决定。
- 颜色统一用 `currentColor` / `text-[#xxx]`，容器底色由 `iconClass` 传全局变体。

### 1.1 入口页栏目图标：`HubIcon.vue` 位图，单一数据源

资料 / 功能 / 我的三个入口页的 **16 个栏目图标**是一组专门设计的 **3D 炫彩插画**
（深蓝近黑描边 + 高饱和蓝/红/金渐变 + 精灵球母题，2026-10 套），单色字体表达不了，
全部走位图：`src/static/img/hub-icons/<短名>.png`（144×144 @4 母版），
[`components/shared/HubIcon.vue`](../../src/components/shared/HubIcon.vue) 内
`RASTER_ICONS: Record<HubIconName, string>` 是唯一映射，组件只有一个
`<image mode="aspectFit" class="h-9 w-9">`，两端同一渲染、无条件编译分支：

```vue
<HubIcon :name="item.icon" />
```

不要在页面里为这组图标写 `#ifdef` 双份，也不要把栏目名复用到子页面
（子页面继续用通用 glyph）；增删图形只改 HubIcon.vue 一处（加 PNG、加映射、
扩 `HubIconName`）。名字清单见组件内联合类型与本文 §3 对照表。历史上这 16 枚曾分属
「12 枚位图 + 4 枚 data-ic 字形」两条通道，2026-10 已统一为位图，字形
（mine-settings / mine-history / mine-devtools / hub-stats）随之从字体删除。
旧像素画套备份在仓库外 `~/Code/zukan-icon-work/backup-pre-glossy-20261027/`。

### 1.2 功能信息图标：`FuncIcon.vue` 彩色位图（2026-10 套）

宝可梦详情数值卡（身高/体重/特性…）、招式详情（威力/命中/先制…）、计算器卡片头
（攻防/招式）用的是另一套 **24×24 实心彩色 SVG**（图标自带主色、白色做细节），
单色字体同样表达不了，走与 HubIcon 相同的位图通道：

- 源 SVG 入库 `scripts/icons/func/<name>.svg`，`scripts/render-func-icons.mjs`
  （resvg，复用传递依赖，不新增包）一次产出两样：
  - `src/static/img/func-icons/<name>.png`，**144×144 @4 母版**；渲染时把 viewBox
    扩成 `-2 -2 28 28` 留 ~7% 透气，避免源图形顶格。**根标签的 fill 必须保留**
    （主色写在根上，剥根标签会全部变黑）。
  - `src/static/styles/func-tiles.css`：**同色相浅底色桶**（见下），由 main.ts 全局引入。
- [`components/icon/FuncIcon.vue`](../../src/components/icon/FuncIcon.vue) 是图标唯一映射，
  `<FuncIcon name="height" size="md" />`，两端同一 `<image>`、无 `#ifdef`；
  `size`：md=30px（42px InfoCard 槽）/ sm=20px（26px CalcCard 头槽）。
- **底色按图标主色自动推导（同色相 tint）**：脚本从每个 SVG 根 fill 取色 → HSL →
  就近归到 5 个色桶（blue 213° / green 150° / gold 39° / red 355° / violet 262°）
  → 生成 `.func-tile--<桶>`：浅底渐变 L95%→88% + 深墨 ink L30%。槽位容器（InfoCard /
  CalcCard / CalcSideCard）只定尺寸圆角，不再自带配色，`iconClass="func-tile--blue"`
  由调用点传入；**ink 同时给保留的单色 glyph 着色**（蛋群盾/PP 书/目标靶/场地云借同色桶）。
  新增图标自动渲图、自动归桶，零配置；同组卡片出现同色相邻（如两张蓝卡）时，调用点
  改传另一个桶做编排即可，不必动脚本。当前 12 枚归桶：blue=height/details/battle/
  pokemon/stats，green=accuracy/defense/move，gold=ability/power，red=up，violet=weight。
- 暂不使用的同套候选（如 hp/sleep/event/item…）留在 `tmp/icons` 设计稿，未入库；
  属性 7 枚（fire/water/…）不在功能套内，勿与 TypeBadgeIcon 混用。

## 2. 栏目行（ListRow）统一规格

三个 tab 页的栏目都用 [`ListRow.vue`](../../src/components/shared/ListRow.vue)，
基础规则与配色变体定义在全局 `src/static/styles/global.css`（不能挪进 scoped，
原因见该文件注释：scoped (0,2,0) 会盖掉变体 (0,1,0) 的颜色）。

| 项 | 规格 |
|---|---|
| 行高 | 78px |
| 图标容器 `.list-row__icon` | 48 × 48px，圆角 14px，**浅彩渐变底** + 细描边 + 轻投影 |
| 内部图标 | 36 × 36px 位图（`HubIcon`，3D 炫彩套 @4 母版，主体自带约 12–20% 边距） |
| 右侧 chevron | 16 × 16px，`#c4c7cf` |
| 标题 / 描述 / meta | 16px 600 / 12px 灰 `#8d929c` / 11px 浅灰 `#b4b8c0` |

2026-10 随 3D 图标套把磁贴从饱和彩底改为**浅彩底**：16 枚位图 13 枚主色是藏青/蓝，
饱和底会同色相叠压；浅底翻转明度关系，靠图标自身深色描边分离。每个变体因此都带
**深墨 `color`**（不只 gold）——设置页的单色 currentColor 字形（globe/book）在浅底上
必须走深墨；新增配色变体时同样要给 `color`，默认白字在浅底上不可见。

配色变体（`iconClass` 传，底色以各页面当前配置为准）：

| class | 渐变 | 当前用途 |
|---|---|---|
| `list-row__icon--green` | 绿 | 伤害计算、道具 |
| `list-row__icon--gold` | 金（深字） | 属性、我的队伍、收藏 |
| `list-row__icon--blue` | 蓝 | 招式、能力值、浏览历史 |
| `list-row__icon--violet` | 紫 | 对战资料、模板、数据统计、devtools |
| `list-row__icon--gray` | 灰 | 全国图鉴、对战模拟、设置 |
| `list-row__icon--red` | 红 | 特性 |

## 3. 栏目图标对照表

### 3.1 功能页 [`pages/features/features.vue`](../../src/pages/features/features.vue)

位图，统一由 `HubIcon.vue` 提供（`hub-*` 名字）：

| 栏目 | name | 尺寸（容器/图标） | 图形（3D 套 v2） | 底色 | 跳转 |
|---|---|---|---|---|---|
| 伤害计算器 | `hub-damage` | 48 / 36px | 深蓝游戏手柄 + 黄色三光芒 | 绿 | `/pages/calc/calc` |
| 能力值计算器 | `hub-stat` | 48 / 36px | 递增竖柱（蓝/金/紫）+ 基线，右下叠精灵球 | 蓝 | `/pages/statcalc/statcalc` |
| 对战模拟器 | `hub-battle` | 48 / 36px | 交叉双剑（蓝刃藏青柄）+ 黄色三光芒 | 灰 | `/pages/simulate/simulate` |
| 我的队伍 | `hub-team` | 48 / 36px | 蓝色三人剪影，前置精灵球 | 金 | `/pages/teams/teams` |
| 我的模板 | `hub-template` | 48 / 36px | 深蓝剪贴板清单（三蓝勾三行），右下叠精灵球 | 紫 | `/pages/templates/templates` |
| 数据统计 | `hub-stats` | 48 / 36px | 深蓝仪表盘窗（饼图 + 竖柱），右下叠精灵球 | 紫 | `/pages/data/data`（tab 页，switchTab） |

### 3.2 资料页 [`pages/data/data.vue`](../../src/pages/data/data.vue)

位图，统一由 `HubIcon.vue` 提供（`data-*` 名字）。「图鉴概览」组，右侧 meta
显示实时计数：

| 栏目 | name | 尺寸（容器/图标） | 图形（3D 套 v2） | 底色 | 跳转 |
|---|---|---|---|---|---|
| 宝可梦总数（1025） | `data-dex` | 48 / 36px | 蓝色翻开的书，左页精灵球、右页三横线 | 灰 | `/pages/index/index`（tab 页） |
| 属性种类（18） | `data-type` | 48 / 36px | 五枚彩色六边形属性徽章（火/水/草/电/幽灵）围中央深蓝星徽 | 金 | `/pages/archive/types` |
| 招式数量（实时计数） | `data-move` | 48 / 36px | 精灵球拖蓝色速度残影 | 蓝 | `/pages/archive/moves` |
| 特性记录（300+） | `data-ability` | 48 / 36px | 蓝色层叠盾牌 + 白星切孔，右上黄四角星 | 红 | `/pages/archive/abilities` |
| 道具种类（实时计数） | `data-item` | 48 / 36px | 红色图鉴掌机（屏幕小兽剪影 + 圆点按钮）+ 黄色光芒 | 绿 | `/pages/archive/items` |

「对战」组：**对战资料**（单人/双人使用率排行）用 `data-meta`（递增柱 + 黄色上升箭头，
右下叠精灵球，紫底），跳 `/pages/meta/meta`。

同页「热门样本」（皮卡丘 / 喷火龙 / 水箭龟）用 48px 金 / 红 / 蓝编号色块
（`.pokemon-mark--gold/red/blue`，非图标），行尾只有 16px chevron。

### 3.3 我的页 [`pages/mine/mine.vue`](../../src/pages/mine/mine.vue)

位图，`mine-*` 名字：

| 栏目 | name | 尺寸（容器/图标） | 图形（3D 套 v2） | 底色 | 跳转 |
|---|---|---|---|---|---|
| 设置 | `mine-settings` | 48 / 36px | 深蓝齿轮，中心嵌精灵球 | 灰 | `/pages/settings/settings` |
| 我的收藏 | `mine-fav` | 48 / 36px | 粉红光泽爱心，内嵌精灵球切孔 + 黄色光芒 | 金 | **暂无（`onMenuTap` 未实现分支）**，右侧数量角标 |
| 浏览历史 | `mine-history` | 48 / 36px | 蓝色时钟 + 逆时针回环箭头 | 蓝 | **暂无（同上）** |
| 开发者工具（仅 dev 构建） | `mine-devtools` | 48 / 36px | 蓝色代码笔电（屏幕 `</>`），右下叠黄色齿轮 | 紫 | `/pages/devtools/devtools` |

顶部训练家卡用 `PokeballLogo` 精灵球组件（非图标）。dev-only 行受
`services/devtools/enabled.ts` 单点门禁控制，生产构建会被整段剔除。

### 3.4 底部 TabBar [`components/TabBar.vue`](../../src/components/TabBar.vue)

| tab | glyph（extra/） | 图形 | 选中色 |
|---|---|---|---|
| 图鉴（index 0） | `tab-book` | 书本 | 主题蓝 |
| 功能（index 1） | `tab-grid` | 九宫格 | 主题蓝 |
| 资料（index 2） | `tab-folder` | 文件夹 | 主题蓝 |
| 我的（index 3） | `tab-person` | 单人剪影 | 主题蓝 |

tab 图标只在字体里用（`fontName` 字符串引用），SVG 源仅存于
`src/components/icon/extra/`，所以直接 grep `data-ic` 找不到。

## 4. 全量 glyph 索引（41）

### 导航 / 箭头（5）

| glyph | 图形 | 主要用途 |
|---|---|---|
| `arrow-left` | 细返回箭头 | 导航栏返回 |
| `chevron-left` / `chevron-right` | 左右折角 | 详情返回 / 列表行进给 |
| `chevron-down` / `chevron-up` | 上下折角 | 抽屉、折叠面板 |

### 通用操作（15）

| glyph | 图形 | 主要用途 |
|---|---|---|
| `plus` | 加号 | 新建队伍/模板/成员（≈14 处） |
| `x` | 关闭叉 | 弹层关闭、清空 |
| `check` | 勾 | 选中、确认 |
| `search` | 放大镜 | 搜索框 |
| `filter` | 漏斗 | 筛选入口 |
| `more-vertical` | 竖三点 | 行更多操作 |
| `trash` | 垃圾桶 | 删除（走二次确认） |
| `refresh-ccw` | 逆时针回旋 | 刷新、重开 |
| `file-lines` | 带行文件 | 记录/详情文本 |
| `log-in` | 进门箭头 | 登录 |
| `cloud` | 云 | 计算器·场地卡（浅底深墨）、云端同步状态 |
| `bookmark` / `bookmark-fill` | 书签 / 实心书签 | 模板、收藏 |
| `eye` / `eye-off` | 眼睛 / 划线眼 | 密码显隐 |

### 标记 / 反馈（6）

| glyph | 图形 | 主要用途 |
|---|---|---|
| `heart` / `heart-fill` | 心 / 实心心 | 喜欢、收藏（extra） |
| `star` / `star-fill` | 星 / 实心星 | 详情收藏按钮、图鉴空态等 |
| `clock` | 时钟 | 图鉴筛选栈（DexToolbar） |
| `info` | 信息圈 | 详情页提示按钮 |

### 功能 / 物件（8）

> 2026-10 数值卡/卡片头改走 §1.2 彩色 FuncIcon 位图后，focus / zap / zap-bolt /
> bar-chart / user / book-open / shopping-bag / concentric / arrow-up / move 已从
> 字体移除。剩下的功能 glyph：

| glyph | 图形 | 主要用途 |
|---|---|---|
| `target` | 三层同心圆靶心 | 招式详情·目标卡（浅底深墨） |
| `users` | 双人剪影 | 队伍列表行 |
| `book` | 书 | 设置页语言行、招式详情·PP（浅底深墨） |
| `sparkle` | 四角星 | 特性详情头、特性率标记、成员卡 |
| `bag` / `package` | 手提包 / 包裹箱 | 对战道具回落、道具 404 回落 |
| `shield` | 盾牌 | 宝可梦详情·蛋群卡（浅底深墨） |
| `globe` | 地球仪 | 语言/地区（设置页） |

### 4.1 入口页栏目位图（16，`HubIcon.vue`，不在字体里）

| name | 栏目 | 磁贴底 |
|---|---|---|
| `data-dex` | 资料·宝可梦总数 | 灰 |
| `data-type` | 资料·属性种类 | 金 |
| `data-move` | 资料·招式数量 | 蓝 |
| `data-ability` | 资料·特性记录 | 红 |
| `data-item` | 资料·道具种类 | 绿 |
| `data-meta` | 资料·对战资料 | 紫 |
| `hub-damage` | 功能·伤害计算器 | 绿 |
| `hub-stat` | 功能·能力值计算器 | 蓝 |
| `hub-battle` | 功能·对战模拟器 | 灰 |
| `hub-team` | 功能·我的队伍 | 金 |
| `hub-template` | 功能·我的模板 | 紫 |
| `hub-stats` | 功能·数据统计 | 紫 |
| `mine-fav` | 我的·收藏 | 金 |
| `mine-settings` | 我的·设置 | 灰 |
| `mine-history` | 我的·浏览历史 | 蓝 |
| `mine-devtools` | 我的·开发者工具 | 紫 |

### 品牌 / TabBar（7）

| glyph | 图形 | 主要用途 |
|---|---|---|
| `brand-apple` / `brand-phone` | Apple 标 / 手机（extra） | App 平台登录/下载入口 |
| `brand-weixin` | 微信标（extra） | 小程序内微信登录 |
| `tab-book` / `tab-grid` / `tab-folder` / `tab-person` | 书 / 九宫格 / 文件夹 / 人 | TabBar 四个 tab，仅字体引用 |

## 5. 维护须知

1. **新增单色图标**：在 `.vue` 里写带 `data-ic="new-name"` 的 24×24 SVG（H5 份）和
   `glyph('new-name')`（微信份）；只在微信/动态场景用的放 `extra/new-name.svg`。
   跑 `pnpm build:icons` 验证。**三个入口页的栏目图标不要新写双份**——加 PNG 到
   `src/static/img/hub-icons/`、在 `components/shared/HubIcon.vue` 的 `RASTER_ICONS`
   与 `HubIconName` 联合类型登记，页面只传名字。**实心彩色功能图标同理走 FuncIcon**：
   源 SVG 放 `scripts/icons/func/`，跑 `node scripts/render-func-icons.mjs` 同时出
   PNG 与 func-tiles.css（底色按根 fill 自动归桶，无需手配），再在
   `components/icon/FuncIcon.vue` 登记 name 映射、调用点传 `func-tile--<桶>`；
   不要把带写死颜色的 SVG 塞进字体流程。调全套淡底明度/饱和改脚本顶部 `TINT`，
   加色桶改 `TILES`（生成物勿手改）。
2. **改名复制必须连 path 一起改**——同名不同形门禁会失败（历史上 check 被画成
   chevron、chevron-left 抄成右箭头都撞过）。
3. 单色 SVG 颜色不要写死，用 `currentColor`，底色走全局变体 class；栏目位图自带全彩，
   不经此规则。改位图后在**真实彩色磁贴网格**上评审（白底线稿会误导），
   工具在 `~/Code/zukan-icon-work/_tools/`。
4. 栏目行优先复用 `ListRow` + 现有配色变体；新增配色先在 `global.css` 加
   `.list-row__icon--*`，不要在页面 scoped 里覆盖。
5. 改完跑门禁：`pnpm build:icons`（必须通过）、`pnpm type-check`；
   微信端额外确认字体字符渲染（构建产物里 grep 不到 glyph 渲染问题，要真机/开发者工具看）。
