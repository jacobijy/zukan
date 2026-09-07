# 加密资源全链路

图鉴**数据 bundle** 与**精灵图片**从后端加密到前端解密渲染的权威文档。
改加密、缓存、资源路径或图片对应之前先对照本文。出问题先按第 8 节排障清单核对。

认证/会话（DEK 获取、401 恢复、登录弹层）见 [./auth-session.md](./auth-session.md)。
缓存层级细节见 [../caching/resource-cache.md](../caching/resource-cache.md) 和
[../caching/sprite-cache.md](../caching/sprite-cache.md)。

## 0. 一句话总览

所有资源（数据 + 图片）在后端构建时用 **AES-256-GCM** 加密成统一的 **ZKDX** 格式，
运行时后端 `ServeDir` 原样分发密文（不解密），前端用 **WASM** 运行时解密。
- 数据是 **FlatBuffers bundle**（多种 fid，见第 4 节）。
- 图片是加密后的 **PNG 字节**，解密后包成 Blob URL 喂 `<image>`。
- 解密所需 **DEK** 走鉴权接口 `/api/v1/zukan/key` 下发；密文本身公开分发（加密即保护）。

## 1. ZKDX 文件格式

所有加密产物字节布局相同：

```
┌─────────┬─────────┬──────────┬──────────────────────────────┐
│ magic   │ version │  nonce   │  ciphertext + GCM tag        │
│ (4 B)   │  (1 B)  │ (12 B)   │  (N - 17 B，末尾 16B 是 tag)  │
├─────────┼─────────┼──────────┼──────────────────────────────┤
│ Z K D X │ 0x01    │ 随机 IV  │  AES-256-GCM 输出             │
└─────────┴─────────┴──────────┴──────────────────────────────┘
偏移 0     4         5          17
```

| 偏移 | 长度 | 字段 | 说明 |
|------|------|------|------|
| 0 | 4 | magic | ASCII `ZKDX` |
| 4 | 1 | version | **密文格式版本**，恒为 `1`（`FORMAT_VERSION`）。**与 `ZUKAN_DEK_VERSION` 无关**，见 1.1 |
| 5 | 12 | nonce | AES-GCM IV，每次加密随机生成，**绝不复用** |
| 17 | N−17 | ciphertext+tag | AES-256-GCM 输出，末尾 16 字节是认证标签 |

最小合法文件 33 B。常量在四处定义，**必须保持一致**：前端 `src/infra/wasm/src/crypto.rs`、
后端 `crates/wasm-crypto/src/lib.rs`、后端 `features/zukan/service.rs`（加密 CLI 共用的
`build_zkdx` 与校验都在这里）。

### 1.1 ⚠️ 两个版本号必须分清（曾踩，全站资源解不开）

名字都带 version，但**是两套独立机制，不要混**：

| | 格式版本 `FORMAT_VERSION` | 密钥/缓存版本 `ZUKAN_DEK_VERSION` |
|---|---|---|
| 值 | 恒 `1`（改动即 ZKDX 格式不兼容变更） | 由 `.env` 配置，可 bump（当前 `2`） |
| 位置 | **写进文件头第 5 字节** | **不进文件头**；经 `GET /zukan/key` 下发给客户端 |
| 作用 | 前端 WASM 硬校验，`!= 1` 抛 `ZKDX: unsupported version: N` 拒绝解密 | 派生客户端缓存 key 前缀 `fb:v{N}:` / `sprite:v{N}:` / `item-img:v{N}:` |
| 何时改 | 只有 ZKDX 二进制格式本身变了（需同步重编 WASM） | DEK 轮换**或数据内容变更**，让客户端弃用旧缓存 |

**历史事故**：两个加密 CLI 曾把 `ZUKAN_DEK_VERSION` 当格式版本写进头。`.env` 是 1 时两者
恰好相同、看不出问题；bump 成 2 后重新加密，头里成了 `version=2` → 前端 WASM 全线报
`ZKDX: unsupported version: 2`，**所有** bundle 解不开（不只是新改的那个）。
现在头字节只由 `service.rs::build_zkdx` 一处写入，并有回归单测
（`build_zkdx_writes_format_version_not_dek_version`）守着 —— 这类 bug `cargo build` 抓不到。

