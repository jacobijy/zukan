# 小程序 / App 加密资源本地缓存（fs 后端方案）

> **状态：主线已实现（步骤 1–3 + sprite 最小闭环）；第 4 步下载去重尚未做。**
> 已落地的：`cacheConfig.ts`、`binaryStorage` 的 fs 后端、`imagePersist` 注入后端 +
> `isPersistable` + 保护集淘汰、`spritePersist` 注入 fs + 配置预算、对应单测。
> 已验证：`pnpm type-check` 0 error、全量 `pnpm test` 529 passed、`pnpm build:mp-weixin` 通过。
> **真机行为（小程序 / App 实际读写 fs）尚未验证** —— 需在微信开发者工具 / 真机
> 「进页面 → 重进 → 不重下」确认，见下文「落地顺序」第 4 步。
> 已实现的部分见 [./sprite-cache.md](./sprite-cache.md)（imageCache / imagePersist）
> 与 [./resource-cache.md](./resource-cache.md)（resourceManager）。
>
> **与初版方案的两处偏差**（实现时定下的更干净做法）：
> 1. **不往 `storageBackend` 联合类型加 `'fs'`。** `storageBackend` 描述的是
>    `binaryStorage` 单例（FB bundle 用的，仍是 idb/uni/memory）。fs 是**按种类分发**的
>    独立后端：`ImageKindSpec.fsBackend` 标记哪些种类走 fs，由
>    `imageBinaryStorage`（运行时分发存储）在每次调用时按 `hasFileSystemBackend()`
>    挑 fs / IDB / no-op。`isPersistable = storageBackend !== 'memory' &&
>    (hasFileSystemBackend() || storageBackend === 'idb')`。
> 2. **淘汰仍用插入序，不用 mtime。** 初版想用 fs 的文件 mtime 免费拿 LRU，但那要给
>    `BinaryStorage` 接口加 `stat`、并在 3 个测试 mock 里都实现它，得不偿失。插入序（近似
>    FIFO）够用，且保持接口干净。

## 要解决的问题

小程序（`mp-weixin`）与 App 端，加密图片**每次进页面都重新下载**，已经下载过的密文不会被复用。

根因只有一个：`imagePersist.isIdbBackend()` 返回 `storageBackend === 'idb'`，
而小程序 / App 的 `storageBackend` 是 `'uni'`，于是整个持久化模块的
`loadBytes` / `saveBytes` / `dropBytes` / `reconcile` / `evictToBudget` 全部 no-op，
跨刷新缓存从不存在。App 同样中招，只是它不像小程序那样频繁被系统杀掉，所以没暴露。

## 三条诉求与它们的落点

按需求逐条对齐到已有机制 —— **只有第 1 条需要新代码**：

1. **按本地缓存是否存在决定读本地还是远程下载。**
   这条链已存在，是「内存 → 本地持久化 → 网络」：
   - FB bundle：`memoryCache → binaryStorage → fetchBinary`（`resourceManager.fetchDecrypted`）
   - 图片：`persist.loadBytes → fetchBinary`（`imageCache.fetchBytes`）
   只要小程序 / App 接上一个**可用的持久化后端**，这条「按本地存在性决定」自动成立。
   **需要新代码。**

2. **按后端下发版本号决定是否重下。**
   已经跑通，不需要新做。FB 侧 `fb:v{N}` 前缀 + `pruneOtherVersions`，
   图片 / 道具的 `pruneSpriteVersions` / `pruneItemIconVersions` 接同一个版本号，
   `boot.ts` 启动比对不一致就清旧前缀。只要新的 fs 后端支持 `keys(prefix)` / `delete`
   （版本清理要按前缀枚举），这条就能覆盖新后端。**不需要新代码**（见下「实现要点」第 3 步）。

3. **H5 交给浏览器 cache 自行决定。**
   **对加密资源不成立，按原状保持。** CDN 签名 URL 带 `?sign&t`，`t` 每次签都不同，
   URL 变则浏览器必然 cache miss —— HTTP cache 在这条链上从头到尾没起作用
   （`imageCache.ts` 文件头明确写了）。H5 的跨刷新缓存靠的是 IndexedDB 存密文
   （`idbStorage` 后端），不是浏览器 cache。真正由浏览器 cache 管的是**非加密**静态资源
   （`/static/`、对战明文 JSON），而那些本来就不走 `fetchBinary`。这一条不产生改动。

## 实现要点

分四步，前三步是主线（解决小程序重下），第四步是顺带的去重（可选，单独提交）。

