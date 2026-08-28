# 加密图片缓存（imageCache / imagePersist：sprite 与道具图标）

宝可梦立绘（sprite）与**道具图标**走同一条加密图片通道，与数据 bundle 相互独立。
引擎与种类无关，两类资源各自一个实例：

| 种类 | 远端密文 | 内存 Blob URL | 跨刷新密文 |
|------|----------|---------------|------------|
| 宝可梦立绘 pokemon | `/assets/encrypted/pokemon/<id>/<variant>.bin` | `spriteCache.ts`（200 条，约 20–30 MB） | `spritePersist.ts`（前缀 `sprite:`，预算 60 MB） |
| 道具图标 item | `/assets/encrypted/items/<id>.bin`（扁平、无 variant） | `itemImage.ts`（200 条） | `itemImage.ts`（前缀 `item-img:`，预算 8 MB） |

## 模块结构

通用逻辑在两个工厂里，与种类无关；差异（远端路径 / MIME / 持久化前缀 / 预算）由
`imageKind.ts` 的 `ImageKindSpec` 注入：

- `imageCache.ts` — `createImageCache(spec, persist, opts)`：限流调度 + 引用计数 +
  内存 LRU + 离屏取消。每种类一个实例，LRU / 任务队列 / 并发槽互不影响。
- `imagePersist.ts` — `createImagePersist(spec, maxBytes)`：IndexedDB 密文持久化。
  每种类独立索引 / 预算 / 对账状态，**道具图不挤占 sprite 的 60MB 配额**。
- `imageKind.ts` — `IMAGE_KINDS.pokemon` / `.item`：远端路径函数、MIME、
  `persistRoot`（磁盘 key 前缀）、`indexStorageKey`（uni storage 索引 key）。
- `spriteCache.ts` / `spritePersist.ts` — pokemon 实例的**薄封装**，保留
  `acquireSprite` / `releaseSprite` / `clearSpriteCache` / `pruneSpriteVersions` 等
  历史名字与签名（用例与调用方无需改动）。
- `itemImage.ts` — item 实例：`acquireItemIcon(id)` / `releaseItemIcon(id)` /
  `clearItemIconCache()` / `pruneItemIconVersions(v)`。

合起来的链对两类都一样：`内存 Blob URL → IDB 密文 → 网络`。组件不直接碰缓存：
视口感知 / 懒加载 / 离屏取消 / 引用配对在 `composables/useEncryptedImage.ts`，
`EncryptedSprite.vue`（pokemon）与 `archive/ItemIcon.vue`（item）只负责把状态渲染成
图片 / 骨架 / 兜底（sprite → `/static/default.png`，item → 中性占位盒）。

> 历史教训：缓存曾写在 `EncryptedSprite.vue` 的 `<script setup>` 顶层，编译后落在
> `setup()` 内部 → 每实例一份空 Map，命中率恒为 0、Blob URL 永不 revoke。跨实例共享的
> 状态必须放独立 `.ts` 模块（见 [../ui/component-conventions.md](../ui/component-conventions.md)）。

## 三条调度不变量（别改坏）

引擎 key = `<kind>:<id>/<variant>`（item 的 variant 恒为占位串 `icon`），值是 `{ url, refs }`。

1. **限流 4 并发**。不限流时几十个请求同时丢给浏览器，浏览器 FIFO 排队，当前视口排在已划过去的行后面。
   （H5 单域 6 连接，留余量给 FB bundle；解密是主线程 WASM。）
2. **批内 FIFO，批间 LIFO**。`batch` 每帧自增，取任务时 batch 最大优先、同批 seq 最小优先。
   纯 LIFO 会让首屏「从下往上」冒；纯 FIFO 则退回原 bug（视口排在旧行后面）。
3. **离屏取消**。组件的 IntersectionObserver **不是一次性的** —— 滑出视口 abort
   在途请求腾出槽位。多 waiter 时只有 waiters 归零才真取消，否则列表卡片卸载会连累详情页同一张。

**引用计数**：`acquire*` refs++，`release*` refs--。同一张可能被列表 + 详情同时引用，
refs 归零才允许 LRU 淘汰（淘汰即 `revokeObjectURL`；在屏的图 refs>0 不会被撤，撤了就裂图）。

取消抛中止错误（pokemon 侧 `SpriteAbortError`，是引擎 `ImageAbortError` 的子类），
组件据此保持骨架屏（不显示兜底图），等下次进视口重来。

## 持久化四条不变量

内存缓存刷新即清空；持久层加一层跨刷新密文。

1. **落盘的是 ZKDX 密文，不是解密后的图片。** 存明文等于把加密资源以可直接使用的形式留在用户磁盘，
   加密链路白做。
2. **只在 `storageBackend === 'idb'`（H5）启用。** 小程序 `uni.setStorage` 总量约 10MB，塞图片
   会把 FB 主数据顶出配额。非 IDB 后端全模块 no-op。
3. **索引（uni storage）与数据（IDB）是两条独立写入，必然短暂不一致**，两个方向都要自愈：
   - 索引有 / 数据无 → 按 miss 走网络并摘掉幽灵索引项；
   - 数据有 / 索引无 → 开局 `reconcile()` 对账删孤儿。
4. **内存 `clear*()`（登出）刻意不清磁盘。** 密文没 DEK 解不开，不构成泄露，留着下次登录命中。
   版本升级清盘走 `prune*Versions`（由 `resourceManager.pruneOtherVersions` 调用，sprite 与 item
   **各清各的前缀**，与 FB bundle 同一版本号同步失效）。

按插入序 FIFO 淘汰（LRU 每次命中要回写索引，多一次 IDB 往返，不值），索引落盘带 500ms 防抖。
磁盘 key 形如 `<root>v<ver>:<id>[/<variant>]`（pokemon 带 variant，item 不带）；
索引 key sprite 为 `zukan_sprite_index`、item 为 `zukan_item_img_index`。

## 图片缺失

不是每个 id 都有对应 `.bin`。404 不算解密失败：引擎抛 `BinaryRequestError(404)`，
composable 降级为 warn 并置 `failed` —— sprite 回退 `/static/default.png`，
道具图标回落中性占位盒。sprite 的 16 个已知立绘缺口见
[../security/encryption-pipeline.md](../security/encryption-pipeline.md) 第 4.3 节。

## 测试

```bash
pnpm test -- spriteCache spritePersist itemImage
```

引擎的限流 / 调度 / 引用计数 / 落盘自愈由 `spriteCache.spec.ts` / `spritePersist.spec.ts`
覆盖（走 pokemon 薄封装）；`itemImage.spec.ts` 只守 item 接线差异：扁平远端路径
`/assets/encrypted/items/<id>.bin`、与 sprite 缓存相互独立、404 契约、`item-img:` 前缀的
跨刷新密文。改限流/调度/引用计数/落盘自愈时别跳过。测数据要覆盖：多 waiter 取消、
离屏 abort、索引与数据不一致两种方向、非 IDB 后端 no-op。
