# 自建队伍保存（Teams）

把用户在「队伍界面」组好的队伍**保存到后端、跨设备同步**。登录后可用；后端只做
归属、命名、CRUD、配额，**队伍内容（`payload`）对后端不透明** —— 成员/招式等结构
由前端自定义，后端原样存取。

> 普通用户 JSON 数据，**不涉及 DEK / 加密**。鉴权与会话恢复见
> [../security/auth-session.md](../security/auth-session.md)；接口的服务端原始定义在
> zukan-server 仓 `docs/teams-api.md`，本文以「前端如何对接」为准。

## 总览

- 前缀：**`/api/v1/teams`**（JSON API，响应一律 `Cache-Control: no-store`）。
- 鉴权：全部端点需 `Authorization: Bearer <access_token>`；走现有
  `src/services/api` 的 rest 客户端即可。
- 内容：`payload` 是任意 **JSON 对象**，后端不解析内部字段。

| 方法/路径 | 用途 | 成功状态 |
|---|---|---|
| `GET /teams` | 列出队伍**摘要**（不含内容），按 `updated_at` 降序 | 200 |
| `POST /teams` | 新建队伍 | 201 |
| `GET /teams/:id` | 读取队伍详情（含内容） | 200 |
| `PUT /teams/:id` | **部分更新**（只改提供的 name / payload） | 200 |
| `DELETE /teams/:id` | 删除队伍 | 204 |

## 约束常量

| 约束 | 值 |
|---|---|
| 队伍名长度（trim 后按字符计数，支持多字节） | 1–50 |
| `payload` 序列化后大小 | ≤ 32 KiB（32768 字节） |
| 每用户队伍数量 | ≤ 100 |

名称提交后后端会**去除首尾空白**；payload 必须是 JSON 对象（数组/字符串/数字/null 均拒绝）。

## 数据结构

### 请求

```jsonc
// POST /teams（name、payload 都必填）
{ "name": "冠军队", "payload": { "format": "gen9ou", "members": [ { "species_id": 25 } ] } }

// PUT /teams/:id（部分更新；只传要改的字段，至少一个）
{ "name": "新名字" }
```

### 响应

`GET /teams`：

```json
{
  "teams": [
    {
      "id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
      "name": "冠军队",
      "created_at": "2026-09-26T12:00:00Z",
      "updated_at": "2026-09-26T12:30:00Z"
    }
  ]
}
```

`POST` / `GET :id` / `PUT :id` 返回完整队伍（比摘要多一个 `payload`）：

```json
{
  "id": "7c9e6679-…",
  "name": "冠军队",
  "payload": { "format": "gen9ou", "members": [ { "species_id": 25 } ] },
  "created_at": "2026-09-26T12:00:00Z",
  "updated_at": "2026-09-26T12:00:00Z"
}
```

- 时间戳为 **RFC3339 / UTC（以 `Z` 结尾）**字符串。
- 列表刻意**不带 `payload`**：先列表、再按 id 拉详情，避免一次下发全部队伍内容。

## 典型使用流程

```
进入「我的队伍」 → GET /teams                 # 拿名字 + id 列表
点开某一支       → GET /teams/:id             # 拿 payload 还原阵容
保存（新队）     → POST /teams                # 201，记下返回 id
保存（已有队）   → PUT /teams/:id             # 整体提交 payload；改名也走它
删除             → DELETE /teams/:id
```

- 新建成功后**用响应里的 `id`** 作为之后更新的键，不要本地生成。
- `PUT` 是整体替换「提供的字段」：要保存阵容就把完整 `payload` 提交（不是成员级 patch）。
- 改名后旧名释放，可再被使用。

## 错误处理

统一错误体 `{ "error", "code" }`，按稳定的 `code` 分支（不要匹配 `error` 文案）：

| HTTP | `code` | 触发 | 前端处理 |
|---|---|---|---|
| 401 | `UNAUTHENTICATED` | 未登录 / token 失效 | 走 [auth-session](../security/auth-session.md) 的 401 恢复（refresh → 重试） |
| 400 | `INVALID_INPUT` | 名字空/超长、payload 非对象或超限、PUT 两字段皆无 | 修正后重试；`error` 可直接展示 |
| 404 | `NOT_FOUND` | 队伍不存在或非属主 | 从本地列表移除该队伍 |
| 409 | `CONFLICT` | 同用户队名重名；数量到上限（100） | 提示改名 / 删除旧队伍 |