### 1. 新增 `fs` 存储后端（`src/infra/storage/binaryStorage.ts`）

新增一个 `BinaryStorage` 实现，走微信 / App 的文件系统。**所有方法都用 `*Sync` 变体**
（`writeFileSync` / `readFileSync` / `unlinkSync` / `mkdirSync` / `readdirSync` / `statSync`
均已确认存在于 uni 类型），外包一层 Promise 适配 `BinaryStorage` 接口 —— 这样上层
`imagePersist` 的 async 调用与 H5 的 IDB 后端调用形态一致，不需要给持久层加 sync 特例。

**存 ZKDX 密文，不是解密后的图。** 路径前缀刻意与 `objectUrl.ts` 的 `zukan-img/` 分开 ——
后者是解密后的明文临时落地、release 即 `unlink`，是「临时落点」不是缓存；
混用前缀会让「明文落点」和「密文缓存」纠缠不清，也破坏安全模型。

#### key → 文件路径映射

`imagePersist` 生成的 key 形如 `sprite:v1:123/front`（含 `/` 和 `:`），**不能直接拼成文件名**。
映射规则（后端内部私有，上层只看到不透明 key）：

```
CACHE_DIR  = `${uni.env.USER_DATA_PATH}/zukan-cache`        # 平铺目录，不分子目录
pathOf(key) = `${CACHE_DIR}/${key.replace(/[\/:]/g, '_')}`  # sprite_v1_123_front
```

- **平铺，不建子目录。** `readdirSync` 只返回一个目录的内容，平铺使 `keys()` 一次读完，
  不用递归。`zukan-cache` 根目录 `mkdirSync(recursive:true)` 一次即可（已存在按成功处理，
  同 `objectUrl.ts` 的写法）。
- 文件名里 `/` `:` 是唯一需要替换的字符；版本清理按前缀过滤用的是**原始 key 字符串**
  （从 `readdirSync` 拿到的文件名反推回 key 时做同样的替换逆操作即可，或直接靠
  「枚举出的文件名都在 `zukan-cache` 下」这个事实 —— 上层 `keys(root)` 按 `root` 字符串
  前缀过滤原始 key，不依赖磁盘路径结构）。
  > 更稳的做法：**`keys()` 直接返回索引里的 key 列表**（见下「keys 的两种实现」），
  > 不依赖文件名反推，避开替换逆运算出错。

#### 五方法

- `get(key)`：`readFileSync(path)` → `ArrayBuffer` → `Uint8Array`。**坑**：无 encoding 参数时
  返回值类型是 `string | ArrayBuffer`（uni 类型 `readFileSync(...): string | ArrayBuffer`），
  运行时省略 encoding 才拿 ArrayBuffer，但类型是联合。必须**显式判类型**并只接受 ArrayBuffer
  分支，文件不存在时 `readFileSync` 抛错 → catch 后返回 `null`（miss）。
  不要像 `u8ToBase64` 那样假设 —— 直接读，不复用 base64 桥（那是 storage 端的）。
- `put(key, data)`：`writeFileSync(path, ab)`。`data` 是 `Uint8Array`，需取精确底层 buffer
  （同 `objectUrl.ts:53` 的 `byteOffset` 处理：`byteOffset===0 && length===buffer.byteLength`
  用 `data.buffer`，否则 `data.slice().buffer`）。写失败（配额满 / 磁盘满）静默，同现有后端
  —— 持久化是纯优化，写不进下次重下即可。
- `delete(key)`：`unlinkSync(path)`，不存在时 catch 静默。
- `keys(prefix)`：`readdirSync(CACHE_DIR)` 拿文件名 → 按「文件名以替换后的 prefix 开头」过滤
  → 反推回原始 key。**见下「keys 的两种实现」** —— 推荐用索引而非磁盘枚举。
- `clear(prefix)`：复用 `keys` + `delete`，与其它后端一致。

#### keys 的两种实现（重要决策）

`imagePersist` 用 `binaryStorage.keys(root)` 做两件事：开局 `reconcile()` 删孤儿、
`pruneVersions()` 按版本清理。fs 后端有两种做法：

1. **磁盘枚举**（`readdirSync` + 文件名前缀过滤 + 反推 key）：自洽、不依赖索引，
   但要把 `sprite:v1:123/front` → `sprite_v1_123_front` 的替换**正向和反向都做对**，
   反推错会让版本清理漏删或误删。
