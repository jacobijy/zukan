# 伤害计算器数据流

计算器涉及三份数据源和两处代码硬编码。本文说明每种输入是**如何加载**、**在哪能改**、以及**改动是否需要重编 WASM**。

## 端到端 —— 一次计算的输入路径

```
calc.vue                     用户在页面上选宝可梦 / 招式 / 天气 / 场地
   │
   ▼
calc-engine.ts::calcDamage(params)
   ├─ 属性 slug         → TYPE_IDS       (types.json)
   ├─ 特性 slug         → ABILITY_IDS    (abilities.json，slug 去连字符归一化)
   ├─ 天气 slug         → WEATHER_IDS    (weathers.json，同上)
   ├─ 场地 slug         → TERRAIN_IDS    (terrains.json)
   └─ 招式 name         → lookupMoveFlags() ─┐
                                              ▼
                                          见「招式 flags 专题」
   │
   ▼
new DamageInput(level, atk, def, ..., move_flags)
wasm.calculateDamageBatch(input)   ← Rust 侧读枚举常量做修正因子
```

WASM 侧只认数字 ID（`u8`/`u16`），所有 slug→id 翻译在 JS 侧完成。

## 数据源

| 数据 | 位置 | 加载时机 | 更新方式 |
| --- | --- | --- | --- |
| 属性 slug → id | `src/static/enums/types.json` | 模块 import（打包进 JS） | 换 JSON 后前端重打包（不改代码） |
| 特性 slug → id | `src/static/enums/abilities.json` | 同上 | 同上 |
| 招式 slug → moveId | `src/static/enums/moves.json` | 同上 | 同上 |
| 招式 flag slug → flag id | `src/static/enums/move_flags.json` | 同上 | 同上（pokeapi 定义） |
| 天气 slug → id | `src/static/enums/weathers.json` | 同上 | 换 JSON（也要同步改 Rust `WEATHER_*` 常量，见下）|
| 场地 slug → id | `src/static/enums/terrains.json` | 同上 | 同上 |
| moveId → flag id 列表 | `/assets/encrypted/fb/moves_data/common.bin` 里的 `move_flag_map` 表 | `resourceManager.getMovesData('common')` 首次调用（懒加载，缓存至内存） | 换 CDN 上的 bin，前端下次拉取自动生效 |
| WASM 枚举常量（`TYPE_*`/`WEATHER_*`/`TERRAIN_*`/`ABILITY_*`） | `src/infra/wasm/build.rs` 编译期从 `src/static/enums/*.json` 生成 | Rust 编译期 include | 改 JSON 后 `cargo build` 会通过 `rerun-if-changed` 自动重编 |

## 招式 flags 专题（`lookupMoveFlags`）

调用方传的是英文 slug（`"firepunch"` / `"fire-punch"` / `"Fire Punch"` 均可），最终得到一个 `u16` 位掩码传给 WASM。

**① slug → moveId** — `calc-engine.ts::MOVE_ID_BY_SLUG`

启动时从 `moves.json` 建表，key 是去连字符/空格的 lowercase：
```
"firepunch" → 7
```

**② moveId → 位掩码** — `calc-engine.ts::getMoveFlagMask()`

懒加载，首次调用时：
1. `resourceManager.getMovesData('common')` 拉 CDN 的 `moves_data/common.bin`（FlatBuffers `MovesDataBundle`）
2. 读 `bundle.moveFlagMap: MoveFlagPair[]`，每条 `{ moveId, moveFlagId }` 是招式 × pokeapi flag id 的多对多映射
3. 用 `FLAG_ID_TO_BIT` 把 pokeapi flag id 翻成 WASM 位掩码 bit，同一 moveId 的多个 bit `|=` 累加
4. 整个 `Map<moveId, u16>` 缓存在闭包里，后续命中不再拉 bin
5. 拉取失败静默降级为空 Map（计算不阻塞，但铁拳/强壮之颚等 flag 敏感的特性触发失灵）

**③ FLAG_ID_TO_BIT 是怎么建的** — `calc-engine.ts::WASM_FLAG_BITS`

`move_flags.json` 给了 21 种 pokeapi flag slug → id。WASM 只关心其中 8 种（`contact`/`punch`/`bite`/`sound`/`pulse`/`powder`/`ballistics`/`heal`），`WASM_FLAG_BITS` 手写了这 8 种到位序的对应关系。两表 join 得 `Map<pokeapi flag id, WASM bit>`。

