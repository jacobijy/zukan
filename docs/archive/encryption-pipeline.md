# 加密资源全链路：构建 · 分发 · 解密 · 图片对应

> 这是图鉴**数据 bundle**与**精灵图片**从后端加密到前端解密渲染的权威文档。
> 改加密、缓存、资源路径或图片对应之前**先对照本文**，确认改的是哪一层、版本号要不要动、
> 缓存会不会失效。出问题也先按第 8 节排障清单逐项核对，再动代码。
>
> 取代旧文档中关于加密的实现细节：[`encryption.md`](./encryption.md)（方案稿，部分过时）、
> [`zukan-decryption.md`](./zukan-decryption.md)（解密流程，部分过时）。那两份只保留历史背景。

---

## 0. 一句话总览

所有资源（数据 + 图片）在后端构建时用 **AES-256-GCM** 加密成统一的 **ZKDX** 格式，
运行时由后端 `ServeDir` 原样分发密文（不解密），前端用 **WASM** 运行时解密。
- 数据是 **FlatBuffers bundle**（多种 fid，见第 4 节）。
- 图片是加密后的 **PNG 字节**，解密后包成 Blob URL 喂 `<image>`。
- 解密所需的 **DEK** 走鉴权接口 `/api/v1/zukan/key` 下发；密文本身公开分发（加密即保护）。

```
构建时（zukan-server）            运行时（后端只读分发）         前端（浏览器 / 小程序）
─────────────────────            ────────────────────         ─────────────────────
PokeAPI CSV / 原图
   │ python tools/sync-*.py
   ▼
assets/fb/**/*.bin (明文 FB)  ─┐
                               ├─ encrypt-fb / encrypt-assets ──► assets/encrypted-assets/**/*.bin (ZKDX)
assets/public/**/*.png (原图)─┘                                      │
                                                                     │ ServeDir (不解密)
                                                                     ▼
                                              /assets/encrypted/fb/**  (数据 bundle)
                                              /assets/encrypted/pokemon/{id}/{variant}.bin (图)
                                                                     │
                                              /api/v1/zukan/key ──► DEK + version
                                                                     │ WASM decryptZukan()
                                                                     ▼
                                                          FlatBuffers 解码 / Blob URL → <image>
```

---

## 1. ZKDX 文件格式

所有加密产物（无 论是 FB bundle 还是图片）字节布局完全相同：

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
| 0 | 4 | magic | ASCII `ZKDX`（`5A 4B 44 58`），文件类型标识 |
| 4 | 1 | version | **DEK/格式版本号**，当前恒为 `1`，由 `ZUKAN_DEK_VERSION` 写入 |
| 5 | 12 | nonce | AES-GCM IV，每次加密随机生成，**绝不复用** |
| 17 | N−17 | ciphertext+tag | AES-256-GCM 输出，末尾 16 字节是认证标签 |

最小合法文件：`5 + 12 + 16 = 33 B`。

常量在四处定义，**必须保持一致**：

| 常量 | 前端 `src/infra/wasm/src/crypto.rs` | 后端 `crates/wasm-crypto/src/lib.rs` | 后端 CLI |
|------|---|---|---|
| MAGIC | `b"ZKDX"` | `b"ZKDX"` | `b"ZKDX"` |
| VERSION | `FORMAT_VERSION = 1` | `1` | `$ZUKAN_DEK_VERSION`（默认 1） |
| NONCE_SIZE | 12 | 12 | 12 |
| TAG_SIZE | 16 | 16 | 16（aes-gcm 内置） |
| HEADER_SIZE | 5 | 5 | 5 |

### 1.1 ⚠️ version 字节的两个身份（最容易踩的坑）

`version` 这一个字节同时被两套机制使用，当前值都是 `1`，但语义不同：

1. **解密侧硬校验**：前端 `crypto.rs::decrypt_zukan` 读到 `version != FORMAT_VERSION`（=1）直接
   抛 `ZKDX: unsupported version: N`，**拒绝解密**。