2. **走索引**：`imagePersist` 本来就有 key→字节的索引（`uni storage`），
   `keys(prefix)` 可以直接返回索引里匹配 prefix 的 key。

**推荐做法 1（磁盘枚举），但只在 fs 后端内部实现，且用「文件名直接是原始 key 的合法化」
这一个方向、反推只做一次映射函数。** 理由：索引可能缺失（首次 / 被清），磁盘枚举是真相；
reconcile 的存在本身就是为「索引与数据不一致」兜底，如果 keys 也走索引就失去了对账意义。
反向映射集中成一个纯函数 `fileNameToKey()`，正向 `keyToFileName()`，两个互逆，
写个单测断言 `fileNameToKey(keyToFileName(k)) === k` 即可锁住。

> 备选：若嫌映射易错，可让 fs 后端的 `keys()` 优先用索引、索引为空时回落磁盘枚举。
> 但那样 reconcile 在「索引空 + 磁盘有数据」时拿不到孤儿 —— 首次启动会漏一次对账。
> 优先正确性，**用磁盘枚举**。

### 2. 让持久层按用途注入后端 + 放宽启用条件

`imagePersist.ts`：

- `createImagePersist` 增一个可选的 storage 参数（默认仍用全局 `binaryStorage`，
  H5 不变），图片实例注入 fs 后端。签名变为
  `createImagePersist(spec, maxBytes, storage?: BinaryStorage)`，内部 `const store = storage ?? binaryStorage`，
  把现在所有 `binaryStorage.xxx` 调用换成 `store.xxx`。
- `isIdbBackend()` 放宽成 `isPersistable()`，接受 `'idb' | 'fs'` —— 否则 fs 后端下依旧 no-op。
  实现：`const PERSISTABLE = new Set(['idb','fs']); return PERSISTABLE.has(storageBackend)`。
- 索引仍走 `uni storage`（`getStorageSync` / `setStorageSync`）：**跨平台一致，无需改。**
  索引是几百字节、要同步读，和「数据落哪」是两回事。

「按用途注入」是关键：图片用 fs（密文、量大、要枚举清理），FB bundle 用 `uniStorage`
（量小、只按 key 取）。两条通道共用同一个 `BinaryStorage` 接口，但各选各的后端实例。

**注意**：注入的 fs 后端必须在**有文件系统**时创建（`uni.env.USER_DATA_PATH` 存在）。
H5 没有文件系统，注入点要判：`storageBackend === 'fs' ? fsStorage : binaryStorage`，
H5 上 `storageBackend === 'idb'`，自然走默认 `binaryStorage`（IDB），不受影响。

#### 落地时的两处修正（踩过再改回来的）

1. **不能在模块加载期按 `hasFileSystemBackend()` 分支选 store** —— 小程序端 `wx`
   是运行时注入的全局，模块 import 那一刻可能尚未就绪，`hasFileSystemBackend()`
   返回 false 会让 store 定型成退化的 fs 后端，图片永不持久化（现象：
   「不再重下但图加载不出」）。落地改成 `binaryStorage.ts` 导出一个
   `imageBinaryStorage` **运行时分发存储**：每个方法调用时按 `hasFileSystemBackend()`
   现场挑 fs / IDB / no-op（分发规则见下），store 本身是稳定的。
   `imagePersist.ts` 的 `isPersistable` 也改成运行时调用 `hasFileSystemBackend()`，
   不再读模块加载期的快照。
2. **`isPersistable` 不再用 `store !== binaryStorage` 判** —— 一旦 store 由种类标记
   （`spec.fsBackend`）静态决定，这个判定就退化成「种类是否开了 fs」。改成
   `storageBackend !== 'memory' && (hasFileSystemBackend() || storageBackend === 'idb')`，
   即「后端能用」的语义，与种类解耦：H5 上 fs 不可用但 IDB 可用 → 启用；
   假想的仅 uniStorage 平台 → 不启用（不塞 10MB 配额）。
3. **预算按平台取**：`spritePersist.ts` 的 `MAX_BYTES` 由
   `hasFileSystemBackend() ? fsBudgetMB : 200` 决定，H5 的 IDB 配额大，
   给到 200MB 基本无感；`protectedIdMax` 只在 fs 后端有意义（IDB 淘汰压力小）。
4. **种类差异下沉到 `ImageKindSpec`**：加 `fsBackend?: boolean` 字段（默认 false），
   由 `imagePersist.ts` 的默认参数 `store = spec.fsBackend ? imageBinaryStorage : binaryStorage`
   读。sprite 是唯一开 fs 的种类；道具图标密文极小、种类多，暂留在 IDB，
   等 fs 通路验证稳了再逐个开启。

