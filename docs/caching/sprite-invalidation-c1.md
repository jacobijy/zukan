# 图片缓存失效优化:C1-A(单图 hash + 非 immutable manifest)—— 提案

> 状态:**草案**,供前端会话评审落地。涉及前端图片缓存 key/URL、以及后端产出 non-immutable manifest。
> 契约来源:与 `zukan-server` 仓库会话协商确定。
> 历史:初版 C1 用「版本化 immutable manifest」,被识破为一个伪优化(**manifest 自身 immutable → 前端发现不了新 hash → 必须 bump → 仍全量重下**)。
> 本版 C1-A 修正为 **manifest 走 no-cache**,让「改图不 bump、只重下变了的图」真正成立。

## 1. 要解决的问题

现状(代码核实):
- 图片 URL:`/assets/encrypted/pokemon/{id}/{variant}.bin`,**不含版本** → `immutable` 下浏览器/CDN 恒给旧字节,改图赋不生效。
- 图片 key:`sprite:v{currentDataVersion()}:{id}/{variant}`(`imagePersist.ts`),**与数据 bundle 共用同一全局版本号**。
- 因此:bump `ZUKAN_DEK_VERSION` → 数据与**全部图片**缓存一起清空重拉——即使某次只改了数据、图片一张没动,图片也全量重下(误连坐)。

目标:
1. **改任意张图、不 bump 版本号,只重下这些图**,其余图片缓存保留。
2. **数据更新(bump 数据版本)→ 图片不跟着重下**(切断共用版本号的误连坐)。
3. **换密钥(DEK)仍然全量重下** —— 物理边界,且是显式决定,不遗漏。

## 2. 方案总览

双信号并存 + 一个「非 immutable 的 manifest」:

| 信号/要件 | 作用 | 粒度 | 何时生效 |
|---|---|---|---|
| **明文内容 hash** | URL/key 是否变化 | 单图(A) | manifest 更新 + 前端拉到 → 即时 |
| **密钥版本 `v{N}`** | 是否整体重拉 | 全局(B) | 换 DEK / 强制全刷时 bump |
| **manifest 缓存头 no-cache** | 前端每次能拿到最新 hash | 单文件 | **改图不 bump 也即时发现** ← 本版关键 |

```
manifest URL:  /assets/encrypted/sprites.json            ← 固定路径,no-cache（重建于 encrypted-assets 根）
图片 URL:      /assets/encrypted/pokemon/{id}/{variant}.bin?v={明文hash前8}
图片 key:      sprite:v{密钥版本}:{明文hash前8}:{id}/{variant}
```

- **hash 基于明文 PNG 内容**,不是密文。已核实 `encrypt-assets.rs:219` 用 `OsRng` 随机 nonce,同一原图重加密密文字节必不同;hash 密文会让「没改的安全重加密」也全量换 URL,比现状更糟。
- **manifest 固定路径 + no-cache**:前端每次渲染前拉一次(协商缓存,字节未变则 304),保证 hash 表是最新的;改图只要重新生成 manifest 并同步,前端下个请求即见新 hash。**不再需要 bump 就有精确失效。**

## 3. 后端产 manifest(构建契约 + 缓存头覆盖)

### 3.1 明细(加密时生成)

`encrypt-assets` 加密每张 PNG 时计算 SHA-256,取**前 8 位 hex**,汇总成一份明文清单,写入加密输出根 `/assets/encrypted-assets/sprites.json`:

```json
{
  "version": 3,
  "files": {
    "pokemon/25/home.bin":     { "h": "a1b2c3d4", "m": 1712345678 },
    "pokemon/25/home-shiny.bin": { "h": "e5f6a7b8", "m": 1712345678 },
    "items/4.bin":             { "h": "cafebabe", "m": 1712345678 },
    "badges/1.bin":            { "h": "d0e1f2a3", "m": 1712345678 },
    "types/1.bin":             { "h": "e5f6a7b8", "m": 1712345678 }
  }
}
```