2. **缓存侧版本键**：前端把 `/zukan/key` 返回的 `version` 写进本地存储（`zukan_data_version`），
   所有密文缓存 key 都带前缀 `fb:v{N}:`（数据）和 `sprite:v{N}:`（图片）。版本变化时
   `boot.ts` 调 `resourceManager.pruneOtherVersions(newVersion)` 清掉旧前缀的字节。

**后果**：如果只重新加密资源（修了数据/换了图）但**不 bump `ZUKAN_DEK_VERSION`**，
version 字节仍是 1、缓存前缀仍是 `fb:v1:`，而前端是 **cache-first**（见第 6 节），
浏览器会一直命中旧缓存，**永远不重下**。本地验证必须手动清 IndexedDB / Site Data。

**要强制所有客户端拉新字节，必须同时做三件事**（缺一不可）：
1. 后端 `ZUKAN_DEK_VERSION` 改成 `2`（新 DEK 或仅做版本号都行）；
2. 用新 DEK + version=2 重加密全部产物（`make encrypt-fb` / `make encrypt`）；
3. **前端 `FORMAT_VERSION` 升到 2 并重编 WASM**（`src/infra/wasm/`），否则旧 WASM 拒绝解 version=2。

> 即：当前架构下「数据热更新」和「DEK 轮换」是同一个开关。只换资源内容而不动密钥，
> 没有轻量的缓存击穿手段（CDN 的 `immutable` 头也会缓存旧 URL）。这是已知取舍。

---

## 2. 后端构建管线

仓库：`zukan-server/`。两步：先生成**明文** FlatBuffers，再批量加密成 ZKDX。

### 2.1 生成明文 bundle

| 命令 | 脚本 | 产物（明文，未加密） |
|------|------|------|
| `make sync-fb` | `tools/sync-fb.py` | `assets/fb/gen-N.bin`、`moves/`、`moves_data/`、`pokemon_moves/`（PKMB/PMOV/PMSB/MDAT） |
| `make sync-i18n` | `tools/sync-i18n.py` | `assets/fb/i18n/<lang>/names.bin`（PKNM）、`flavor.bin`（PKFL） |

脚本读 `tmp/csv/*.csv`（从 PokeAPI 同步的关系表），用 `flatc` 生成的 Python 绑定打包。
明文 bundle 头部带 4 字节 fid（`PKMB`/`PKNM`/…），解密后 WASM 按 fid 分派解码器。

> `sync-i18n.py` 构建 **form 名称表**时有一次关键的 id 重映射，详见第 7.2 节。

### 2.2 加密成 ZKDX

| 命令 | 二进制 | 输入 | 输出 |
|------|--------|------|------|
| `make encrypt-fb` | `crates/server/src/bin/encrypt-fb.rs` | `assets/fb/**/*.bin`（跳过 `schemas/`、`_generated/`） | `assets/encrypted-assets/fb/**`，保留层级 |
| `make encrypt` | `crates/server/src/bin/encrypt-assets.rs` | `assets/public/**/*.png` | `assets/encrypted-assets/**`，扩展名 `.png→.bin`，保留层级 |

两个 CLI 算法一致：
```
nonce = random(12B)
ciphertext = AES-256-GCM(key=DEK, nonce, plaintext)   // 含 16B tag
zkdx = b"ZKDX" + push(VERSION) + nonce + ciphertext
```
DEK 从环境变量读：`ZUKAN_DEK`（64 hex 字符 = 32 字节），版本从 `ZUKAN_DEK_VERSION`（缺省 1）。
Makefile 自动从 `.env` 取这两个值。

### 2.3 运行时分发（只读，不解密）

`crates/server/src/features/assets/routes.rs` 把目录挂在**根路径**（不带 `/api/v1`，方便 CDN 回源）：

| 路由 | 目录 | 鉴权 | 缓存头 |
|------|------|------|--------|
| `GET /assets/encrypted/**` | `assets/encrypted-assets/` | ❌ 公开 | `public, max-age=31536000, immutable` |
| `GET /assets/protected/**` | `assets/protected/` | ✅ 需鉴权 | — |
| `GET /assets/**`（兜底） | `assets/public/` | ❌ 公开 | — |

