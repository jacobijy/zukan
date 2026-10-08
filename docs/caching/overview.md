# 缓存总览

应用内全部缓存的一张速查表。各缓存的不变量与实现细节见：

- [resource-cache.md](./resource-cache.md) — FlatBuffers 数据 bundle（resourceManager）
- [sprite-cache.md](./sprite-cache.md) — 加密图片（imageCache / imagePersist：sprite、道具、对战图标）与全部调度/持久化不变量
- [fs-backend-plan.md](./fs-backend-plan.md) — 小程序 / App 的 fs 持久化后端

| 缓存 | 文件 | 层级 | 持久化 | 版本失效 |
|------|------|------|--------|----------|
| FB bundle 解码结果 | `resourceManager.ts` | 内存 LRU（12 条） | — | 版本号变化 |
| FB bundle 密文 | `resourceManager.ts` via `binaryStorage` | IndexedDB | 跨刷新 | `pruneOtherVersions` |
| sprite Blob URL | `spriteCache.ts`（`imageCache` pokemon 实例） | 内存 LRU（320 条） | — | 刷新即清空 |
| sprite 密文 | `spritePersist.ts`（`imagePersist` pokemon 实例）via 注入的存储后端 | H5: IDB / 小程序·App: fs（`USER_DATA_PATH`，200MB） | 跨刷新 | `pruneSpriteVersions` |
| sprite 回落落点 | `spriteAvailability.ts` via `uni storage`（key `zukan_sprite_avail`） | KV（**全平台**，仅几百字节） | 跨刷新 | `pruneSpriteAvailability` |
| 道具图标 Blob URL | `itemImage.ts`（`imageCache` item 实例） | 内存 LRU（200 条） | — | 刷新即清空 |
| 道具图标密文 | `itemImage.ts`（`imagePersist` item 实例，前缀 `item-img:`）via `binaryStorage` | IndexedDB（仅 IDB 后端，未开 fs） | 跨刷新 | `pruneItemIconVersions` |
| 对战图标（道具已接） | `battleImage.ts`（字符串键、按赛季实例，root `battle-img:s<season>:`） | 内存 LRU 300 + IDB 密文（仅 IDB） | 跨刷新 | 换赛季路径/root 变，reconcile 清旧 |
| 对战数据 JSON（当前季） | `services/meta/service.ts`（module promise 缓存） | 内存（module） | — | 建议按 `meta.dataVersion` 失效（待接） |
| 对战数据 JSON（历史季） | `services/meta/service.ts` 按 `${season}:...` 缓存 | 内存（module） | — | 数据 immutable，无失效需求 |
| 密钥 DEK | `session/key.ts` | 内存单例 | — | 登出 / 403 重签 |

注意：

- dev 下 FB bundle 的两层缓存与图片密文持久化默认全部 no-op（进程内 Map），详见
  [resource-cache.md「dev 下的两层缓存都不跨刷新」](./resource-cache.md)。
- 版本号来自 `GET /api/v1/zukan/key`，FB bundle 与 sprite 密文共用同一版本前缀，
  DEK 轮换时一起失效。
