# 配置模板保存（Templates）

把用户的「单个宝可梦配置模板」保存到后端、跨设备同步。登录后可用；后端只做归属、命名、
CRUD、配额，**模板内容（`payload`）对后端不透明** —— 结构由前端自定义、后端原样存取。

> 普通用户 JSON 数据，**不涉及 DEK / 加密**。鉴权与会话恢复见
> [../security/auth-session.md](../security/auth-session.md)；接口的服务端原始定义在
> zukan-server 仓 `docs/templates-api.md`，本文以「前端如何对接」为准，且是
> **payload 存储格式的唯一定义处**。

## 总览

- 前缀：**`/api/v1/templates`**（JSON API，响应一律 `Cache-Control: no-store`）。
- 鉴权：全部端点需 `Authorization: Bearer <access_token>`；走现有 `src/services/api`
  的 rest 客户端即可。
- 内容：`payload` 是任意 **JSON 对象**，后端不解析内部字段。

| 方法/路径 | 用途 | 成功状态 |
|---|---|---|
| `GET /templates` | 列出模板**摘要**（不含内容），按 `updated_at` 降序 | 200 |
| `POST /templates` | 新建模板 | 201 |
| `GET /templates/:id` | 读取详情（含内容） | 200 |
| `PUT /templates/:id` | **部分更新**（只改提供的 name / payload） | 200 |
| `DELETE /templates/:id` | 删除模板 | 204 |

## 约束常量

| 约束 | 值 |
|---|---|
| 模板名长度（trim 后按字符计数，支持多字节） | 1–50 |
| 整体 `payload` 序列化后大小 | ≤ 32 KiB（32768 字节） |
| 每用户模板数量 | ≤ 100 |

名称提交后后端会**去除首尾空白**；`payload` 必须是 JSON 对象（数组/字符串/数字/null 均
拒绝）。这些是后端唯二强制的内容约束；下表的字段取值范围由前端落地时保证。

## 数据结构（请求 / 响应边界）

```jsonc
// POST /templates（name、payload 都必填）
{ "name": "喷火龙模板", "payload": { /* 见下「payload 结构」 */ } }

// PUT /templates/:id（部分更新；只传要改的字段，至少一个）
{ "name": "新名字" }
```

`GET /templates` 列表返回 `{ "templates": [{ id, name, created_at, updated_at }] }`，
刻意**不带 payload**；`POST` / `GET :id` / `PUT :id` 返回完整对象（多一个 `payload`）。
时间戳为 **RFC3339 / UTC（以 `Z` 结尾）**。

## payload 结构（存储格式，前端自定义、对后端不透明）

只存**稳定数值 id**（展示名在渲染层按 id 解析，切换语言无需改数据）。按规则版本区分养成
字段：标准版记 IV/EV，Champions 记能力值点数 SP。

```ts
type Ruleset = 'standard' | 'champions';

// 六维顺序全仓统一：HP / 攻击 / 防御 / 特攻 / 特防 / 速度
interface Stats { hp: number; atk: number; def: number; spa: number; spd: number; spe: number }

interface TemplateBase {
  ruleset: Ruleset;
  pokemon_id: number;   // PokeAPI pokemon.id：默认形态=全国图鉴号，其他形态 10000+
  nature: number;       // PokeAPI nature id（1..25）
  moves: number[];      // PokeAPI move id，去重保序，0..4 个
  item: number | null;  // PokeAPI item id；无对应 id 时写 null
}

interface StandardTemplate extends TemplateBase {
  ruleset: 'standard';
  ivs: Stats;           // 各项 0..31
  evs: Stats;           // 各项 0..252，且六项总和 ≤ 510
}

interface ChampionsTemplate extends TemplateBase {
  ruleset: 'champions';
  sp: Stats;            // 各项 0..32，六项总和 66（见下注记）
}

type TemplatePayload = StandardTemplate | ChampionsTemplate;
```

### 公共字段取值

| 字段 | 取值 | 说明 |
|---|---|---|
| `pokemon_id` | PokeAPI `pokemon.id` | **单字段已含形态**：默认形态=物种号，非默认形态 10000+（精灵图、形态名、可学招式都按它索引）。不要存独立的 `pokemon_form.id` |
| `nature` | PokeAPI nature id，1–25 | i18n 性格名按此 id 查 PKNM `natures` 表。**坑**：HOME/WASM 内部的 0..24 编号顺序不同（≠ id−1），存储只用 PokeAPI id |
| `moves` | PokeAPI move id，≤4 | 普通招式 1–919；去重、保序；用普通整数（勿用 uint8） |
| `item` | PokeAPI item id 或 `null` | id 范围 1–2277（有空洞）；详见下「道具」 |

- **与 teams 的两处口径差异**：模板 `nature` 用**数字 id**（teams 现存的是 `'adamant'` 等
  slug 字符串）；模板用**单个 `pokemon_id`** 表达形态（teams 是 `species_id + form_id`）。
  新代码不要混用。