> 三段路由**顺序敏感**：`encrypted` 必须在 `protected` 前，最外层裸 `ServeDir` 必须最后，
> 否则兜底会吃掉前两段。

数据 bundle 的另一条（旧）鉴权通道 `GET /api/v1/zukan/{era}/{id}` 仍在 `features/zukan/`，
但前端当前**全部走 `/assets/encrypted/fb/**` 公开路径**，不经此接口。

### 2.4 密钥下发

`GET /api/v1/zukan/key`（需鉴权）→ `features/zukan/handler.rs::get_key`：

```json
{ "dek": "<64 hex chars>", "version": 1, "algorithm": "AES-256-GCM" }
```

> 前端 `DekResponse` 类型还预留了可选字段 `cdn`（`{ sign, t, base_url, expires_in }`），
> 用于给资源 URL 加 CDN 签名。**当前后端不下发 `cdn`**，缺席时 `buildCdnUrl()` 回退到
> 相对路径（同源 origin）。将来接 CDN 时由后端在这个响应里加 `cdn` 对象即可，前端无需改下载逻辑。

---

## 3. 密钥与会话（前端）

唯一入口：`src/services/session/key.ts::getKey()`，全 app 共 3 个调用点
（`boot.ts`、`resourceManager`、`spriteCache`，403 重试时各再调一次）。

- **内存缓存 + 并发去重**：`keyCache` 命中直接返回；并发调用共享同一个 `keyPromise`。
- **401 恢复**集中在这里，不散在调用点：
  ```
  401 UNAUTHENTICATED
    ├─ 有 refresh token → authApi.refresh() → 重试
    │     └─ refresh 也失败 → clearSession() → 弹登录层
    └─ 无 refresh token → 弹登录层 → 登录后重试
  ```
- 用户关闭登录层抛 `LoginDismissedError`，调用方**静默降级**（不重试、不报错）。
- `authGate` 是**模块级单例**（不是 Pinia store），避免 6 个调用点各弹一个登录窗。
- `clearKeyCache()` 在登出 / DEK 轮换 / CDN 403 重签路径调用。

> 循环依赖：`key.ts` 用**动态 import** 引 `api/auth.ts`，避免 `session ⇄ api` 顶层环。

---

## 4. 资源清单与路径对照

### 4.1 FlatBuffers 数据 bundle（`/assets/encrypted/fb/`）

| 远端路径 | fid | 解码器（`src/infra/wasm/index.ts`） | 内容 |
|----------|-----|------|------|
| `gen-N.bin`（N=1..9） | `PKMB` | `decodePokemonGenBundle` | 第 N 世代全物种数值快照：base/stat/type/ability/eggGroup 五张并行表 |
| `moves/vg-NN.bin` | `PMOV` | `decodePokemonVgMovesBundle` | 招式学习记录（原始行式） |
| `pokemon_moves/common.bin` | `PMSB` | `decodePokemonMovesBundle` | 招式聚合表（baseline） |
| `pokemon_moves/mainline/vg-NN.bin` | `PMSB` | 同上 | 主线相对 common 的整行覆盖（kind=1） |
| `pokemon_moves/special/vg-NN.bin` | `PMSB` | 同上 | 独立表，不合并 common（kind=2） |
| `moves_data/common.bin` | `MDAT` | `decodeMovesDataBundle` | 招式定义（moves + 4 张关联表） |
| `moves_data/vg-NN.bin` | `MDAT` | 同上 | 该版本组的招式覆写（仅 `moves` 表） |
| `i18n/<lang>/names.bin` | `PKNM` | `decodeI18nNamesBundle` | 单语言短文本：物种名/形态名/技能/属性/特性/蛋组/地点等 |
| `i18n/<lang>/flavor.bin` | `PKFL` | `decodeI18nFlavorBundle` | 单语言长文本：图鉴描述/招式效果/特性描述（字符串池已在 Rust 侧内联） |

`<lang>` 共 14 种：`cs de en es es-419 fr it ja ja-hrkt ja-roma ko pt-br zh-hans zh-hant`。

