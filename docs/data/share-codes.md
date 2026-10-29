# 分享码（队伍 / 模板字符串分享）

把自建队伍与个人模板编码成一段**可粘贴的字符串**，经剪贴板 / 聊天软件发给他人；对方粘贴
导入，得到一份独立副本。**全程不经过后端**（无新端点、无属主关联），传输通道是用户自己的
剪贴板。本文是分享码格式的**唯一权威定义**；payload 内部结构分别见
[teams.md](teams.md) 与 [templates.md](templates.md)。

## 外观

一整串 **base64url（无 `=` padding，字符集 `[A-Za-z0-9_-]`）**，**不含任何可读明文**——
magic、版本、kind 都编在 base64 内部的二进制头里，肉眼无法分辨种类或来源。典型长度
70–1500 字符（6 成员满配队伍约 1.4 KB）。

## 二进制布局（base64 解出后的字节）

```
byte 0..1   magic：固定 0x5A 0x4B（'ZK'），用于在任意文本中识别分享码
byte 2      高 4 位 version（当前 =2）；低 4 位 kind（0 = team，1 = template）
byte 3..    UTF-8 JSON body
```

| 字段 | 取值 | 说明 |
|---|---|---|
| magic | `0x5A 0x4B` | 双字节固定头；与「base64 解出恰好以这两字节开头」的普通长串冲突概率 1/65536 |
| version | `2`（高 nibble） | 不兼容改动才递增；识别到 magic 但版本为 0 或 >2 → `bad-version`；`1` 为历史版本，继续可解码 |
| kind | `0` / `1`（低 nibble） | 队伍 / 模板；其余值 → `bad-encoding` |

### body（byte 3 起的 UTF-8 JSON）

**v2 起 body 直接是 payload 对象**，原样透传：

```jsonc
{ /* TeamPayload 或 TemplatePayload */ }
```

- **不携带名称**：队伍 / 模板名称永不进分享码——对方导入后一律用本地默认名新建，
  想叫什么由导入方自己决定。
- body 与 payload 都必须是 **JSON 对象**（数组 / 原始值拒绝）。
- **不含**云端 id、时间戳、属主信息 —— 导入永远是**新建**，与原作者再无关联。
- `payload` 内全是跨语言稳定 id / slug（species/move/item/ability id、nature slug 或
  PokeAPI nature id），因此分享码跨 UI 语言 / 内容语言通用。
- 编码侧只保证 body JSON 的 UTF-8 字节 ≤ **32 KiB**（与两个服务端契约同口径）。

### v1 历史信封（仅解码兼容）

版本 nibble = 1 的旧码 body 是 `{ "name": string, "payload": object }` 信封。解码逻辑
保留兼容：**只取 `payload`，信封里的 `name` 一律丢弃**（与 v2 语义对齐）。旧码因此
仍可导入，只是名称不再被采用。

### 从聊天文本中识别

解码容忍输入前后有噪音（整段聊天记录粘贴）：用 `/[A-Za-z0-9_-]{16,}/g` 切出候选 token
（真码最短 70+ 字符，16 足以避开普通单词），按出现顺序逐个 base64 解码，**首个 magic
双字节命中的候选**决定结果：

- magic 不匹配 / 不是合法 base64 → 跳过该候选，继续找；
- magic 命中后，版本 / kind / JSON / body 结构任一损坏直接报对应错误，不再找后续候选；
- 没有任何候选命中 magic → `no-code`。

base64 是大小写敏感的定长编码；长度 `%4===1` 或尾部位非 0 的候选直接跳过。

## 解码与落地

`decodeShareCode(input)` 按层报错，reason 与 UI 文案映射：

| reason | 触发 | UI 处理 |
|---|---|---|
| `no-code` | 无候选 / 无候选命中 magic / 输入非字符串 | 「分享码无效或已损坏」 |
| `bad-version` | magic 对，但版本 nibble 为 0 或 >2 | 「分享码来自更新版本，请升级应用」 |
| `bad-encoding` | kind nibble 非法、UTF-8 / JSON 损坏、base64 规范问题 | 无效或已损坏 |
| `bad-envelope` | body 非对象；v1 信封的 `payload` 非对象 / 缺失 | 无效或已损坏 |
| `payload-too-large` | 仅编码侧：payload > 32 KiB | 抛错（正常数据不可达） |

- base64 / UTF-8 **手写实现**（不依赖 `btoa` / `TextEncoder`，小程序不可用）；UTF-8 非法
  字节回落 U+FFFD，最终由 `JSON.parse` 或结构校验兜住。
- 结构通过后，**payload 不在分享层做领域校验**，调用方接各自的 `normalizePayload`：
  队伍归一永不返回 null；模板归一在缺 `pokemon_id` 等情况下返回 null，导入侧按无效码提示。
  越界值、未知字段保留等前向兼容语义因此自动继承。

## 导入 / 导出的产品语义

- **导入 = 新建**：解析成功后 `beginCreate(默认名)` + `replacePayload(normalized)`
  进编辑页（无 id 新建态），**不直接落库**；分享码不含名称，名字由导入方起。
  改名 / 保存时既有的 `confirmLogin` 闸门、409 重名、名字与大小校验全部复用；
  模板未登录可先存本地草稿。
- 跨 kind（队伍页粘了模板码）不自动跳转（码太长放不进页面参数、也不做跨页暂存）：
  toast 指引用户到另一栏目导入。
- **导出只在编辑页导航栏**：直接编码当前编辑草稿的 payload（`store.draftPayload`，不必先保存，
  名称不进码）；空队伍 / 未选宝可梦时分享按钮禁用；复制走 `uni.setClipboardData`。
- 不做微信「转发卡片」/ 二维码 / 后端短链 / 多对象打包：当前版本是一码一对象、剪贴板传输。

## 前端落地

| 关注点 | 位置 |
|---|---|
| 编解码纯函数（零平台依赖） | `src/services/share/share-code.ts` |
| 导出 / 导入居中弹窗 | `src/components/share/ShareExportDialog.vue`（默认插槽放缩略卡）、`ShareImportDialog.vue` |
| 导出缩略卡（立绘 + 摘要，零额外请求） | `src/components/share/TeamSharePreview.vue`、`TemplateSharePreview.vue` |
| 导出 / 导入编排 | 导出在编辑页 `pages/teams/team-edit.vue`、`pages/templates/template-edit.vue`（编码当前 draft）；导入在两个列表页 |
| 文案（中英，两命名空间各一份） | `src/services/i18n/ui-messages.ts` 的 `teams.*` / `templates.*`（`share`、`importCode`、`errBadCode`、`errNewerVersion`、`errOtherKind` 等） |
| 用例 | `tests/shareCode.spec.ts` |

## 变更格式时

1. 只增不破坏：新字段进 payload（未知字段本来就保留），不动 body 结构与二进制头。
2. 不兼容改动才递增版本 nibble，并让旧版本解码维持可用（v1 信封即按此保留）；
   旧客户端收到新版本会得到明确的 `bad-version` 升级提示，而不是乱码或 `no-code`。
   版本 nibble 仅 4 bit（最大 15）。
3. 新增 kind（低 4 位，2/3…）时同步解码侧映射与跨 kind 指引文案。