### 养成字段取值

| 规则 | 字段 | 单项范围 | 总和 |
|---|---|---|---|
| `standard` | `ivs` | 0–31 | — |
| `standard` | `evs` | 0–252 | 六项 **≤ 510** |
| `champions` | `sp` | 0–32 | 六项 = 66 |

- 六维键名统一 `hp / atk / def / spa / spd / spe`（对应 PokeAPI stat id 1–6）。
- **Champions 性格（Stat Alignment）只有 21 种**：在 25 个性格里去掉 Hardy / Docile /
  Bashful / Quirky 四个中性，仅保留 Serious 作中性。前端在 champions 规则下需把这 4 个
  id 视为非法。
- **SP 机制为社区推断口径**（来源 championsbattledata.com 的 `stat_points/spread` 数据 +
  champsdex 攻略）：对战固定 Lv50、IV 恒定满 31、取消 EV，每点 SP 在最终能力上 +1 再乘
  性格 ±10%，总点数 66。**非官方文档背书**，取值（单项 0–32、总 66）与使用率经验一致；
  待官方依据再校准。后端不解析该字段，机制调整不影响服务端。

### 道具（item）

- 存 **PokeAPI item id**（带 PKNM 多语言名、PKFL items 族描述）。
- 对齐红线：**GF 游戏解包的内部道具号与 PokeAPI item id 不对齐**（species/move/ability
  对齐，唯独 item 不对齐），不能拿解包号直接当存储值。对战数据里道具以英文显示名出现，
  需经英文名表反查到 PokeAPI id（以英文为锚最稳，简中/韩语名覆盖少于英文）。
- **Champions 部分新道具（部分 Mega 石等）PokeAPI（只到 Gen9）不存在**，暂无统一数值：
  本次先写 `null`，补 item id（扩展命名空间/映射表）另开任务，不在本功能内做。

### 示例

```jsonc
// 标准版
{
  "ruleset": "standard",
  "pokemon_id": 6,
  "nature": 11,
  "moves": [85, 247, 577, 219],
  "item": 230,
  "ivs": { "hp": 31, "atk": 31, "def": 31, "spa": 31, "spd": 31, "spe": 31 },
  "evs": { "hp": 0, "atk": 252, "def": 0, "spa": 0, "spd": 4, "spe": 252 }
}
```

```jsonc
// Champions（代欧奇希斯-速度形态，无 id 道具写 null）
{
  "ruleset": "champions",
  "pokemon_id": 10003,
  "nature": 11,
  "moves": [85, 344],
  "item": null,
  "sp": { "hp": 0, "atk": 32, "def": 0, "spa": 0, "spd": 0, "spe": 32 }
}
```

## 典型使用流程

```
进入模板列表 → GET /templates              # 拿名字 + id
点开某条     → GET /templates/:id          # 拿 payload 还原配置
保存（新条） → POST /templates             # 201，记下返回 id
保存（已有） → PUT /templates/:id          # 整体提交 payload；改名也走它
删除         → DELETE /templates/:id
```

- 新建成功后**用响应里的 `id`** 作为之后更新的键，不要本地生成。
- `PUT` 是整体替换「提供的字段」：要改配置就把完整 `payload` 提交（不是字段级 patch）。
- 改名后旧名释放，可再被使用。

## 错误处理

统一错误体 `{ "error", "code" }`，按稳定的 `code` 分支（不要匹配 `error` 文案）：

| HTTP | `code` | 触发 | 前端处理 |
|---|---|---|---|
| 401 | `UNAUTHENTICATED` | 未登录 / token 失效 | 走 [auth-session](../security/auth-session.md) 401 恢复（refresh → 重试） |
| 400 | `INVALID_INPUT` | 名字空/超长、payload 非对象或超限、PUT 两字段皆无 | 修正后重试；`error` 可直接展示 |
| 404 | `NOT_FOUND` | 模板不存在或非属主 | 从本地列表移除该模板 |
| 409 | `CONFLICT` | 同用户模板重名；数量到上限（100） | 提示改名 / 删除旧模板 |

```json
{ "error": "模板名已存在", "code": "CONFLICT" }
```

> 越权访问他人模板统一返回 **404 而非 403**，无法借此探测模板是否存在。

## 对接建议

- 客户端放 `src/services/api/templates.ts`（参照同目录 `teams.ts` / `favorites.ts`），并从
  `src/services/api/index.ts` 导出；类型区分 `TemplateSummary`（列表）与 `Template`（详情）。
- payload 的类型 / 约束常量 / 归一 / 校验放纯函数模块（参照 teams 的 `team-model.ts`）：
  IV/EV/SP 钳制、招式去重 ≤4、性格与道具合法性回落、**未知字段保留**（前向兼容）。
- 模板是**用户主动保存**的数据，不启动预取；进入对应页面再拉。未登录时保留本地编辑，点
  「保存」再引导登录，成功后提交（与收藏/队伍的登录闸门一致）。