- **key 是相对输出路径**(`pokemon/<id>/<variant>.bin` / `items/<id>.bin` …),扁平索引、覆盖 pokemon/items/badges/types,不按 kind 分层——前端直接拿 remotePath 的相对部分查询,加密器无需感知语义。
- **`h`** = 明文内容 sha256 前 8 位(前端 URL `?v=` 用);**`m`** = 源文件 mtime(毫秒),仅后端增量的继承判定,前端忽略。
- 固定文件名(不带版本段)—— 版本信号由 no-cache + 内容自身变化表达。
- `"version"` 字段记录生成时的密钥版本,供前端诊断,不作寻址。

### 3.2 【后端必有改动】manifest 的缓存头必须单独覆盖

`assets/routes.rs` 中 `/assets/encrypted/**` 整层强制 `public, max-age=31536000, immutable`(这是现有 `encrypted_assets_with_headers`)。**如果不单独处理,manifest 会被 immutable 卡死 → A 方案直接失效**。

必须在 encrypted 层**之内**、manifest 路径**之上**覆盖为 `no-cache`(或 `public, max-age=60, must-revalidate`)。两种落地方式:
- 在 `encrypted_assets_with_headers` 前插一条更具体的 `ServeDir`(只指到 `pokemon/sprites.json`)并覆盖缓存头;或
- 对 manifest 用独立 handler/层设 `Cache-Control: no-cache`。

> 选 `no-cache`(而非 `max-age=0`):允许浏览器缓存字节,但每次使用前回源校验(ETag/Last-Modified),改动即时、未改 304,不重复下载正文。

## 4. 前端改动面(C1-A 落地清单)

### 4.1 hash 查询层(新增)
- 读 manifest:`fetchBinary(/assets/encrypted/sprites.json)`(**不走 immutable 缓存**),会话内缓存 1 份(`Map`);每次进页面重新拉一次(no-cache 下成本≈304 往返)。
- `hashFor(remotePath): string | undefined`:把 `/assets/encrypted/` 前缀去掉、取相对部分(如 `pokemon/25/home.bin`)查 `files[...].h`。缺失/404(老后端或该图未收录)→ undefined → 兜底 URL(不带 `?v=`),保持现状行为。**向后兼容**。

### 4.2 URL 拼装
- `imageKind.ts` 的 `remotePath` 从纯路径改为「拼上 hash query」:`/pokemon/{id}/{variant}.bin` + (`hashFor(remotePath)` 命中 ? `?v={hash}` : 空)。
- `buildCdnUrl`/CDN 签名对 query 照常携带;CDN 需按含 query 的 URL 区分缓存键(见 §8 风险 3)。

### 4.3 缓存 key(核心改动)
- `imagePersist.storageKey`:`sprite:v{N}:{hash}:{id}/{variant}`(hash undefined 时降级旧格式 `sprite:v{N}:{id}/{variant}`,兼容历史缓存)。
- **对现有机制的影响**:
  - `pruneVersions(keepVersion)` 按 `keepPrefix = sprite:v{N}:` 删除/保留 —— key 中间多了 `{hash}:` 段,但**仍以 `sprite:v{N}:` 开头**,前缀匹配不受影响,索引 `{v, e}` 与 reconcile 重建逻辑可复用。
  - `imageCache.cacheKey`(内存 LRU 键 `pokemon:{id}/{variant}`)建议带上 hash,否则改图后内存里仍是旧 Blob URL,LRU 不感知磁盘字节已换。

### 4.4 请求流程(改图后的最小闭环)
```
用图 → (每会话)拉 manifest(sprites.json, no-cache)
  → hashFor(id, variant) → 有新 hash 即新 URL/key
  → 内存/LRU 命中?返回
  → 磁盘 miss → /pokemon/{id}/{variant}.bin?v={hash} → 下载解密
```
改一张图 → 重新生成 manifest + 同步 → 前端下个会话拉新 manifest → **只有该图 hash 变 → 只有该 URL + 该 key 变 → 只重下这张**,其余缓存原样保留。

### 4.5 与现有机制关系
- `pruneSpriteVersions(keepVersion)`(boot 版本比对驱动):签名不变,按前缀清理,兼容新 key。
- `spriteAvailability`(`zukan_sprite_avail`):记录 variant 是否有图,与 hash 无关,不改。