**运行时分发规则**（`imageBinaryStorage`）：

| `hasFileSystemBackend()` | `storageBackend` | 分发到 | 说明 |
|---|---|---|---|
| true | 任意 | `fsStorage` | 小程序 / App，USER_DATA_PATH 200MB |
| false | `'idb'` | `binaryStorage`（IDB） | H5 |
| false | `'uni'` | `fsStorage`（退化 no-op） | 假想平台，**绝不回落 uniStorage**（10MB 会顶出 FB） |

### 3. 预算与淘汰：可配置 + 保护集

现状：`spritePersist.ts` 里 `MAX_BYTES = 60MB` 写死；`evictToBudget()` 纯 FIFO。

- 新增 `src/constants/cacheConfig.ts` 作为**单一配置源**：
  ```ts
  export const CACHE_CONFIG = {
    fsBudgetMB: 40,        // 小程序/App 图片密文总预算
    protectedIdMax: 100,   // id ≤ 此值的图鉴前 100 号优先保留
  } as const;
  ```
  两个值都从这里取，不硬编码。H5 的 IDB 预算（sprite 60MB）暂不动 —— 它有 200MB+ 配额。
- 淘汰改用 **mtime 顺序而非插入序**（fs 后端专属，IDB 仍用插入序）。理由见下「淘汰顺序」。
- `evictToBudget()` 加**保护集**逻辑：淘汰时跳过 `id <= protectedIdMax` 的条目
  （让图鉴前 100 号常驻本地，首页首屏更顺）；非保护项删完仍超预算，
  才回落到对保护项也按 FIFO 删。保护是「优先保留」，不是「永不删」。
- 索引仍按插入序记账（`ImageIndex.e` 是普通对象），但 fs 后端的**字节数真相在磁盘**
  （`statSync().size`）—— 索引字节数只用于「是否需要淘汰」的快速判断，
  精确字节数在 reconcile / prune 时用磁盘 stat 校正，避免「索引说有、磁盘实际不同」。

#### 淘汰顺序：插入序 vs mtime

`imagePersist` 现有实现按 `Object.entries(idx.e)` 的插入序淘汰（注释里说这是「近似 FIFO」）。
但 fs 后端有个更准的真相源：**每个文件的 mtime**（`statSync().lastModifiedTime`）。

- IDB 后端：没有文件 mtime，继续用插入序（行为不变）。
- fs 后端：**能用 mtime 就用 mtime**。`saveBytes` 每次 `writeFileSync` 都刷新 mtime，
  于是「最近重新缓存过的」自然 mtime 新 —— 接近 LRU 语义，且不用每次读命中就回写索引
  （这正是 imagePersist 当年刻意避开 LRU 的原因：LRU 要每次命中回写，多一次 IDB 往返。
  fs 后端因为 mtime 是文件系统白送的，等于免费拿到了 LRU 效果）。

**统一实现**：`evictToBudget()` 先按当前顺序（插入序）挑候选，若后端能报 mtime
（fs），则按 mtime 升序排（最旧先删）。用一个 `sortKey` 回调把两种后端接起来：
IDB 给 `key → 插入序号`，fs 给 `key → mtime`。保护集判断（`id <= protectedIdMax`）
在两种后端都生效，从 key 字符串里解析 id（`sprite:v1:123/front` → 取 `123`）。

### 4. （可选，单独提交）下载去重：加密资源统一下载入口

`resourceManager.fetchDecrypted`（`:153/:160`）与 `imageCache.fetchBytes`（`:243/:250`）
各写了一份几乎相同的「`getKey` → `buildCdnUrl` → `fetchBinary` → 403 重签重下」编排。
（注：两处的**失败重试策略不完全一样** —— resourceManager 是解密/解码失败后删 cacheKey
整轮重下、且 `allowKeyRetry=false` 时不再重签；imageCache 是密文解密失败删盘上那份。
这层差异**留在调用方**，不并入新函数。）

`fetchBinary` **本身不动** —— 它是纯传输层（只发 `uni.request` 拿 arraybuffer），
在 `services/http/` 里是干净的叶子节点。把 `getKey` / `buildCdnUrl` / `decryptZukan` /
403 重签塞进去会让 http 层反向依赖 `session` / `resources`，破坏依赖方向。

