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
| 4 | 1 | version | **DEK/格式版本号**，当前恒为 `1`，由 `ZUKAN_DEK_VERSION` 写入 |
| 5 | 12 | nonce | AES-GCM IV，每次加密随机生成，**绝不复用** |
| 17 | N−17 | ciphertext+tag | AES-256-GCM 输出，末尾 16 字节是认证标签 |

最小合法文件 33 B。常量在四处定义，**必须保持一致**：前端 `src/infra/wasm/src/crypto.rs`、
后端 `crates/wasm-crypto/src/lib.rs`、两个加密 CLI。

### 1.1 ⚠️ version 字节的两个身份（最容易踩的坑）

同一个字节被两套机制使用，当前值都是 `1`，但语义不同：

1. **解密侧硬校验**：前端 `crypto.rs::decrypt_zukan` 读到 `version != FORMAT_VERSION`(=1) 直接
   抛 `ZKDX: unsupported version: N`，**拒绝解密**。
2. **缓存侧版本键**：前端把 `/zukan/key` 返回的 `version` 写进存储（`zukan_data_version`），
   所有密文缓存 key 带前缀 `fb:v{N}:`（数据）和 `sprite:v{N}:`（图片）。版本变化时
   `boot.ts` 调 `resourceManager.pruneOtherVersions(newVersion)` 清旧前缀。

**后果**：只重新加密资源但**不 bump `ZUKAN_DEK_VERSION`**，version 仍是 1、缓存前缀仍是 `fb:v1:`，
前端 cache-first 会一直命中旧缓存，**永远不重下**。

要强制所有客户端拉新字节，必须**同时**做三件事：
1. 后端 `ZUKAN_DEK_VERSION` 改成 `2`；
2. 用新 DEK + version=2 重加密全部产物（`make encrypt-fb` / `make encrypt`）；
3. **前端 `FORMAT_VERSION` 升到 2 并重编 WASM**，否则旧 WASM 拒绝解 version=2。

> 当前架构下「数据热更新」和「DEK 轮换」是同一个开关。只换资源内容不动密钥，没有轻量缓存击穿手段。

## 2. 后端构建管线（zukan-server）

两步：先生成明文 FlatBuffers，再批量加密成 ZKDX。

| 命令 | 脚本 | 产物 |
|------|------|------|
| `make sync-fb` | `tools/sync-fb.py` | 明文 `assets/fb/gen-N.bin`、`evolution.bin`、`moves/`、`moves_data/`、`pokemon_moves/` |
| `make sync-i18n` | `tools/sync-i18n.py` | 明文 `assets/fb/i18n/<lang>/{names,flavor}.bin`（form 名有 id 重映射，见第 7 节） |
| `make encrypt-fb` | `crates/server/src/bin/encrypt-fb.rs` | `assets/encrypted-assets/fb/**`（跳过 schemas/_generated） |
| `make encrypt` | `crates/server/src/bin/encrypt-assets.rs` | `assets/encrypted-assets/**`，PNG → `.bin`，保留层级 |

CLI 算法：`nonce=random(12B)`；`ciphertext=AES-256-GCM(DEK, nonce, plaintext)`；
拼 `b"ZKDX" + VERSION + nonce + ciphertext`。DEK 从 `ZUKAN_DEK`（64 hex = 32 字节），
版本从 `ZUKAN_DEK_VERSION`（缺省 1），Makefile 从 `.env` 取。

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

路径 `/assets/encrypted/pokemon/{pokemonId}/{variant}.bin`，解密后 PNG。`EncryptedSprite` 默认 `home.bin`。

| variant | 含义 |
|---------|------|
| `home` | **默认** Pokémon HOME 立绘 |
| `home-shiny` / `home-female` | HOME 闪光 / 雌性 |
| `artwork` / `artwork-shiny` | 官方插画 |
| `shiny` / `female` | 图鉴像素闪光 / 雌性 |
| `back` | 背面像素图 |
| `dream` | Dreamworld 立绘 |
| `versions/<gen>/...` | 按世代历史美术（**前端当前不读取**） |

详情主图传 `eager`（必然可见，不懒加载）。

### 4.3 已知图片缺口（404 正常）

部分形态官方无 HOME 立绘，前端 404 回退 `/static/default.png`，404 单独打 `[EncryptedSprite] 无立绘资源`，
不误报解密失败。1351 个 id 中 `home.bin` 缺失 16 个：

