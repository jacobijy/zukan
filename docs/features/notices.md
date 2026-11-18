# 官方公告（Notices）

展示 Pokémon HOME 官方公告列表（维护 / 更新 / 活动 / 联动作品新闻）。数据来自
Pokémon HOME App 内公告页的**构建期快照**：后端从快照文件下发，**不实时抓取、不入库、
无需登录**。公告详情正文与横幅图由客户端直接打开 Pokémon HOME 的公开 webview 地址。

> 普通公开 JSON 数据，**不涉及 DEK / 加密、不涉及鉴权**。数据来源与抓取链路
> （HOME App → 进程内存提取 → 归一化）见 zukan-server 仓 `tools/homedata/README.md`
> 的「公告（Notice）已破解」段。

## 总览

- 前缀：**`/api/v1/notices`**（JSON API，响应 `Cache-Control: no-store`）。
- 鉴权：**无**。匿名可访问。
- 数据时效：快照随服务端部署更新（构建期抓取），公告一般以天为单位变化，
  前端每次进入公告页时拉一次即可，不必轮询。

| 方法/路径 | 用途 | 成功状态 |
|---|---|---|
| `GET /notices?limit=&offset=` | 公告列表，按 `updated_at` 降序 | 200 |
| `GET /notices/:id` | 单条公告 | 200 |

## 列表响应 `GET /notices`

```jsonc
{
  "updated_at": 1794890746,   // 快照时间（Unix 秒）：全部条目 updAt 的最大值
  "total": 36,                // 快照内条目总数
  "limit": 50,                // 本次生效的分页参数（回显）
  "offset": 0,
  "items": [
    {
      "id": "9_1792033106_1788",
      "kind": 2,
      "kind2": 8,
      "title": "赠送异色的“哲尔尼亚斯”！",
      "is_important": false,
      "link_rom": ["52"],     // 关联游戏（HOME 作品编号字符串），可能为 null
      "url": "https://resource.pokemon-home.com/webview/infomation/9Qb2z….html",
      "start_at": 1794492000,
      "updated_at": 1793957791,
      "end_at": 1799333999,
      "banner_url": "https://resource.pokemon-home.com/webview/banner/9_….jpg",
      // banner_url 与 link_rom 在缺省时整个字段省略（skip_serializing_if）
    }
  ]
}
```

### 字段语义

| 字段 | 说明 |
|---|---|
| `id` | HOME 公告 ID（`<语言>_<时间戳>_<序号>`）。**跨抓取周期可能变化**，不要持久化为外键，仅做会话内 key |
| `kind` | **大分类**（对应 App 公告页顶部大 tab）：`1`=Pokémon HOME 本体、`2`=关联软件、`3`=其他 |
| `kind2` | **分类标签**（对应卡片上的小标签，官方文案见下表）。常用值 `3`/`4`/`7`/`8`/`9`/`10` |
| `title` | 标题，抓取时已本地化（中文） |
| `is_important` | 重要标记（App 里红色感叹号） |
| `link_rom` | **关联作品 SF 码列表**（字符串）。对应 App 卡片右上角的游戏小图标；数值即 HOME `software` 表的 `SF####` 编号，官方名见响应顶层 `software` 映射。仅展示用途，未知编号忽略 |

### `kind2` 分类标签 → 官方文案（`sp_ui_notice_category_*`）

| kind2 | 官方标签 |
|---|---|
| 3 | 系统维护 |
| 4 | 更新数据 |
| 7 | 公告 |
| 8 | 关联软件 |
| 9 | 其他公告 |
| 10 | 问卷调查 |

> App 后台文本表里还备有 `1`=公告、`2`=重要公告、`5`=宝可梦 剑／盾、`6`=特别活动，
> 目前枚举里未使用，出现时按上表兜底忽略或显示原文编号即可。

### 响应顶层 `software`（SF 码 → 官方名）

列表响应的顶层带一份**快照实际引用到**的关联作品映射，前端展示 `link_rom` 徽章直接用，无需自维护：

```jsonc
"software": {
  "34": "Pokémon GO",
  "44": "宝可梦 剑", "45": "宝可梦 盾",
  "47": "宝可梦传说 阿尔宙斯",
  "48": "宝可梦 晶灿钻石", "49": "宝可梦 明亮珍珠",
  "50": "宝可梦 朱", "51": "宝可梦 紫",
  "52": "宝可梦传说 Z-A",
  "53": "Pokémon Champions",
  // 58+ 为新作预留；未出现在当前快照中的编号不会在此列出
}
```

`link_rom` 里的编号若不在 `software` 中（新作、官方名尚缺），前端忽略该徽章即可。
| `url` | 官方详情页（公开 webview HTML），免鉴权直接打开 |
| `start_at` / `end_at` | 展示起止（Unix 秒）；快照里可能含已过期条目，客户端可按 `end_at` 过滤“还在展示期”的 |
| `banner_url` | 横幅图（jpg/png），免鉴权直接加载；无横幅的条目省略此字段 |

## 单条响应 `GET /notices/:id`

同列表条目的结构，包一层：`{"id": …, "kind": …, "title": …, …}`（无 `updated_at`/`total`/分页）。
`id` 不存在或格式非法 → `404`，错误体 `{"error": "资源不存在", "code": "NotFound"}`。

## 分页与错误

- `limit` 默认 50，上限 200；`offset` 默认 0。非法值 → `400`，错误体
  `{"error": "limit 必须在 1..=200", "code": "INVALID_INPUT"}` 风格（中文提示，
  以 `code` 字段分支，不要匹配 `error` 字符串）。
- 快照文件缺失/损坏（部署问题）→ 列表 `404`。

## 详情页与横幅的加载策略

- **详情正文**：`url` 是 Pokémon HOME 官方 webview 页（HTML）。前端可直接内嵌
  webview 打开；若要自渲染，需自行抓 HTML 解析（无鉴权、无签名，注意该页结构
  由官方控制可能变化，建议 webview 直开）。
- **横幅图**：`banner_url` 直接 `<image src>` 加载即可（公开 CDN，CloudFront 前置）。
  可按内容 hash 做本地缓存，key 用 `id` 即可。
- 这两类资源与后端无关，**不受** `/assets/encrypted` 加密链路管理，无需 WASM 解密。

## 前端建议

1. 公告页进入时拉 `GET /notices?limit=50`，本地按 `end_at` 过滤掉过期条目。
2. `is_important=true` 的条目置顶并加红点；tab 分组直接用 `kind`（1=HOME / 2=关联软件 / 3=其他，
   与 App 公告页顶部大 tab 一致）；卡片上的小标签用 `kind2` 对照官方文案表。
3. 卡片上的游戏图标：`link_rom` 的编号查响应顶层 `software` 得官方名再匹配本地图标；
   不在映射里的编号忽略。
4. 不在列表页加载详情正文；点击卡片跳 `url`。