```json
{ "error": "队伍名已存在", "code": "CONFLICT" }
```

> 越权访问他人队伍统一返回 **404 而非 403**，无法借此探测队伍是否存在。

## 对接建议

- 客户端放 `src/services/api/teams.ts`（参照同目录 `favorites.ts`），并从
  `src/services/api/index.ts` 导出；类型区分 `TeamSummary`（列表）与 `Team`（详情）。
- 队伍是**用户主动保存**的数据，不要在启动时预取；进入队伍管理页再拉。
- 未登录点保存 / 删除 / 改名先经 `confirmLogin()`：弹「是否去登录」确认框，确认后打开
  登录框，登录成功在同一动作内续跑提交；确认框取消或登录层关闭则静默中止、不发请求。
  未登录期间的编辑只在本次会话内存，不写本地存储。

## 前端实际落地（本仓）

### 分层

| 关注点 | 位置 |
|---|---|
| 薄 HTTP 客户端（5 端点，Bearer，不做 clamp） | `src/services/api/teams.ts` |
| payload 类型 / 约束常量 / 归一 / 校验（纯函数，零平台依赖） | `src/services/teams/team-model.ts` |
| 成员选项（形态→特性 id、可学招式池） | `src/services/teams/member-options.ts` |
| 「套用对战热门配置」（meta → 成员补丁） | `src/services/teams/popular.ts` |
| 编排：摘要缓存 / 草稿 / 登录闸门 / 错误码分支 | `src/store/teams.ts` |

### payload 结构（前端自定义、对后端不透明）

成员与队伍都只存**稳定标识**（展示名在渲染层按 id 解析，切换语言无需改数据）：

```ts
type TeamFormat = 'singles' | 'doubles';
interface TeamSpread { hp: number; atk: number; def: number; spa: number; spd: number; spe: number } // 各项 0..32
interface TeamMember {
  species_id: number;        // PokeAPI species / 全国图鉴 id（必填）
  form_id?: number;          // 具体形态；缺省 = 默认形态
  ability_id?: number;
  item_id?: number;
  nature: string;            // Champions Stat Alignment slug（如 'adamant'，默认 'serious'）
  moves: number[];           // PokeAPI move id，去重保序，≤4
  spread: TeamSpread;
}
interface TeamPayload { format: TeamFormat; members: TeamMember[] }  // members ≤6
```

- 边界类型：`TeamSummary{id,name,created_at,updated_at}`；`Team` 多一个 `payload`（边界为
  `unknown`，由 store `normalizePayload` 落地）。
- 纯函数在数据落地时做防御：成员 ≤6、招式去重 ≤4、SP 钳制 0..32、默认形态不写 `form_id`、
  `nature` 非法回落 `serious`；**未知字段保留**（前向兼容更新版本客户端）。
- 约束常量与本文「约束常量」一致，唯一定义处是 `team-model.ts` 的 `LIMITS`。

### 页面

| 页面 | 路径 | 职责 |
|---|---|---|
| 我的队伍（列表） | `pages/teams/teams` | 未登录引导、新建、摘要列表、行内「⋯」重命名/删除 |
| 编辑队伍（组队器） | `pages/teams/team-edit` | 队名 + 赛制、成员卡（特性/道具/性格/招式/SP）、添加成员、保存 |
| 入口 | `pages/features/features.vue` | 功能页签列表（对战模拟器之后） |

- 写操作前统一 `confirmLogin()`（见 [../security/auth-session.md](../security/auth-session.md)）：
  未登录先「是否去登录」确认、再开登录层；确认取消或登录层关闭（`LoginDismissedError`）静默中止。
  两个页面各自挂一份 `LoginModal`。
- 每个成员可「套用对战热门配置」：经 `link` 反查 meta slug → 取该赛制主流配置（rank1）反查 id。
  约 263 slug 之外的物种无此数据，按钮降级提示。数据流见 [battle-usage.md](battle-usage.md)。