## 5. 换密钥(DEK)仍全量 —— 物理边界

换 `ZUKAN_DEK` 后:新 DEK 加密全部图片;明文 hash 不变 → URL 不变。前端持有旧 DEK 加密的密文,解密即 GCM 失败 → `imageCache.fetchBytes` 已删盘重拉,但 `immutable` 下同 URL 可能仍给旧字节 → 卡死。因此**换 key 必须 bump `v{N}`**(`sprites.json` 的 `version` 跟着变、图片 key 前缀全变),使全量重下成为显式、可靠路径。这就是 B 信号不可省的原因。

## 6. 场景 × 行为矩阵

| 场景 | hash | manifest | URL/key | 图片缓存行为 |
|---|---|---|---|---|
| **改 N 张图、不 bump** | 变 | 重发 | 只那 N 个变 | ✅ 只重下 N 张(核心价值,本版达成) |
| **数据更新、图没动** | 不变 | 不变 | 不变 | ✅ 图片完全不动(切断误连坐) |
| **新增形态/道具** | 新增条目 | 重发 | 新 id 新 URL/key | ✅ 自然只下新的 |
| **换 DEK(密钥轮换)** | 不变(明文) | version 变 | `v{N}` 全变 | ✅ 全量重下(显式、物理必要) |
| **纯安全重加密(DEK 不变)** | 不变 | 不变 | 不变 | ✅ 一张都不重下 |

## 7. 兼容与回退

- **老后端(无 sprites.json)**:404 → `hashFor` undefined → URL 不带 query → 现状行为;`sprite:v{N}:{id}/{variant}` 旧 key 仍读得到。前端可先上 hash 分支、后端后补 manifest,顺序任意不破坏。
- **回退**:前端撤 hash 分支即回现状;后端多产一个 manifest 文件不影响任何资源。
- 注意 C1-A 下 manifest 路径固定,**不存在「bump 换 manifest URL」**:改图生效依赖「后端重发 manifest + 前端 no-cache 拉到新内容」,不 bump。

## 8. 风险 / 未决

1. **每次会话多一次 manifest 请求**:no-cache 下前端每次回源校验 manifest(未变 304)。
   **实测体积(2026-11-13):清单 47581 条,未压缩 5.0 MB,`gzip -c` 后约 756 KB / 6.5:1。** 因此:
   - H5:浏览器 no-cache + 304 协商,重复访问近免费(仅首会 5 MB 一次性下载);
   - **微信小程序 `wx.request` 不执行条件请求 / 304 —— 每次前台都整包拉 5 MB**,前端侧已加
     5 分钟刷新时间闸(`imageManifest.MIN_REFRESH_INTERVAL_MS`)收敛,但首拉仍是一次 5 MB;
   - 建议后端产 minify JSON(去 `m` 字段 / 压缩)并启用 gzip 响应,可把传输量拉到 ~700 KB 级
     (小程序若自动解压 gzip 则无忧,需真机确认)。

2. **【后端】manifest 缓存头必须单独覆盖**:不覆盖则进 controlled 的 immutable 层,A 失效。
   §3.2 是后端必改项。**已实现并验证**(2026-11-13):`assets/handler.rs::sprites_no_cache`
   中间件生效后 `curl -sI /assets/encrypted/sprites.json` 返回 `cache-control: no-cache`。
   注:该改动需要**重启后端进程**才加载(旧进程仍发 immutable —— 本次联调踩到过)。
3. **CDN 缓存键含 query**:多数 CDN(Cloudflare 等)将 `?v=` 计入缓存键,OK;若 CDN 忽略 query,immutable 直接失效,需在部署确认「含 query 区分缓存」。manifest 自身路径无 query,不受此项影响。
4. **MP 存储 key 长度**:key 加 `{hash8}:` 段后变长,单个密文 <1MB 限制,无碍。
5. **hash 位数冲突**:前 8 位 hex(32 bit),图片规模约 1300+，碰撞概率极低但非零。若某 id/variant 碰撞,URL 永久不变 → 该图改不动。可在构建时检测同 hash 不同内容告警,或取前 10 位 hex(本版取 8 位,如需更稳前端/构建可调)。