在 `fetchBinary` **之上**新增 `src/services/resources/encryptedDownload.ts`，收口**只有**
「签名 → 下载 → 403 清 key 重签重下一次」这一真·逐字相同的块，返回**密文**，不解密：

```ts
export async function downloadEncrypted(
    remotePath: string,
    signal?: AbortSignal,
): Promise<Uint8Array> {            // 返回密文，调用方自己 decryptZukan
    const key = await getKey();
    let { cdn } = key;
    try {
        return await fetchBinary(buildCdnUrl(remotePath, cdn), { signal });
    } catch (err) {
        if (err instanceof BinaryRequestError && err.statusCode === 403) {
            clearKeyCache();
            cdn = (await getKey()).cdn;
            return await fetchBinary(buildCdnUrl(remotePath, cdn), { signal });
        }
        throw err;
    }
}
```

**选定的方案 A（只收口网络 + 签名，返回密文）**，不连解密一起收口。理由：

- 解密之后两边走完全不同的路（resourceManager 接解码器，imageCache 接 `sniffImageMime`
  + `createImageObjectUrl`），把解密绑进去会让下游差异被吞进函数、难读。
- 403 重签是两段**真正逐字相同**的部分，只收口它就消掉了重复。
- dek 由调用方各取：`getKey()` 内部有 `keyPromise` 单例缓存，多调一次几乎零成本。

调用方改动：
```ts
// resourceManager.fetchDecrypted：存储命中直接用，miss 才 downloadEncrypted
bytes = await downloadEncrypted(spec.remotePath);
// imageCache.fetchBytes
encrypted = await downloadEncrypted(remotePath, signal);
```

`decryptZukan` 仍在调用方（各自的解密后处理不同）。

这一步是**纯重构，不解决任何功能问题**，且动 `imageCache` 的下载路径、和缓存不变量挨得近，
建议与主线（fs 后端，解决重下）分开提交、分开发。

## 不做 / 保持原状

- **H5 的浏览器 HTTP cache**：加密资源走不到它（签名 URL 每次变），维持 IndexedDB 存密文。
- **明文落盘**：`objectUrl.ts` 的小程序落地（明文临时文件）不碰 —— 那是 `<image>` 的原语，
  不是缓存层；新 fs 后端存的是另一份、另一路径的**密文**。
- **FB bundle 后端**：维持 `uniStorage`，不迁 fs。
- **`spriteAvailability`**：几百字节的 variant 记录，全平台已启用，不碰。

## 未定的问题 / 风险

1. **fs 后端的注入点在哪一层。** `spritePersist.ts` 现在 `createImagePersist(imageKindSpec('pokemon'), MAX_BYTES)`，
   注入 fs 后端要在这里传第三个参数。但 fs 后端实例要判 `USER_DATA_PATH` 是否存在 ——
   在 `spritePersist.ts` 模块顶层就创建 fs 后端，H5 上会走到「`USER_DATA_PATH` 不存在」分支。
   解法：**fs 后端工厂内部自判**，`USER_DATA_PATH` 不存在时返回一个恒 miss / 恒 no-op 的
   退化后端（等同现在的 no-op），而不是让调用方判平台。这样 `spritePersist.ts` 只需
   `createImagePersist(spec, budget, fsStorage())` 一行，工厂自己兜底。
   > 更干净：把「按 `storageBackend` 选持久化后端」的逻辑收敛成一个 `imageStorageProvider`，
   > `isPersistable()` 与注入都读它，避免 `imagePersist` 和 `spritePersist` 各判一次。

2. **`keys()` 用磁盘枚举的往返映射会不会出错。** 已给方案（纯函数 `keyToFileName` /
   `fileNameToKey` 互逆 + 单测断言）。但要注意 `:` 替换成 `_` 后可能**非单射** ——
   若原始 key 里已有 `_`，正向往返会歧义。当前 key 格式（`sprite:v1:123/front`、
   `item-img:v1:12`、`battle-img:sM6:items/foo`）里没有下划线，暂时安全；
   但 `battle` 的 key 含 `encodeURIComponent` 的英文显示名，**可能含下划线**
   （如 `Pokémon_Ball`）。一旦有下划线，`fileNameToKey` 就还原不出原名。
   > **风险点，需在实现前定方案**：要么用 base64 编码 key 做文件名（无损但不可读、
   > 调试困难），要么用不可出现在 key 里的占位序列（如 `:` → `%3A`、`/` → `%2F`、
   > `_` → `%5F`，全转义后单射）。推荐**全转义**，调试时也可读。

