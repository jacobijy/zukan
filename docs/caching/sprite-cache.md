# 图片缓存（spriteCache / spritePersist）

精灵图走独立于数据 bundle 的缓存通道，两个模块各管一层：

| 模块 | 层 | 持久化 | 内容 |
|------|----|--------|------|
| `spriteCache.ts` | 内存 Blob URL LRU（200 条，约 20–30 MB） | 否（刷新清空） | 解密后的 PNG → `URL.createObjectURL` |
| `spritePersist.ts` | IndexedDB 密文 | 跨刷新 | **ZKDX 密文**，非明文 PNG |

合起来的链：`内存 Blob URL → IDB 密文 → 网络`。组件 `EncryptedSprite.vue` 只管视口检测，
缓存/解密/Blob URL 生命周期都在这两个 `.ts` 模块里。

> 历史教训：这套曾写在 `EncryptedSprite.vue` 的 `<script setup>` 顶层，编译后落在 `setup()` 内部 →
> 每实例一份空 Map，命中率恒为 0、Blob URL 永不 revoke。跨实例共享的状态必须放独立 `.ts` 模块
> （见 [../ui/component-conventions.md](../ui/component-conventions.md)）。

## spriteCache 三条不变量（别改坏）

key = `${pokemonId}/${variant}`，值是 `{ url, refs }`。

1. **限流 4 并发**。不限流时几十个请求同时丢给浏览器，浏览器 FIFO 排队，当前视口排在已划过去的行后面。
   （H5 单域 6 连接，留余量给 FB bundle；解密是主线程 WASM。）
2. **批内 FIFO，批间 LIFO**。`batch` 每帧自增，取任务时 batch 最大优先、同批 seq 最小优先。
   纯 LIFO 会让首屏「从下往上」冒；纯 FIFO 则退回原 bug（视口排在旧行后面）。
3. **离屏取消**。`EncryptedSprite` 的 IntersectionObserver **不是一次性的** —— 滑出视口 abort
   在途请求腾出槽位。多 waiter 时只有 waiters 归零才真取消，否则列表卡片卸载会连累详情页同一只。

**引用计数**：`acquireSprite` refs++，`releaseSprite` refs--。同一只可能被列表 + 详情同时引用，
refs 归零才允许 LRU 淘汰（淘汰即 `revokeObjectURL`；在屏的图 refs>0 不会被撤，撤了就裂图）。

取消抛 `SpriteAbortError`，`EncryptedSprite` 据此保持骨架屏（不显示默认图），等下次进视口重来。

## spritePersist 四条不变量

`spriteCache` 只有内存，刷新即清空；本模块加一层跨刷新持久化。

1. **落盘的是 ZKDX 密文，不是解密后的 PNG。** 存明文等于把加密资源以可直接使用的形式留在用户磁盘，
   加密链路白做。
2. **只在 `storageBackend === 'idb'`（H5）启用。** 小程序 `uni.setStorage` 总量约 10MB，塞 sprite
   会把 FB 主数据顶出配额。非 IDB 后端全模块 no-op。
3. **索引（localStorage）与数据（IDB）是两条独立写入，必然短暂不一致**，两个方向都要自愈：
   - 索引有 / 数据无 → 按 miss 走网络并摘掉幽灵索引项；
   - 数据有 / 索引无 → 开局 `reconcile()` 对账删孤儿。
4. **`clearSpriteCache()`（登出）刻意不清磁盘。** 密文没 DEK 解不开，不构成泄露，留着下次登录命中。
   版本升级清盘走 `pruneSpriteVersions`（由 `resourceManager.pruneOtherVersions` 调用）。

预算 60 MB（约 460 张），按插入序 FIFO 淘汰（LRU 每次命中要回写索引，多一次 IDB 往返，不值）。
索引 key `zukan_sprite_index`，落盘带 500ms 防抖。

## 图片缺失

不是每个 pokemon id 都有 `home.bin`，404 回退 `/static/default.png`，控制台打 `无立绘资源`。
16 个已知缺口与 id 清单见 [../security/encryption-pipeline.md](../security/encryption-pipeline.md) 第 4.3 节。

## 测试

```bash
pnpm test -- spriteCache spritePersist
```

改限流/调度/引用计数/落盘自愈时别跳过。测数据要覆盖：多 waiter 取消、离屏 abort、索引与数据不一致两种方向、
非 IDB 后端 no-op。