> **gen-N.bin 是「全物种在第 N 世代的数值快照」**（约 1351 条形态 / 1025 个默认形态，id 从 1 起），
> 不是「第 N 世代新增的宝可梦」。默认世代是 9（`boot.ts::LATEST_GEN_ID`、store 里 `DEFAULT_GEN_ID=9`）。

### 4.2 精灵图片（`/assets/encrypted/pokemon/`）

路径：`/assets/encrypted/pokemon/{pokemonId}/{variant}.bin`，解密后是 PNG。

一个完整形态目录（以皮卡丘 id=25 为例）含的 variant：

| variant 文件 | 含义 |
|------|------|
| `home.bin` | **默认**，Pokémon HOME 立绘（前端 `EncryptedSprite` 默认 variant） |
| `home-shiny.bin` / `home-female.bin` | HOME 闪光 / 雌性 |
| `artwork.bin` / `artwork-shiny.bin` | 官方插画 |
| `shiny.bin` / `female.bin` | 图鉴像素闪光 / 雌性 |
| `back.bin` | 背面像素图 |
| `dream.bin` | Dreamworld 立绘 |
| `versions/<gen>/...` | 按世代的历史美术（**前端当前不读取**，grep `versions` 无引用） |

前端默认请求 `home.bin`；列表卡片和详情主图都用 `variant="home"`（详情主图 `eager`）。

### 4.3 已知图片缺口（会 404，正常）

部分形态官方没有 HOME 立绘，PokeAPI 无图源，服务端也就没有对应文件。
前端对 404 已回退 `/static/default.png`（见 `EncryptedSprite.vue` catch，
404 单独打 `[EncryptedSprite] 无立绘资源`，不再误报「解密失败」）。

在 1351 个 pokemon id 中，`home.bin` 缺失的有 16 个：

| 类型 | id | 形态 |
|------|----|------|
| 无任何目录 | 10265–10267 | 故勒顿 冲刺/游泳/滑翔形态 |
| 无任何目录 | 10269–10271 | 密勒顿 驱动/水上/滑翔形态 |
| 有目录但无 `home.bin`（也无 artwork） | 10264 / 10268 | 故勒顿限定 / 密勒顿低电量 |
| 有目录但无 `home.bin`（**有 artwork**） | 10080–10085 | 角色扮演皮卡丘（摇滚/贵妇/偶像/博士/摔跤/换装） |
| 有目录但无 `home.bin`（**有 artwork**） | 10158 / 10159 | 搭档皮卡丘 / 搭档伊布 |

> 想要让无 `home.bin` 的形态回退到 `artwork.bin` 而不是默认占位，需要在数据层
> 加「形态→可回退 variant」判断，再让 `EncryptedSprite` 按顺序尝试。目前未实现。

---

## 5. 前端下载与解密基础设施

```
src/services/
├── http/binaryRequest.ts   fetchBinary()：uni.request arraybuffer，网络错/5xx 重试 1 次，4xx 不重试
├── resources/cdn.ts        buildCdnUrl()：相对路径 → CDN 签名 URL（无 cdn token 时回退相对路径）
├── infra/wasm/             initWasm() + decryptZukan() + decode*Bundle()
└── session/key.ts          getKey()：DEK 唯一入口
```

### 5.1 `fetchBinary`（`http/binaryRequest.ts`）

- 跨平台用 `uni.request({ responseType: 'arraybuffer' })`，**不加 `/api/v1` 前缀**
  （资源刻意留在根路径，接 CDN 不随 API 版本变）。
- 相对路径用 `VITE_API_BASE_URL`（`.env.development` 默认 `http://localhost:8080`）拼 origin。
- 重试：网络错（无 statusCode）或 5xx 重试 1 次；4xx 直接抛；`signal.aborted` 不重试。
- 抛 `BinaryRequestError`，带 `statusCode?` 与 `aborted: boolean`。
  - 404 = 资源不存在（缺图，见 4.3）；403 = CDN 签名过期，上层清 key 重签重下一次。

### 5.2 WASM 解密（`infra/wasm/`）

- `initWasm()` 幂等，动态 import `pkg/zukan_wasm` 并实例化。
- `decryptZukan(encrypted: Uint8Array, dekHex: string): Uint8Array`
  校验 magic → 校验 version==1 → 取 nonce → AES-256-GCM 解密并验 tag。