3. **mtime 淘汰的时钟回拨。** `statSync().lastModifiedTime` 是 UNIX 秒。若用户在小程序里
   改了系统时间导致 mtime 回拨，「新缓存的」可能比「旧缓存的」mtime 还旧，被淘汰顺序错乱。
   影响有限（最坏是一次淘汰删错了相对顺序），且下一次 saveBytes 会刷新 mtime 自愈。
   不值得为它加复杂度，记一笔即可。

4. **预算 40MB 是否够。** 一图密文约 2–300 KB（front 约 1.9 KB、home 约 122 KB 解密后；
   密文略大于明文）。40MB 约容 100–200 张 home 级图，或上千张 front。
   配合「前 100 号保护」+ mtime 淘汰，首屏与常用图能常驻。数值最终由 `CACHE_CONFIG` 定，
   可调。

5. **首次启动 reconcile 的成本。** fs 的 `keys()` 是 `readdirSync`（同步、一次读完），
   比 IDB 的 `getAllKeys` 便宜；但 reconcile 在首次加载每张图时触发一次（`reconciled` 标志
   保证只跑一次）。几十 MB / 几百文件量级，`readdirSync` 可接受。
   > 注意：`readdirSync` 是**同步阻塞**，在小程序主线程跑。几百文件没问题，
   > 但 reconcile 不应放在首张图的关键路径上 —— 现有 `reconcile()` 已经 `void (async()=>{...})()`
   > 不 await，保持这个模式，磁盘枚举放在异步回调里。

## 测试要点

- **fs 后端单测**（node 环境无 uni，需 `vi.stubGlobal('uni', ...)` + 假 FileSystemManager）：
  五方法的正常路径 + `readFileSync` 返回 `string` vs `ArrayBuffer` 的判别分支 + 文件不存在返 null。
- **key↔filename 映射单测**：`fileNameToKey(keyToFileName(k)) === k` 对 sprite / item /
  battle（含下划线 / 斜杠 / 冒号 / 中文 / 空格）多种 key 全断言。**这一条锁住第 2 个风险点**，
  映射写错这里第一时间红。
- **imagePersist 测试补 fs 后端分支**：现有 `spritePersist.spec.ts` 覆盖「非 IDB no-op」，
  要加「fs 后端启用」一条，断言 saveBytes 真写了、loadBytes 能读回、evictToBudget 按 mtime 淘汰、
  保护集（id ≤ 100）在非保护项删完前不被动。
- **按项目约定：写完把 bug 注回去确认变红** —— 至少注这几处：
  映射非单射（下划线歧义）/ mtime 淘汰退回插入序 / 保护集被误删 /
  `readFileSync` 拿到 string 当成 ArrayBuffer 用。

## 落地顺序

1. `cacheConfig.ts`（配置源）+ `binaryStorage` 的 fs 后端（含 key↔filename 映射 + 单测）
2. `imagePersist` 注入后端 + `isPersistable()` + mtime 淘汰 + 保护集
3. `spritePersist` 从配置取预算、注入 fs 后端
4. 只在小程序 **sprite 一种** 上验证最小闭环（进页面 → 重进 → 不重下），
   用 devtools 页的资源探测器或 Network 面板确认第二次进页面不再发请求；再扩到道具 / 对战
5. （可选）第 4 步的去重重构，单独提交

## 相关文件

- `src/infra/storage/binaryStorage.ts` —— 新增 fs 后端（含 key↔filename 映射），`storageBackend` 加 `'fs'`
- `src/services/resources/imagePersist.ts` —— 注入后端，`isIdbBackend` → `isPersistable`，mtime 淘汰 + 保护集
- `src/services/resources/spritePersist.ts` —— 预算改从配置取、注入 fs 后端
- `src/services/resources/itemImage.ts` —— 道具图标持久层（第二步扩展时同改）
- `src/services/resources/imageKind.ts` —— `persistRoot` 前缀（`sprite:` / `item-img:`）
- `src/services/resources/imageCache.ts` —— `fetchBytes` 的下载编排（第 4 步重构点）
- `src/services/resources/resourceManager.ts` —— `fetchDecrypted`（第 4 步重构点）
- `src/services/http/binaryRequest.ts` —— `fetchBinary`，**不动**
- `src/services/resources/objectUrl.ts` —— 明文临时落地（`zukan-img/`），不碰
- `src/constants/cacheConfig.ts` —— **新增**，预算 / 保护集配置单一源