**具体例子：**
```
"firepunch"
  → moveId 7                (moves.json)
  → moveFlagMap[7] = [1, 8, 11]           (contact / punch / defrost)
  → FLAG_ID_TO_BIT: 1→CONTACT(bit0), 8→PUNCH(bit1), 11→undefined 跳过
  → mask = 0b00000011 = 3
```

`calculator.rs::lookup_attacker_ability` 里 `(move_flags & MOVE_FLAG_PUNCH) != 0` 就能触发铁拳 (+20% 拳类)。

## 代码里的硬编码

以下两处**不**从 JSON 生成，改它们需要连同 Rust 一起改：

**1. WASM 招式 flag 位序**（`calc-engine.ts::MOVE_FLAG` + `calculator.rs::MOVE_FLAG_*`）

这是 Rust ↔ JS 的 ABI 契约（一个 `u16` 里每一位代表哪种 flag）。与 `move_flags.json` 里的 pokeapi flag id 是**不同的东西** —— pokeapi id 是数据表行号，位序是内部通信协议。位序改动需同时改两侧代码。

**2. pokeapi flag slug → WASM bit 的映射**（`calc-engine.ts::WASM_FLAG_BITS`）

只有 8 项，映射 pokeapi 定义到 WASM 关心的位。新增 flag 到 WASM 逻辑时同时改这里 + `calculator.rs` 里的 `MOVE_FLAG_*` + 位敏感的 match 分支。

## 常见更新场景

| 场景 | 需要动的东西 | 需要重编 WASM 吗 |
| --- | --- | --- |
| 新增/修改招式（威力、类别、flag 归属） | CDN 上的 `moves_data/common.bin` | ❌ 前端下次加载自动生效 |
| 新增招式 slug | `moves.json` + `common.bin` | ❌ 前端重打包即可 |
| pokeapi 改了某特性/招式的 id | 对应 `*.json` | ✅ Rust 常量随 JSON 重生成，需 `cargo build` |
| 新增一个 WASM 特性行为（比如支持 "Rocky Payload"） | `calculator.rs`（新增 match 分支） | ✅ |
| 新增一种 WASM 关心的招式 flag | `calculator.rs`（新增位）+ `calc-engine.ts::WASM_FLAG_BITS/MOVE_FLAG` | ✅ |
| 新增天气/场地效果 | `calculator.rs::calc_weather_mod/calc_terrain_mod` + 若是新 slug 还要加进 `weathers.json`/`terrains.json` | ✅ |

## 设计动机

- **JSON 一份，两侧派生**：Rust 通过 `build.rs`、TS 通过 `import` 各自读同一份 `src/static/enums/*.json`。避免手写两份数字表漂移。
- **招式主表走 CDN**：招式量大、且随游戏版本变化，`moves_data/common.bin` 走远端 + 前端缓存，改招式数据不需要重发 WASM 或前端。
- **行为在代码里**：特性/招式 flag 触发逻辑（"iron-fist 对拳类 ×1.2"）是行为不是数据，写在 `calculator.rs` 的 match 里。pokeapi 只提供锚点 id，行为映射手工维护 —— 这是有意为之：pokemon 特性没有可枚举的"数据化行为规范"，硬要数据化就是把 DSL 塞进 JSON。
- **位掩码是 ABI**：`MOVE_FLAG_*` 位序不派生自 JSON，因为它是 Rust↔JS 内部协议，与 pokeapi flag id 空间无关。

## 相关文件速查

| 关注点 | 文件 |
| --- | --- |
| 主计算入口（JS） | `src/pages/calc/calc-engine.ts` |
| 主计算入口（Rust） | `src/infra/wasm/src/calculator.rs` |
| Rust 枚举生成器 | `src/infra/wasm/build.rs` |
| Rust 枚举生成产物 | `target/*/build/zukan-wasm-*/out/gen_enums.rs`（不入库） |
| slug→id JSON | `src/static/enums/*.json`（14 张 pokeapi 表 + 手写的 `weathers.json`/`terrains.json`）|
| 招式主表二进制 | 远端 `/assets/encrypted/fb/moves_data/common.bin` |
| FlatBuffers schema | `src/infra/wasm/schemas/moves_data_bundle.fbs`、`move_flag_pair.fbs` |