**数据热更新的正确做法**（不涉及格式版本、不用重编 WASM）：
1. 重新生成明文 + `make encrypt-fb` / `make encrypt`（头里仍是 `version=1`）；
2. 部署环境 `ZUKAN_DEK_VERSION` +1，让客户端缓存前缀变化、`boot.ts` 调
   `pruneOtherVersions` 清旧字节重下。

> 内容没变就不要 bump——bump 会让所有客户端弃用全部缓存重新下载。
> 本地 dev 无需 bump：两层缓存都不跨刷新（见 [../caching/resource-cache.md](../caching/resource-cache.md)）。

## 2. 后端构建管线（zukan-server）

两步：先生成明文 FlatBuffers，再批量加密成 ZKDX。

| 命令 | 脚本 | 产物 |
|------|------|------|
| `make sync-fb` | `tools/sync-fb.py` | 明文 `assets/fb/gen-N.bin`、`evolution.bin`、`moves/`、`moves_data/`、`pokemon_moves/` |
| `make sync-i18n` | `tools/sync-i18n.py` | 明文 `assets/fb/i18n/<lang>/{names,flavor}.bin`（form 名有 id 重映射，见第 7 节） |
| `python3 tools/sync-sprites.py` | `tools/sync-sprites.py` | 明文图片 `assets/public/{pokemon,items,badges,types}/...`（源/目标目录在 `tools/sync-sprites.ini` 配置，见 4.5） |
| `make encrypt-fb` | `crates/server/src/bin/encrypt-fb.rs` | `assets/encrypted-assets/fb/**`（跳过 schemas/_generated） |
| `make encrypt` | `crates/server/src/bin/encrypt-assets.rs` | `assets/encrypted-assets/**`，PNG → `.bin`，保留层级 |

CLI 算法：`nonce=random(12B)`；`ciphertext=AES-256-GCM(DEK, nonce, plaintext)`；
拼 `b"ZKDX" + FORMAT_VERSION(=1) + nonce + ciphertext`（统一走
`features/zukan/service.rs::build_zkdx`）。DEK 从 `ZUKAN_DEK`（64 hex = 32 字节），
Makefile 从 `.env` 取；`ZUKAN_DEK_VERSION` 只打印提示，**不写进文件头**（见 1.1）。

### 2.1 运行时分发（只读，不解密）

`crates/server/src/features/assets/routes.rs` 挂在**根路径**（不带 `/api/v1`，方便 CDN 回源）：

| 路由 | 目录 | 鉴权 | 缓存头 |
|------|------|------|--------|
| `GET /assets/encrypted/**` | `assets/encrypted-assets/` | ❌ 公开 | `public, max-age=31536000, immutable` |
| `GET /assets/protected/**` | `assets/protected/` | ✅ 需鉴权 | — |
| `GET /assets/**`（兜底） | `assets/public/` | ❌ 公开 | — |

三段路由**顺序敏感**：`encrypted` 在 `protected` 前，裸 `ServeDir` 兜底必须最后。

旧的鉴权数据通道 `GET /api/v1/zukan/{era}/{id}` 仍在，但前端当前全部走 `/assets/encrypted/fb/**`。

### 2.2 密钥下发

`GET /api/v1/zukan/key`（需鉴权）→ `{ "dek": "<64 hex>", "version": 1, "algorithm": "AES-256-GCM" }`。

`DekResponse` 预留可选 `cdn`（`{ sign, t, base_url, expires_in }`）给 CDN 签名。
**当前后端不下发 `cdn`**，缺席时 `buildCdnUrl()` 回退相对路径（同源）。将来接 CDN 由后端在该响应加
`cdn` 对象即可，前端下载逻辑无需改。

## 3. 前端下载与解密基础设施

```
src/services/
├── http/binaryRequest.ts   fetchBinary()：uni.request arraybuffer，网络错/5xx 重试 1 次，4xx 不重试
├── resources/cdn.ts        buildCdnUrl()：相对路径 → CDN 签名（无 token 回退相对路径）
├── infra/wasm/             initWasm() + decryptZukan() + decode*Bundle()
└── session/key.ts          getKey()：DEK 唯一入口（见 auth-session.md）
```