- 数据 bundle 解密后再交给对应的 `decode*Bundle()`（按 FlatBuffers fid 分派）。
- 图片解密后直接 `new Blob([bytes], { type: 'image/png' })` → `URL.createObjectURL`。

---

## 6. 前端缓存层级

两类资源各有独立缓存，但**共用同一个版本号前缀**（保证 DEK 轮换时一起失效）。

### 6.1 数据 bundle：`resourceManager.ts`

加载链：`memory LRU(12) → inflight 去重 → binaryStorage(IDB/MP) → 网络 → 解密 → 解码`。

- `cacheKey = fb:v{version}:<kind>:<...>`，例如 `fb:v1:gen:9`、`fb:v1:i18n:names:zh-hans`。
- 内存 LRU 上限 12 条（bundle 体积大，保守）。
- **inflight 去重**：同一 key 并发请求只发一次网络。
- 二进制持久层 `binaryStorage`：
  - H5 → IndexedDB（DB `zukan-fb`，store `blobs`，key=string，value=Uint8Array）；
  - 小程序 → `uni.setStorage`（base64 桥接，受约 1MB/key、10MB 总量限制，quota 错静默）。
- **失败重试一次**：解密/解码失败（DEK 轮换 / schema drift）会删掉该 key 的持久字节，重下重解一次。
- `prefetch*` 方法与 `get*` 共享 inflight，错误静默（fire-and-forget）。

### 6.2 图片：`spriteCache.ts`（内存，模块级共享）

> 历史教训：这套曾写在 `EncryptedSprite.vue` 的 `<script setup>` 顶层，编译后落在
> `setup()` 内部 → **每实例一份空 Map**，命中率恒为 0、Blob URL 永不 revoke。
> 跨实例共享的状态（缓存/连接池/引用计数）**必须放独立 `.ts` 模块**。

- key = `${pokemonId}/${variant}`，值是 `{ url, refs }`。
- **引用计数**：`acquireSprite` refs++，`releaseSprite` refs--。同一只可能被列表+详情同时引用，
  归零才允许 LRU 淘汰（淘汰即 `revokeObjectURL`，在屏的图 refs>0 不会被撤）。
- LRU 上限 200（约 20–30 MB）。
- **下载调度三条不变量**（别改坏）：
  1. **限流 4 并发**（H5 单域 6 连接，留余量给 FB bundle；解密是主线程 WASM）。
  2. **批内 FIFO，批间 LIFO**：`batch` 每帧自增，出队选 batch 最大、同批 seq 最小 ——
     首屏自上而下顺出，滑动新进视口的抢旧批之前。纯 LIFO 会让首屏从下往上冒。
  3. **离屏取消**：IntersectionObserver 非一次性，滑出视口 abort 在途请求腾槽位；
     多 waiter 时只有 waiters 归零才真取消（列表卸载不能连累详情页同一只）。
- 取消抛 `SpriteAbortError`，`EncryptedSprite` 据此保持骨架屏（不显示默认图），等下次进视口重来。

### 6.3 图片：`spritePersist.ts`（跨刷新，IDB 密文）

`spriteCache` 只有内存，刷新即清空；本模块加一层持久化，链变成
`内存 Blob URL → IDB 密文 → 网络`。**四条不变量**：

1. **落盘的是 ZKDX 密文，不是解密后的 PNG** —— 否则等于把加密资源以明文留在用户磁盘。
2. **只在 `storageBackend === 'idb'`（H5）启用**；小程序 `uni.setStorage` 约 10MB，
   塞 sprite 会把 FB 主数据顶出配额。非 IDB 后端全模块 no-op。
3. **索引（localStorage）与数据（IDB）是两条独立写入，必然短暂不一致**，双向自愈：
   - 索引有/数据无 → 按 miss 走网络并删幽灵索引项；
   - 数据有/索引无 → 开局 `reconcile()` 对账删孤儿。
4. **`clearSpriteCache()`（登出）不清磁盘** —— 密文没 DEK 解不开，不构成泄露，留着下次登录命中。
   版本升级清盘走 `pruneSpriteVersions`（由 `resourceManager.pruneOtherVersions` 调用）。

