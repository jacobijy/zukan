# 数据 bundle 缓存（resourceManager）

`src/services/resources/resourceManager.ts` 管 FlatBuffers 数据 bundle（gen-N、moves、i18n 等）的
加载与缓存。图片缓存见 [./sprite-cache.md](./sprite-cache.md)，加密格式见
[../security/encryption-pipeline.md](../security/encryption-pipeline.md)。

## 加载链

```
memory LRU(12，解码结果) → inflight 去重 → binaryStorage(IDB / MP storage，密文) → 网络 → 解密 → 解码
```

1. **内存 LRU**：`memoryCache` 存解码后的 bundle 对象，上限 `MEMORY_LRU_CAP = 12`（bundle 体积大，保守）。
   命中后移到末尾实现 LRU。
2. **inflight 去重**：同一 `cacheKey` 的并发请求只发一次网络，共享同一个 promise。
3. **二进制持久层** `binaryStorage`：
   - H5 → IndexedDB（DB `zukan-fb`，store `blobs`，key=string，value=Uint8Array）；
   - 小程序 → `uni.setStorage`（base64 桥接，约 1MB/key、10MB 总量，quota 错静默）。
4. **网络**：`fetchBinary(buildCdnUrl(remotePath, cdn))`，见加密文档第 3 节。
5. **失败重试一次**：解密/解码失败（DEK 轮换 / schema drift）删掉该 key 持久字节，重下重解一次。
6. `prefetch*` 与 `get*` 共享 inflight，错误静默（fire-and-forget）。

## cacheKey 与版本前缀

```
fb:v{version}:<kind>:<...>
例：fb:v1:gen:9
    fb:v1:i18n:names:zh-hans
```

- `version` 来自 `GET /api/v1/zukan/key`，`boot.ts` 写进 `dataVersion` 存储，
  `currentDataVersion()` 派生前缀。
- 数据 bundle 和 sprite 密文**共用同一个版本号前缀**，DEK 轮换时一起失效。

## 版本失效

`boot.ts` 启动时比对服务端 version 与本地 `zukan_data_version`：
- 不一致 → `resourceManager.pruneOtherVersions(newVersion)` 删旧前缀的持久字节（同时驱动
  `spritePersist.pruneSpriteVersions`）→ 写新版本号。
- 内存 LRU 由 `pruneOtherVersions` 整体清空。

各缓存的失效时机见加密文档第 6.4 节的版本失效总览表。

## dev 下的两层缓存都不跨刷新

本地开发换源重打包时，不想 bump 版本号 / 手动清站点数据，故 dev 把两层缓存都关掉：

1. **应用缓存**（`binaryStorage`）：`import.meta.env.DEV` 下后端选用进程内 `Map`、
   `storageBackend` 报 `'memory'`，刷新即空；图片密文持久层据 `storageBackend !== 'idb'`
   整体 no-op。控制台设 `localStorage['zukan:dev-persist']='1'` 可恢复真实 IndexedDB。
2. **浏览器 HTTP 缓存**：服务端对 `/assets/encrypted/*` 下发 `immutable, max-age=31536000`。
   生产靠 CDN 签名 token（`?sign&t`）换 URL 绕开；**本地 dev 无 token、URL 固定**，普通刷新
   仍可能命中磁盘 HTTP 缓存。故 `binaryRequest.buildUrl` 在 dev 下给 URL 加每次页面加载
   变化的 `_dc=<ts>` 参数强制重新校验（ServeDir 忽略 query；小程序端无害）。

## 新增 bundle 类型

① FlatBuffers schema + `flatc` 重生成 ② 后端 `sync-*.py` 打包 ③ WASM 加解码器 + `index.ts` 导出
④ 在 `resourceManager` 加 `BundleSpec`（cacheKey + remotePath）/ getter / prefetch
⑤ 更新 [../data/bundle-decode.md](../data/bundle-decode.md) 的清单表。

## 相关文件

- `src/services/resources/resourceManager.ts`
- `src/services/resources/dataVersion.ts` —— 版本号读写
- `src/infra/storage/binaryStorage.ts` —— 跨平台二进制存储
- `src/services/boot.ts` —— 启动比对版本、prune、prefetch