`fetchBinary`：跨平台 `uni.request({ responseType: 'arraybuffer' })`，**不加 `/api/v1` 前缀**；
相对路径用 `VITE_API_BASE_URL` 拼 origin；`signal.aborted` 不重试；抛 `BinaryRequestError`
带 `statusCode?` 与 `aborted`。404 = 资源不存在，403 = CDN 签名过期（上层清 key 重签重下一次）。

WASM：`initWasm()` 幂等；`decryptZukan(encrypted, dekHex)` 校验 magic → version==1 → nonce →
AES-256-GCM 解密验 tag。数据 bundle 解密后按 fid 交 `decode*Bundle()`；图片直接 `new Blob([bytes], {type:'image/png'})`。

## 4. 资源清单

### 4.1 数据 bundle（`/assets/encrypted/fb/`）

| 远端路径 | fid | 解码器 | 内容 |
|----------|-----|--------|------|
| `gen-N.bin`（N=1..9） | `PKMB` | `decodePokemonGenBundle` | 第 N 世代全物种数值快照：base/stat/type/ability/eggGroup 五张并行表 |
| `moves/vg-NN.bin` | `PMOV` | `decodePokemonVgMovesBundle` | 招式学习记录（原始行式） |
| `pokemon_moves/common.bin` | `PMSB` | `decodePokemonMovesBundle` | 招式聚合 baseline |
| `pokemon_moves/mainline/vg-NN.bin` | `PMSB` | 同上 | 相对 common 的整行覆盖（kind=1） |
| `pokemon_moves/special/vg-NN.bin` | `PMSB` | 同上 | 独立表，不合并 common（kind=2） |
| `moves_data/common.bin` | `MDAT` | `decodeMovesDataBundle` | 招式定义（moves + 4 张关联表） |
| `moves_data/vg-NN.bin` | `MDAT` | 同上 | 该版本组招式覆写（仅 moves 表） |
| `evolution.bin` | `EVO1` | `decodeEvolutionBundle`（**待前端接入**） | 全代进化树（species/edges/details），结构见 [../data/bundle-decode.md](../data/bundle-decode.md#evo1-进化树-evolutionbundle) |
| `i18n/<lang>/{names,flavor}.bin` | `PKNM`/`PKFL` | `decodeI18n*Bundle` | 单语言文本，见 [../i18n/i18n-bundle.md](../i18n/i18n-bundle.md) |

> 另：`gen-N.bin` 的 `PokemonBase` 末位新增 `hasSprite: bool`（该形态是否有正面立绘，`false` 前端可屏蔽）；字段清单见 [../data/bundle-decode.md](../data/bundle-decode.md)。

> **`gen-N.bin` 是「全物种在第 N 世代的数值快照」**（约 1351 形态 / 1025 默认形态，id 从 1 起），
> 不是「第 N 世代新增」。默认世代 9。建模与 join 见 [../data/bundle-decode.md](../data/bundle-decode.md)。

### 4.2 精灵图片（`/assets/encrypted/pokemon/`）

路径 `/assets/encrypted/pokemon/{pokemonId}/{variant}.bin`，解密后 PNG。`EncryptedSprite` 默认 `home`。

| variant | 含义 |
|---------|------|
| `home` | **默认** Pokémon HOME 立绘 |
| `home-shiny` / `home-female` | HOME 闪光 / 雌性 |
| `artwork` / `artwork-shiny` | 官方插画 |
| `front` | 图鉴像素正面图（上游 REST 的 `sprites.front_default`），**2026-09-05 起可用** |
| `shiny` / `female` | 图鉴像素闪光 / 雌性 |
| `back` | 背面像素图 |
| `dream` | Dreamworld 立绘 |
| `versions/<gen>/...` | 按世代历史美术（**前端当前不读取**） |

> ⚠️ **`front` 是新增的**：此前 sync 脚本把主正面图写成 `<id>/.png`（空 basename 的隐藏
> 文件），而加密器按扩展名过滤时 Rust 的 `Path::extension()` 对 `".png"` 返回 `None`
> （按 Unix 惯例视为隐藏文件而非 png 扩展名），导致 **1532 张正面图从未被加密下发**。
> 现已改名 `front.png` → `front.bin`，与 `back` 对称。加密器也加了「非白名单文件」
> 的显式警告，不再静默丢弃。

#### 体积对照（决定前端怎么用，实测于 encrypted-assets）

只统计**数字 id 目录**（前端只按数字 id 请求，见 4.5）：

| variant | 明文尺寸 | 命中 id 数 | 密文合计 | 密文均值 |
|---------|---------|-----------|---------|---------|
| `front` | 96×96 像素图 | 1341 | **1 MB** | **1.9 KB** |
| `home` | 512×512 渲染图 | 1336 | 159 MB | 122 KB |
| `artwork` | 475×475 官方插画 | 1339 | 162 MB | 124 KB |

**差了约 65 倍**，而列表卡只渲染 64–70px 的槽。因此前端采用**渐进式两段加载**：
进视口先拉 `front` 点亮（一屏 20 张约 38 KB），再后台换 `home`（约 2.4 MB）。
调度上 preview 走高优先级，**整屏低清全部跑完才轮到高清** —— 否则第一张卡的高清
会插到其余卡的 preview 前面，退化成「第一张先高清、其余仍黑着」。

常量收敛在 `src/constants/spriteVariants.ts`（`SPRITE_PREVIEW` / `SPRITE_FALLBACKS`），
编排在 `src/services/resources/spriteLoader.ts`，不变量见
[../caching/sprite-cache.md](../caching/sprite-cache.md)。

详情主图传 `eager`（必然可见，不懒加载）。

### 4.3 已知图片缺口与回落链

部分形态官方无 HOME 立绘。前端**不再直接落占位图**，而是按
`home → artwork → front → /static/default.png` 逐个尝试（只有 404 才继续下一个；
解密失败等真故障立即抛出，不伪装成数据缺口）。

数字 id 口径（前端只请求这些，见 4.5）缺 `home` 的共 **10 个**，8 个能回落：

| id | 形态 | home | artwork | front | 实际显示 |
|----|------|------|---------|-------|---------|
| 10080–10085 | 角色扮演皮卡丘 | ❌ | ✅ | ✅ | artwork |
| 10158 / 10159 | 搭档皮卡丘 / 搭档伊布 | ❌ | ✅ | ❌ | artwork |
| 10264 / 10268 | 故勒顿限定 / 密勒顿低电量 | ❌ | ❌ | ❌ | **占位图** |
| 10301 | （有 home 无 front） | ✅ | ✅ | ❌ | home（preview 静默跳过） |

> `10265–10267`、`10269–10271`（故勒顿/密勒顿的冲刺/游泳/滑翔等）**连资源目录都没有**，
> 与 10264/10268 同样必须占位。这 8 个正是 PKMB `hasSprite === false` 的全集。

**`hasSprite` 已接入**：`EncryptedSprite` 收到 `hasSprite === false` 时直接显示占位图，
**不发那次必然 404 的请求**（数据层判定比运行时 404 更早、更确定）。字段缺席按「可能有」
处理，仍走回落链。调用点：`PokemonCard`、`SpecimenHero`；`EvolutionNode` 的
`EvolutionStage` 无此字段，靠回落链兜。

404 不算解密失败：单独打 `[EncryptedSprite] 无资源`（warn），真失败才 `解密失败`（error）。

**回落结果会按资源版本缓存在本地**（`spriteAvailability.ts`，全平台的 uni storage，
key `zukan_sprite_avail`）：上表这 9 个偏离默认的 id 第二次刷新起直接从对的 variant 开始，
不再重演 404。只记偏差（今天约 9 条 / <1 KB），不记正常命中；记录只是提示，
按记录直取仍 404 就丢弃记录、回到完整链 —— 否则资源补齐了前端也不会再去看。
不变量见 [../caching/sprite-cache.md](../caching/sprite-cache.md)「可用性记录」。

### 4.4 前端请求不到的密文（体积治理）

`encrypted-assets/pokemon/` 下有两类产物**没有任何前端调用路径**，排查体积时别误判：

| 类型 | 数量 | 体积 | 为什么取不到 |
|------|------|------|-------------|
| 非数字目录（`201-a`、`869-vanilla-cream-*`、`egg`、`substitute`…） | 332 | 88 MB | 前端一律按**数字 pokemon id** 请求，slug 目录永远不会被拼出来 |
| 各 id 下的 `versions/<gen>/...` | — | 330 MB | 按世代历史美术，前端当前不读取（见 4.2 表末行） |

合计约 **418 MB**。核对命令：

```bash
cd assets/encrypted-assets/pokemon
# 非数字目录
ls -d */ | sed 's#/##' | grep -vE '^[0-9]+$' | wc -l
# versions 占用
du -sch */versions 2>/dev/null | tail -1
```

要不要清由部署侧决定（留着不影响正确性，只占磁盘与镜像体积）；
若将来接 CDN，这部分不值得回源预热。

### 4.5 道具 / 徽章 / 属性图标（`/assets/encrypted/{items,badges,types}/`）

除精灵立绘外，`make encrypt` 同样加密三类静态图标，解密后都是 PNG、用法与精灵图一致
（拿密文 → WASM 解密 → Blob URL 喂 `<image>`）：

| 资源 | 远端路径 | 文件名 id | 数量 | id 含义 |
|------|----------|-----------|------|---------|
| 道具 | `/assets/encrypted/items/{itemId}.bin` | **PokeAPI item id** | 1093 | `items.csv` 的 `id`（数字），**不是**道具英文名 |
| 徽章 | `/assets/encrypted/badges/{n}.bin` | 道馆徽章序号 | 77 | poke-sprites 源文件名（1 起） |
| 属性 | `/assets/encrypted/types/{typeId}.bin` | **PokeAPI type id** | 19 | `types` 表 id（1–19，朱紫图标） |

**道具 id 映射（重点）**：上游 poke-sprites 用英文 slug 命名（`master-ball.png`、
`choice-scarf.png`…），后端 `tools/sync-sprites.py` 在 sync 阶段读 **`items.csv`**
（`id,identifier,...`）把 `<identifier>.png` 重命名为 `<id>.png`，再加密成 `<id>.bin`。
前端要用某个道具，直接按 **PokeAPI item id** 请求 `items/{id}.bin` 即可，无需 slug 映射。

- 道具**只加密有精灵图的**：`items.csv` 共约 2221 个道具，其中 **1093** 个能取到图；
  其余 1128 个（多数剧情/钥匙道具）无图，**不产出**，请求会 **404**，前端回落中性占位盒
  （道具无 variant，故没有 4.3 那样的回落链）。
- **技能机 / 秘传机（2026-09-05 起纳入）**：`tm01`..`tm100` 等共 238 个编号道具，源仓库
  没有逐编号的图，统一回落到通用图 `tm-normal.png` / `hm-normal.png`，因此这批 id
  **有图可取但图案相同**（只是一个"技能机"图标，不区分招式）。前端若要区分具体招式，
  需自行叠加招式属性色/文字，不能指望图片本身。
  - 例外：源里存在 `hm01.png`..`hm07.png` **七张独立秘传机图**，这 7 个 id（397–403）
    用各自的图；只有 `hm08`(404) 回落通用图。所以实际回落通用图的是 **231** 个而非 238。
  - `tm-case`(550) / `tmv-pass`(744) 有各自独立的图，不受归一化影响（正则要求 `tm`/`hm`
    后紧跟数字）。
  - ⚠️ 源里 `tm-normal.png` 与 `hm-normal.png` **内容完全相同**，故 `hm08` 与所有 tm
    拿到的是同一张图。
  - 与上游 PokeAPI 的差异：上游 `build.py` 无条件把 `^tm[0-9]`/`^hm[0-9]` 全归一化到通用图，
    会连 hm01–hm07 的独立图一起丢掉；本仓库**优先用独立图**，仅在缺图时才回落。
- 徽章/属性文件名在 sync 时保持源文件名不变（属性源本就按 type id 命名）。

> ⚠️ **历史坑**：道具早期用一张手写白名单重命名，其数字 key **不是** PokeAPI 真实 item id
> （旧表 `1=pretty-wing`，实际 `pretty-wing` 是 612、`1` 是 `master-ball`）。现已改为 `items.csv`
> 真实 id。若本地缓存里有旧编号道具图，属错误命名，清缓存即可。

## 5. 三套 id 空间

图/数据排查核心，详见 [../data/bundle-decode.md](../data/bundle-decode.md)。一句话：
- sprite 请求与 PKMB `baseEntries[].id` 用 **pokemon id**；
- 物种名/分类/蛋组/世代用 **species id**；
- PKNM 形态表主键是 **pokemon_forms id**，后端打包时重映射成 pokemon id（否则非默认形态名错位）。

## 6. 排障清单

### 6.1 图裂 / 显示默认图
1. Network 看请求的 pokemon id、variant。**渐进式加载下一张卡有两个请求**：
   先 `front`（preview，约 2 KB）再 `home`（高清）；只看到 front 说明高清还在跑或全 404。
2. 状态码：**404** → 对照 4.3 缺口表；不在表里且整条链（home/artwork/front）都 404，
   查 `encrypt-assets` 是否跑过。**403** → CDN 签名过期（自动清 key 重签重下一次）；
   **200 但解密抛错** → 见 6.2。
3. 控制台 `无资源` = 整条回落链都 404，正常；`解密失败` = 真错误。
   注意 preview 的 404 是**静默**的（不打日志），如 10301 无 front —— 不是 bug。
4. 快滑时闪骨架 = 离屏取消 + 进视口重下，正常。
5. 先出低清、随后变清晰 = 渐进式两段加载的预期行为，不是缓存错乱。
6. 该形态直接显示占位图且**一个请求都没发** → `hasSprite === false`（数据层判定），
   见 4.3；确认 `gen-N.bin` 里该 id 的标记是否符合预期。

### 6.2 解密失败 / invalid magic / unsupported version / tag 失败
- `invalid magic` → 拿到的不是 ZKDX（HTML 404 页、未加密明文 FB、JSON 错误体）。查远端路径。
- `unsupported version: N` → 头第 5 字节 ≠ 前端 `FORMAT_VERSION`(=1)。**最常见原因是加密时
  把 `ZUKAN_DEK_VERSION` 误写进头**（见 1.1 的历史事故）。核查方式：
  `head -c5 <文件> | xxd` 应为 `5a4b4458 01`；批量核查
  `find assets/encrypted-assets -name '*.bin' | while read f; do head -c5 "$f" | tail -c1 | xxd -p; done | sort | uniq -c`
  应只有 `01`。修法是修加密器后**重新加密全部产物**（坏文件无法就地修补）。
- GCM tag 失败 → DEK 与密文不匹配或字节损坏。确认 `ZUKAN_DEK` 一致；删本地缓存重下
  （resourceManager 自动删持久字节重试一次；sprite 走 `dropSpriteBytes`）。
- 解码抛 `unknown fid` → 解密成功但 FlatBuffers 头不是预期 fid，路径对错了 bundle。

### 6.3 改了数据/图片，浏览器不刷新
前端 cache-first 且资源 `immutable`。
- **本地 dev**：两层缓存都已关掉（应用缓存走内存、URL 带 `_dc` 绕开 HTTP 缓存），
  普通刷新即拉新；不用 bump 版本号，也不用清站点数据。见
  [../caching/resource-cache.md](../caching/resource-cache.md)。
- **线上强制全量**：重加密（头仍 `version=1`）+ 部署环境 `ZUKAN_DEK_VERSION` +1。
  **不需要**动 `FORMAT_VERSION` / 重编 WASM —— 那是格式变更才做的事（1.1）。

### 6.4 形态名不对 / 显示 form-{id}
- 非默认形态名错位 → 查 `sync-i18n.py::load_form_pokemon_map` 重映射是否还在。
- 全是 `form-{id}` → PKNM 没加载/加载失败，看 i18n store / Network；重生成 names.bin 后按 6.3 清缓存。
- 默认形态名是 `pokemon-{id}` → species 名没查到（PKNM species 表）。

### 6.5 DEK / 登录
所有解密失败 + 弹登录窗 → 401 恢复在 `getKey()`；用户关弹窗抛 `LoginDismissedError`，静默降级是预期。
并发只弹一个登录窗 → 靠 `authGate` 模块单例。

## 7. 改动检查清单

| 改动 | 必须同步 |
|------|----------|
| ZKDX 格式 / 加算法 | 常量三处（前端 crypto.rs、后端 wasm-crypto、后端 zukan/service.rs）+ `build_zkdx`；`FORMAT_VERSION` 同步升级并重编 WASM；本文第 1、1.1 节 |
| 重新加密资源（内容变更） | 决定是否 bump `ZUKAN_DEK_VERSION`（仅缓存信号，**不进文件头**）；勿动 `FORMAT_VERSION`（1.1 / 6.3） |
| 新增 FB bundle 类型 | ① schema + flatc 重生成 ② sync-*.py 打包 ③ WASM convert.rs 加解码器 + index.ts 导出 ④ resourceManager 加 spec/getter/prefetch ⑤ 本文 4.1 |
| 新增 sprite variant | ① encrypt-assets 产物 ② `EncryptedSprite` variant 传值 ③ 缺失兜底 ④ 若要进 preview / 回落链，改 `src/constants/spriteVariants.ts`（**唯一定义处**，别在组件里各写一份）并跑 `tests/spriteVariants.spec.ts` ⑤ 本文 4.2 / 4.3 |
| 改道具图 / 道具 id 映射 | ① `tools/sync-sprites.py`（读 `items.csv` 真实 id，`sprite_slug()` 决定回落规则）② 重跑 `sync-sprites.py` + `make encrypt` ③ **加密是增量、且靠 mtime 判定**：`copy_items()` 会 rmtree 明文目录，但**加密侧不清场**；而 `shutil.copy2` 保留源 mtime，改了映射后新明文可能比旧密文还"旧"而被跳过，导致残留旧图。改映射后须手动删掉受影响的 `encrypted-assets/items/*.bin` 再重建 ④ 本文 4.5 |
| 改 form / 名称映射 | sync-i18n.py 重映射；重打包 PKNM 重加密；清缓存 |
| 改缓存调度 / 引用计数 | 跑 `pnpm test`（spriteCache/spritePersist）；别破坏 caching 文档里的不变量 |
| 补齐某个 id 的立绘资源 | 无需前端改动：本地可用性记录只在按记录直取仍 404 时才生效并自动丢弃；版本号 bump 后整表失效 |
| 接 CDN 签名 | 后端 `/zukan/key` 响应加 `cdn` 对象；前端 `buildCdnUrl` 已就绪 |

每次改完必跑：`pnpm type-check`、`pnpm test`、`pnpm dev:h5` 移动端 UA curl 改动页确认 200；
动了 scoped CSS / CSS 变量绑定额外拉编译产物核对。

## 8. 关键文件索引

**前端**：`src/infra/wasm/src/crypto.rs`、`src/infra/wasm/index.ts`、
`src/services/http/binaryRequest.ts`、`src/services/resources/cdn.ts`、
`src/services/session/{key,authGate}.ts`、`src/services/resources/{resourceManager,dataVersion,spriteCache,spritePersist}.ts`、
`src/services/resources/spriteLoader.ts`（preview + 回落链编排）、
`src/services/resources/spriteAvailability.ts`（回落落点的按版本本地记录）、
`src/constants/spriteVariants.ts`（variant 常量唯一定义处）、
`src/composables/useEncryptedImage.ts`、
`src/infra/storage/binaryStorage.ts`、`src/services/pokemon/pokemon.ts`、
`src/components/sprite/EncryptedSprite.vue`、`src/services/boot.ts`。

**后端（zukan-server）**：加密 CLI `encrypt-fb.rs`/`encrypt-assets.rs`、
`crates/wasm-crypto/src/lib.rs`、`features/assets/routes.rs`、
`features/zukan/{handler,service,dto}.rs`、`config.rs`、`tools/sync-{fb,i18n}.py`。