预算 60 MB（约 460 张），按插入序 FIFO 淘汰（LRU 每次命中要回写索引，多一次 IDB 往返，不值）。
索引 key `zukan_sprite_index`，落盘带 500ms 防抖。

### 6.4 版本失效总览

| 缓存 | key 前缀 | 持久化 | 失效时机 |
|------|----------|--------|----------|
| FB 解码结果（内存 LRU） | — | 否 | `pruneOtherVersions` 清空；LRU 淘汰 |
| FB 密文（binaryStorage） | `fb:v{N}:` | IDB / MP storage | 版本变化 → `pruneOtherVersions(newV)` 删旧前缀 |
| sprite Blob URL（内存 LRU） | `${id}/${variant}` | 否 | 刷新清空；`clearSpriteCache()`；LRU |
| sprite 密文（IDB） | `sprite:v{N}:` | IDB（仅 H5） | 版本变化 → `pruneSpriteVersions(newV)`；登出不清 |
| DEK（内存） | — | 否 | `clearKeyCache()`（登出 / 轮换 / 403 重签） |

版本号来源：`GET /zukan/key` 的 `version` → `boot.ts` 写 `zukan_data_version` storage
→ `currentDataVersion()` 派生所有 key 前缀。

---

## 7. 图片 / 数据的 id 对应关系（核心）

这是排查「图不对」「形态名不对」「404」的关键。PokeAPI 有三套容易混淆的 id：

### 7.1 三个 id 空间

| id 字段 | 来源表 | 含义 | 前端用途 |
|---------|--------|------|----------|
| **pokemon id** | `pokemon.csv` | 一条「可战斗个体」，默认形态 + 所有非默认形态各占一个 | **sprite 请求用这个**；PKMB `baseEntries[].id` 也是这个 |
| **species id** | `pokemon_species.csv` | 物种（全国图鉴编号），一个物种有多个形态 | 查物种名/分类/蛋组：`speciesName(speciesId)` |
| **pokemon_forms id** | `pokemon_forms.csv` | 形态行，**独立自增 id 空间**，默认形态下等于 pokemon id，非默认形态**不等于** | PKNM 形态表的主键 |

**关键：pokemon id 和 pokemon_forms id 是两个不同的自增空间**，非默认形态对不上。举例：

| 形态 | pokemon id（`pokemon.csv`） | pokemon_forms id（`pokemon_forms.csv`） |
|------|---------------------------|------------------------------------------|
| deoxys-speed | 10003 | 10033 |
| venusaur-mega | 10033 | 10133 |
| gourgeist-large | 10031 | 10130 |
| miraidon-drive-mode | **10269** | （另一个值，且 mothim-sandy 这种别的形态也占用附近号段） |

### 7.2 form 名称的 id 重映射（`sync-i18n.py`）

前端 `pokemon.ts` 用 **pokemon id** 查形态名：`names.form(b.id)`（见 `mergeBundleToModel`，
`b.id` 是 pokemon id）。但 PokeAPI 的 `pokemon_form_names` 表主键是 **pokemon_forms id**。
直接打包会导致所有非默认形态名错位。

`sync-i18n.py` 在构建 PKNM 时用 `load_form_pokemon_map()` 做重映射：
- 扫 `pokemon_forms.csv`，对每个 **pokemon_id** 取其 `is_default=1` 的那一行的 form id
  （每个 pokemon 恰好一条 default form）；
- 建立 `form_id → pokemon_id` 映射；
- 打包 form 名称时，把主键从 `form_id` 改写成 `pokemon_id`，跳过无法映射的装饰性形态
  （如 unknown 字母）和重复。

这样前端用 pokemon id 就能查到形态名。**默认形态 form_id == pokemon_id，从来没坏过；
坏的是非默认形态。** 改这张表时务必保留重映射，否则形态名会整体错位。

### 7.2 数据 join（`pokemon.ts::mergeBundleToModel`）

