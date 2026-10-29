# 收藏热度榜（Popularity）

全用户收藏聚合出的「最受欢迎宝可梦」榜：每只宝可梦被多少用户收藏、按收藏量排名。
后端用 Postgres **物化视图预计算**，**不是实时数据** —— 服务端在 **UTC+8 每天
00/06/12/18 点**重建 4 次（重启时先补刷一次），数据最多滞后约 6 小时。
服务端原始定义见 zukan-server 仓 `docs/popularity-api.md`。

> 普通聚合 JSON，**不涉及 DEK / 加密**，且**公开匿名可访问**（不带 token 也能请求）。

## 总览

- 前缀：**`/api/v1/popularity`**（JSON API，响应一律 `Cache-Control: no-store`）。
- 鉴权：**无**。首页榜单/详情页热度在未登录态也能展示。
- 新鲜度：以响应中的 `updated_at` 为准（RFC 3339）；`no-store` 只约束共享缓存，
  客户端可自己按天缓存（数据一天只变 4 次）。

| 方法/路径 | 用途 |
|---|---|
| `GET /popularity/pokemon?limit=&offset=` | 人气榜（收藏数降序，同数按 pokemon_id 升序），分页 |
| `GET /popularity/pokemon/:pokemon_id` | 单只收藏数与名次（无人收藏也返回 200） |

## 排序与名次

- 按 `favorite_count` **降序**；收藏数相同时按 `pokemon_id` **升序**破平（确定性顺序）。
- `rank` 从 1 开始、全局连续；翻页时 `rank` 仍是全局名次，不会每页重新编号。
- `favorite_count` = 收藏该宝可梦的**用户数**（同一用户重复收藏只计 1 次）。

## `GET /popularity/pokemon`

查询参数（均可选）：

| 参数 | 默认 | 范围 | 说明 |
|---|---|---|---|
| `limit` | `100` | 1–20000 | 每页条数；`20000` 等于一次拉走整个榜单（实际只有千余行） |
| `offset` | `0` | ≥ 0 | 偏移量 |

```json
{
  "updated_at": "2026-10-29T10:00:00Z",
  "total": 1010,
  "limit": 100,
  "offset": 0,
  "items": [
    { "rank": 1, "pokemon_id": 25, "favorite_count": 42 },
    { "rank": 2, "pokemon_id": 6,  "favorite_count": 38 }
  ]
}
```

- `total`：有收藏记录的宝可梦去重总数（榜单总条数），不是收藏关系总数。
- 参数非整数 / 越界 → 400 `INVALID_INPUT`（统一错误体 `{error, code}`）。

### 建议用法

- **首页 Top N**：`limit=20`（或产品需要的条数），客户端按天缓存即可。
- **本地全量映射**（想在任意列表/详情直接显示收藏数）：启动时拉一次
  `limit=20000`，按 `updated_at` 决定是否复用；体积约几十 KB。
- 翻页：`limit=100&offset=100` …… 或直接用全量映射，通常不需要真分页。

## `GET /popularity/pokemon/:pokemon_id`

详情页用，返回该形态的收藏数与名次：

```json
{ "pokemon_id": 25, "favorite_count": 42, "rank": 1 }
```

- 榜上无名（无人收藏）同样 **200**：`{ "pokemon_id": 19999, "favorite_count": 0, "rank": null }`。
- `pokemon_id` 超出 1–20000 → 400 `INVALID_INPUT`；路径段非数字 → 400。
- 名次口径与榜单一致；若已拉全量映射，本端点可省掉，直接本地查。

## 错误处理

沿用统一错误体 `{"error": "<中文提示>", "code": "<机器码>"}`，热度接口只会出现：

| HTTP | code | 场景 |
|---|---|---|
| 400 | `INVALID_INPUT` | limit/offset/pokemon_id 非法 |

服务端故障为 500 `INTERNAL`（走通用网络错误重试即可）。

## 前端接入（本仓）

- `src/services/api/popularity.ts`：REST 客户端，走 `rest`（自动补 `/api/v1`），
  **不带鉴权头**；snake_case → camelCase，单条脏数据（字段缺失 / 非有限数）过滤，
  `items` 整体形状异常时降级为空列表。
- `src/services/popularity/popularity.ts`：会话级编排。榜单 Promise 按 limit 缓存
  （数据一天只重建 4 次，无需更勤）；按 `genForPokemonId` 号段把 `pokemon_id`
  分世代桶、跨代拉 bundle 解析出 `speciesId` / 属性 slug（resourceManager 缓存，
  重复拉零网络）。号段外的形态内部 id、bundle 找不到、`hasSprite === false`
  （三态，`undefined` 保留）的条目跳过；请求失败清缓存，下次调用可重试。
  物种名 / 属性名不在该层解析 —— UI 直接走 i18n store 的 computed，内容语言切换
  自动刷新，无需因切语言重跑。
- 消费方：资料中心「热门样本」`src/components/pokemon/PopularPokemonSection.vue`
  （挂在 `pages/data/data.vue`），拉 **Top 3**：磁贴显示名次（1 金 / 2 红 / 3 蓝），
  右侧 meta 显示「{n} 人收藏」，点击按 pokemon id 跳详情。
- **回落**：请求失败 / 服务端故障 / 榜单为空（新环境零收藏）时，回落内置三项
  （皮卡丘 / 喷火龙 / 水箭龟），与接入真实接口前的展示、跳转完全一致
  （磁贴为全国编号、meta「详情」）。