## 9. 落地顺序建议

1. **后端(已完成, 2026-11-13)**:
   - `encrypt-assets` 已产 `sprites.json`(相对 bin 路径 → `{h,m}`,增量按源 mtime 继承;单测 4 个覆盖构建/继承/重算/删除)。
   - `assets/routes.rs` 中 `/assets/encrypted/sprites.json` 由中间件改写为 `no-cache`(`assets/handler.rs::sprites_no_cache`),其余加密资源仍 immutable;集成测试 `sprite_manifest_is_no_cache_not_immutable` 锁定。
   - 实测:47581 条清单,改单图仅该 hash 变,`curl` 头 `no-cache`/`application/json`。
2. 前端:hash 查询层 + URL 拼装(§4.1/4.2),老后端降级路径先通。**已完成(2026-11-13)**。
3. 前端:key 加 hash 段 + `imageCache.cacheKey`(§4.3),联调「改单图 → 只重下单图 URL」。**已完成**
   (2026-11-13,见下文「前端落地记录」)。
4. CDN 缓存键含 query 确认(§8 风险 3),上线观察。

> 本文档由 `zukan-server` 仓库会话按契约起草,前端实现以 `docs/` 为基准对接;后端不耦合前端实现细节。

## 前端落地记录(2026-11-13,前端会话)

新增/改动(均在前端仓库 `src/services/resources/`):

- **`imageManifest.ts`(新)**:`refreshManifest()` 拉 `/assets/encrypted/sprites.json`(走 `fetchBinary`/
  `buildAssetUrl`,**无 CDN 签名**以保留 304 协商;dev 下 `_dc` 自动 bust),模块级同步快照
  `snapshot`,`hashForPath(remotePath)` 同步查表。要点:
  - **失败保留旧快照**、首拉失败 = 现状(全 undefined);
  - **5 分钟刷新时间闸**(`MIN_REFRESH_INTERVAL_MS`):小程序无 304 会整包重拉,限频;快照为 null
    (从未成功)时不受闸;
  - 并发拉取 inflight 去重。
- **`imageKind.ts`**:`remotePath` 保持纯路径(不加 query)—— hash 拼装收敛在引擎层,相对路径单一出处。
- **`imageCache.ts`**:`fetchBytes` 里 `hash ? `${remotePath}?v=${hash}` : remotePath`,正常 + 403 重签
  路径统一;`cacheKey` hash 命中时末尾加 `:{hash}`;`release` 加**键漂移前缀兜底**(acquire/release
  落在快照翻转两侧时,refs 不会被 pin 住)。
- **`imagePersist.ts`**:`storageKey` = `sprite:v{N}:{hash}:{id}/{variant}`,undefined 回落旧格式;
  **`keyId()` 改取末段纯数字 id**(4 段 key 下原 `[2]` 会拿到 hash、且 hash 全数字时误判保护集)。
- **接线**:`boot.ts` 版本比对 / `pruneOtherVersions` 流程**完成后** `void refreshManifest()`(与数据
  预取并发,避免新 hash 套旧 `v{N}`);
  `App.vue` 增 `onShow(() => void refreshManifest())`(前台切换 / 刷新即拉新)。
- **item 自动覆盖**(共用实现,manifest 含 `items/`);battle 是否入表取决于后端清单内容,不特判。

遗留 / 上线待办:

- **后端产 minify / gzip**:5 MB 未压缩对小程序前台重拉仍重(见 §8 风险 1 实测)。
- **CDN 缓存键含 `?v=` 确认**(§8 风险 3):上线时在 CDN 侧确认 query 计入缓存键。
- **改图端到端手工验证**:重跑 `encrypt-assets` 改单图 → 重新前台 → 只重下单图(本机已验
  证 manifest 头 no-cache + 前端模块可加载,未执行整条资产重打包)。
- **MP 真机确认**:wx.request 对 5 MB 清单的拉取耗时 / gzip 自动解压与否。