PKMB 是五张**并行表**，按 pokemon id join：
- `baseEntries`（id, speciesId, isDefault, height, weight）
- `statEntries`（id, hp/attack/defense/specialAttack/specialDefense/speed）
- `typeEntries`（id, type1Id, type2Id）
- `abilityEntries`（id, ability1Id, ability2Id, abilityHiddenId）
- `eggGroupEntries`（id, eggGroup1Id, eggGroup2Id）

名称通过 `NameResolvers` 注入（species/genus/form/ability/eggGroup），底层查 PKNM bundle：
- `species(b.speciesId)` → 物种名
- `genus(b.speciesId)` → 分类（「种子宝可梦」）
- `form(b.id)` → 形态名（注意是 pokemon id，见 7.2）
- `ability(abilityId)` / `eggGroup(eggGroupId)` → 特性名 / 蛋组名

i18n 未就绪时各字段回退占位符（`pokemon-{id}` / `form-{id}` / 数字 id），
i18n 加载完成后 store 重映射一次。

### 7.3 图片 id 与缺失

- 图片请求**永远用 pokemon id**：`/assets/encrypted/pokemon/{b.id}/home.bin`。
- 不是每个 pokemon id 都有图（见 4.3 的 16 个缺口），404 走默认占位。
- `pokemon_species.id`（全国编号）**不**用于拼图片路径；它只用于查名/分类/世代号段。

---

## 8. 排障清单（出问题先逐项核对）

### 8.1 「图裂了 / 显示默认图」

1. 打开 Network，看请求的 URL 是哪个 pokemon id、哪个 variant（默认 `home`）。
2. 状态码：
   - **404** → 服务端无此文件。对照 4.3 缺口表；若不在表里，检查 `encrypt-assets` 是否跑过、
     `assets/encrypted-assets/pokemon/{id}/home.bin` 是否存在。
   - **403** → CDN 签名过期（`spriteCache`/`resourceManager` 会自动清 key 重签重下一次，
     仍失败才报错）；本地无 CDN 一般是路径/代理问题。
   - **200 但解密抛错** → 见 8.2。
3. 控制台文案：`无立绘资源` = 404 正常缺口；`解密失败` = 真错误（magic/version/tag/DEK）。
4. 快速滑动时图闪骨架 → 正常，离屏取消 + 进视口重下。

### 8.2 「解密失败 / invalid magic / unsupported version / tag 验证失败」

- `ZKDX: invalid magic` → 拿到的不是 ZKDX 字节（可能是 HTML 404 页、未加密的明文 FB、
  或 JSON 错误体）。检查远端路径是否真的指向 `encrypted-assets/` 下的 `.bin`。
- `ZKDX: unsupported version: N` → 文件 version 字节 ≠ 前端 `FORMAT_VERSION`(1)。
  见 1.1：要么后端用错版本加密，要么前端 WASM 没跟着 bump。
- GCM tag 验证失败 → **DEK 与密文不匹配**（用错误的 DEK 解、或字节损坏/被截断）。
  - 确认 `ZUKAN_DEK` 在加密时和运行时一致；
  - 删本地缓存重下（可能是半截写入 / schema drift）：
    `resourceManager` 会自动删持久字节重试一次；sprite 走 `dropSpriteBytes`。
- 数据 bundle 解码抛「unknown fid」→ 解密成功但 FlatBuffers 头不是预期的 `PKMB/PKNM/…`，
  说明路径对错了 bundle（如下到了图片字节），检查 `resourceManager` 的 `remotePath`。

### 8.3 「改了数据/图片，浏览器不刷新」

**最常见**。前端是 cache-first，且资源带 `immutable`：
1. 本地开发：清 IndexedDB（删 `zukan-fb` DB）+ 清 sprite 索引 storage，或 DevTools → Clear site data，
   再硬刷新。
2. 强制全量客户端刷新：必须按 1.1 三步**同时** bump `ZUKAN_DEK_VERSION` + 重加密 + 升前端
   `FORMAT_VERSION` 重编 WASM。只重加密不 bump 版本，旧客户端永远命中 `fb:v1:` 缓存。

### 8.4 「形态名不对 / 显示 form-{id}」

- 非默认形态名错位 → 检查 `sync-i18n.py::load_form_pokemon_map` 的 form_id→pokemon_id
  重映射是否还在（7.2）。