| 类型 | id | 形态 |
|------|----|------|
| 无任何目录 | 10265–10267 | 故勒顿 冲刺/游泳/滑翔 |
| 无任何目录 | 10269–10271 | 密勒顿 驱动/水上/滑翔 |
| 有目录无 home（也无 artwork） | 10264 / 10268 | 故勒顿限定 / 密勒顿低电量 |
| 有目录无 home（**有 artwork**） | 10080–10085 | 角色扮演皮卡丘 |
| 有目录无 home（**有 artwork**） | 10158 / 10159 | 搭档皮卡丘 / 搭档伊布 |

> 想让无 home 的形态回退 artwork 而非占位，需要数据层加「形态→可回退 variant」判断，再让
> `EncryptedSprite` 按顺序尝试，目前未实现。

## 5. 三套 id 空间

图/数据排查核心，详见 [../data/bundle-decode.md](../data/bundle-decode.md)。一句话：
- sprite 请求与 PKMB `baseEntries[].id` 用 **pokemon id**；
- 物种名/分类/蛋组/世代用 **species id**；
- PKNM 形态表主键是 **pokemon_forms id**，后端打包时重映射成 pokemon id（否则非默认形态名错位）。

## 6. 排障清单

### 6.1 图裂 / 显示默认图
1. Network 看请求的 pokemon id、variant（默认 home）。
2. 状态码：**404** → 对照 4.3 缺口表，不在表里查 `encrypt-assets` 是否跑过；
   **403** → CDN 签名过期（自动清 key 重签重下一次）；**200 但解密抛错** → 见 6.2。
3. 控制台 `无立绘资源` = 404 正常；`解密失败` = 真错误。
4. 快滑时闪骨架 = 离屏取消 + 进视口重下，正常。

### 6.2 解密失败 / invalid magic / unsupported version / tag 失败
- `invalid magic` → 拿到的不是 ZKDX（HTML 404 页、未加密明文 FB、JSON 错误体）。查远端路径。
- `unsupported version: N` → version 字节 ≠ 前端 `FORMAT_VERSION`，见 1.1。
- GCM tag 失败 → DEK 与密文不匹配或字节损坏。确认 `ZUKAN_DEK` 一致；删本地缓存重下
  （resourceManager 自动删持久字节重试一次；sprite 走 `dropSpriteBytes`）。
- 解码抛 `unknown fid` → 解密成功但 FlatBuffers 头不是预期 fid，路径对错了 bundle。

### 6.3 改了数据/图片，浏览器不刷新
前端 cache-first 且资源 `immutable`。本地：清 IndexedDB（`zukan-fb`）+ sprite 索引，硬刷新。
强制全量：按 1.1 三步同时 bump 版本 + 重加密 + 重编 WASM。

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
| ZKDX 格式 / 加算法 | 四处常量（前端 crypto.rs、后端 wasm-crypto、两个 CLI）；版本分派；本文第 1、1.1 节 |
| 重新加密资源（内容变更） | 决定是否 bump 版本；强制刷新就得 bump + 重编 WASM（1.1 / 6.3） |
| 新增 FB bundle 类型 | ① schema + flatc 重生成 ② sync-*.py 打包 ③ WASM convert.rs 加解码器 + index.ts 导出 ④ resourceManager 加 spec/getter/prefetch ⑤ 本文 4.1 |
| 新增 sprite variant | ① encrypt-assets 产物 ② EncryptedSprite variant 传值 ③ 缺失兜底 ④ 本文 4.2 |
| 改 form / 名称映射 | sync-i18n.py 重映射；重打包 PKNM 重加密；清缓存 |
| 改缓存调度 / 引用计数 | 跑 `pnpm test`（spriteCache/spritePersist）；别破坏 caching 文档里的不变量 |
| 接 CDN 签名 | 后端 `/zukan/key` 响应加 `cdn` 对象；前端 `buildCdnUrl` 已就绪 |

每次改完必跑：`pnpm type-check`、`pnpm test`、`pnpm dev:h5` 移动端 UA curl 改动页确认 200；
动了 scoped CSS / CSS 变量绑定额外拉编译产物核对。

## 8. 关键文件索引

**前端**：`src/infra/wasm/src/crypto.rs`、`src/infra/wasm/index.ts`、
`src/services/http/binaryRequest.ts`、`src/services/resources/cdn.ts`、
`src/services/session/{key,authGate}.ts`、`src/services/resources/{resourceManager,dataVersion,spriteCache,spritePersist}.ts`、
`src/infra/storage/binaryStorage.ts`、`src/services/pokemon/pokemon.ts`、
`src/components/sprite/EncryptedSprite.vue`、`src/services/boot.ts`。

**后端（zukan-server）**：加密 CLI `encrypt-fb.rs`/`encrypt-assets.rs`、
`crates/wasm-crypto/src/lib.rs`、`features/assets/routes.rs`、
`features/zukan/{handler,service,dto}.rs`、`config.rs`、`tools/sync-{fb,i18n}.py`。
