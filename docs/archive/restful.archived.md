# RESTful API 文档（已废弃 / 未实现的设计稿）

> **⚠️ 本文档描述的 API 从未实现，请勿据此写代码。**
>
> 这是项目早期设想的一套通用 CRUD 后端。实际的 zukan-server 走了完全不同的
> 路线：宝可梦数据不走 JSON 接口，而是以预加密的 FlatBuffers bundle 整包下发，
> 前端 WASM 解密后在本地组装。因此下面的宝可梦 / 属性 / 世代接口**都不存在**。
>
> 与现实的主要冲突：
>
> | 本文档 | 实际实现 |
> |---|---|
> | Base URL `/api` | `/api/v1`（静态资源与 `/health` 在根路径） |
> | 字段 camelCase（`pokemonId`） | snake_case（`pokemon_id`） |
> | 响应包 `{data, message}` | 直接返回裸对象 |
> | 错误包 `{error:{code,message,details}}` | `{error: "消息字符串"}` |
> | `GET /api/pokemons` 等 CRUD 端点 | 不存在；数据走 `/assets/encrypted/fb/*.bin` |
> | 分页参数 `page`/`pageSize` | 不存在；整包下发后前端本地分页 |
>
> **真实 API 文档：**
> - 端点总表：[`zukan-server/README.md`](../../zukan-server/README.md)
> - 认证接口：[`zukan-server/docs/auth-api.md`](../../zukan-server/docs/auth-api.md)
> - 数据下发与解密：[`encryption.md`](./encryption.md)、[`zukan-decryption.md`](./zukan-decryption.md)
>
> 保留本文件仅为记录早期设计意图与命名约定的讨论过程。

---

## 基础约定

- Base URL：`/api`
- 请求格式：`application/json`
- 响应格式：`application/json`
- 字段命名：前后端统一使用 camelCase
- 时间格式：ISO 8601 字符串，例如 `2026-06-02T00:00:00.000Z`

## HTTP 方法

| 方法 | 用途 |
| --- | --- |
| `GET` | 查询资源 |
| `POST` | 创建资源 |
| `PUT` | 全量更新资源 |
| `PATCH` | 局部更新资源 |
| `DELETE` | 删除资源 |

## 状态码

| 状态码 | 说明 |
| --- | --- |
| `200` | 请求成功 |
| `201` | 创建成功 |
| `204` | 请求成功且无响应体 |
| `400` | 请求参数错误 |
| `401` | 未登录或认证失败 |
| `403` | 无权限访问 |
| `404` | 资源不存在 |
| `409` | 资源冲突 |
| `500` | 服务端错误 |

## 响应结构

### 成功响应

```json
{
  "data": {},
  "message": "success"
}
```

### 分页响应

```json
{
  "data": {
    "list": [],
    "page": 1,
    "pageSize": 20,
    "total": 0,
    "hasMore": false
  },
  "message": "success"
}
```

### 错误响应

```json
{
  "error": {
    "code": "BAD_REQUEST",
    "message": "请求参数错误",
    "details": {}
  }
}
```

## 通用查询参数

| 参数 | 类型 | 说明 |
| --- | --- | --- |
| `page` | number | 页码，从 `1` 开始 |
| `pageSize` | number | 每页数量，默认 `20` |
| `keyword` | string | 搜索关键字 |
| `sortBy` | string | 排序字段 |
| `sortOrder` | `asc` \| `desc` | 排序方向 |

## 宝可梦接口

### 获取宝可梦列表

```http
GET /api/pokemons?page=1&pageSize=20&keyword=妙蛙&type=grass&generation=1
```

#### 查询参数

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `page` | number | 否 | 页码 |
| `pageSize` | number | 否 | 每页数量 |
| `keyword` | string | 否 | 按名称搜索 |
| `type` | string | 否 | 按属性筛选 |
| `generation` | number | 否 | 按世代筛选 |
| `favoriteOnly` | boolean | 否 | 是否仅返回收藏 |
| `sortBy` | string | 否 | 排序字段，例如 `id`、`name` |
| `sortOrder` | `asc` \| `desc` | 否 | 排序方向 |

#### 响应示例

```json
{
  "data": {
    "list": [
      {
        "id": 1,
        "formattedId": "001",
        "name": "妙蛙种子",
        "types": ["grass", "poison"],
        "abilities": ["overgrow", "叶绿素"],
        "hiddenAbility": "叶绿素",
        "image": "/static/pokemon/1.png",
        "description": "妙蛙种子出生时背上就背着种子。种子会随着它的成长而逐渐变大并开花。"
      }
    ],
    "page": 1,
    "pageSize": 20,
    "total": 1,
    "hasMore": false
  },
  "message": "success"
}
```

### 获取宝可梦详情

```http
GET /api/pokemons/{id}
```

#### 路径参数

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `id` | number | 是 | 宝可梦 ID |

#### 响应示例

```json
{
  "data": {
    "id": 1,
    "formattedId": "001",
    "name": "妙蛙种子",
    "types": ["grass", "poison"],
    "abilities": ["overgrow", "叶绿素"],
    "hiddenAbility": "叶绿素",
    "image": "/static/pokemon/1.png",
    "stats": [
      { "name": "HP", "value": 45 },
      { "name": "攻击", "value": 49 },
      { "name": "防御", "value": 49 },
      { "name": "特攻", "value": 65 },
      { "name": "特防", "value": 65 },
      { "name": "速度", "value": 45 }
    ],
    "moves": [],
    "evolutionChain": [],
    "description": "妙蛙种子出生时背上就背着种子。种子会随着它的成长而逐渐变大并开花。"
  },
  "message": "success"
}
```

### 获取属性列表

```http
GET /api/pokemon-types
```

#### 响应示例

```json
{
  "data": [
    { "value": "grass", "label": "草" },
    { "value": "poison", "label": "毒" }
  ],
  "message": "success"
}
```

### 获取世代列表

```http
GET /api/generations
```

#### 响应示例

```json
{
  "data": [
    { "value": 1, "label": "第一世代" },
    { "value": 2, "label": "第二世代" }
  ],
  "message": "success"
}
```

## 收藏接口

如果收藏由服务端保存，可以使用以下接口；如果收藏仅保存在本地，则不需要实现本节接口。

### 获取收藏列表

```http
GET /api/favorites
```

### 添加收藏

```http
POST /api/favorites
```

#### 请求体

```json
{
  "pokemonId": 1
}
```

### 删除收藏

```http
DELETE /api/favorites/{pokemonId}
```