- 全部形态名都是 `form-{id}` → PKNM names bundle 没加载或加载失败，看 i18n store / Network；
  注意重新生成 names.bin 后同样要按 8.3 处理缓存。
- 默认形态名是 `pokemon-{id}` → species 名没查到（同上，PKNM species 表）。

### 8.5 「DEK / 登录相关」

- 所有解密都失败 + 弹登录窗 → 401 恢复流程在 `getKey()` 里；用户关弹窗抛
  `LoginDismissedError`，调用方静默降级是预期行为。
- 6 个请求点并发只应弹一个登录窗 → 靠 `authGate` 模块单例，别改成 Pinia store（会成环）。

---

## 9. 改动检查清单

改不同位置时，对照确认有没有漏：

| 改动 | 必须同步的事 |
|------|--------------|
| ZKDX 格式 / 加算法 | 四处常量（前端 crypto.rs、后端 wasm-crypto、两个 CLI）；版本字节分派；本文第 1、1.1 节 |
| 重新加密资源（内容变更） | 决定是否 bump `ZUKAN_DEK_VERSION`；要强制客户端刷新就得 bump + 重编 WASM（1.1 / 8.3） |
| 新增 FB bundle 类型 | ① FlatBuffers schema + `flatc` 重生成 ② `sync-*.py` 打包 ③ WASM `convert.rs` 加解码器 + `index.ts` 导出 ④ `resourceManager` 加 spec/getter/prefetch ⑤ 本文第 4.1 节 |
| 新增 sprite variant | ① `encrypt-assets` 产物 ② `EncryptedSprite` 的 variant prop 传值 ③ 缺失兜底 ④ 本文 4.2 |
| 改 form / 名称映射 | `sync-i18n.py` 重映射逻辑；重新打包 PKNM 并重加密；清缓存（7.2 / 8.4） |
| 改缓存调度 / 引用计数 | 跑 `pnpm test`（spriteCache / spritePersist 用例）；别破坏第 6.2、6.3 节的不变量 |
| 接 CDN 签名 | 后端 `/zukan/key` 响应加 `cdn` 对象；前端 `buildCdnUrl` 已就绪，无需改下载逻辑（2.4 / 5.1） |

**每次改完必跑**（仓库门禁）：
1. `pnpm type-check` —— 0 error
2. `pnpm test` —— 全绿（改 resourceManager/spriteCache/spritePersist 尤其别跳）
3. `pnpm dev:h5` 起服务，移动端 UA curl 改动页面/组件确认 200
4. 动了 scoped CSS / CSS 变量绑定，额外拉编译产物核对

---

## 10. 关键文件索引

**前端（`zukan/`）**
- 格式与解密：`src/infra/wasm/src/crypto.rs`、`src/infra/wasm/index.ts`
- 下载：`src/services/http/binaryRequest.ts`、`src/services/resources/cdn.ts`
- 密钥：`src/services/session/key.ts`、`authGate.ts`、`types.ts`
- 数据缓存：`src/services/resources/resourceManager.ts`、`src/services/resources/dataVersion.ts`
- 图片缓存：`src/services/resources/spriteCache.ts`、`spritePersist.ts`
- 持久层：`src/infra/storage/binaryStorage.ts`
- 数据建模：`src/services/pokemon/pokemon.ts`
- 组件：`src/components/sprite/EncryptedSprite.vue`
- 启动预取 / 版本清理：`src/services/boot.ts`

**后端（`zukan-server/`）**
- 加密 CLI：`crates/server/src/bin/encrypt-fb.rs`、`encrypt-assets.rs`
- 加密核心：`crates/wasm-crypto/src/lib.rs`
- 资源路由：`crates/server/src/features/assets/routes.rs`
- 密钥接口：`crates/server/src/features/zukan/{handler,service,dto}.rs`
- 配置：`crates/server/src/config.rs`（`ZUKAN_DEK` / `ZUKAN_DEK_VERSION` / `ASSETS_DIR`）
- 打包脚本：`tools/sync-fb.py`、`tools/sync-i18n.py`
