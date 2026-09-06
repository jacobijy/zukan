# 加密图片缓存（imageCache / imagePersist：sprite 与道具图标）

宝可梦立绘（sprite）与**道具图标**走同一条加密图片通道，与数据 bundle 相互独立。
引擎与种类无关，两类资源各自一个实例：

| 种类 | 远端密文 | 内存 Blob URL | 跨刷新密文 |
|------|----------|---------------|------------|
| 宝可梦立绘 pokemon | `/assets/encrypted/pokemon/<id>/<variant>.bin` | `spriteCache.ts`（**320** 条，约 20–30 MB） | `spritePersist.ts`（前缀 `sprite:`，预算 60 MB） |
| 道具图标 item | `/assets/encrypted/items/<id>.bin`（扁平、无 variant） | `itemImage.ts`（200 条） | `itemImage.ts`（前缀 `item-img:`，预算 8 MB） |

> sprite 是 320 而非 200：渐进式加载让一张卡最多占两个 key（低清 preview + 高清），
> 详见下文「渐进式两段加载」。

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
- `spriteLoader.ts` / `constants/spriteVariants.ts` — **仅 sprite**：低清先行 +
  404 回落链的编排与常量（见下文）。item 不参与，plan 退化为「无 preview、单项 chain」。

合起来的链对两类都一样：`内存 Blob URL → IDB 密文 → 网络`。组件不直接碰缓存：
视口感知 / 懒加载 / 离屏取消 / 引用配对在 `composables/useEncryptedImage.ts`，
`EncryptedSprite.vue`（pokemon）与 `archive/ItemIcon.vue`（item）只负责把状态渲染成
图片 / 骨架 / 兜底（sprite → 回落链走完仍无图才 `/static/default.png`，item → 中性占位盒）。

> 历史教训：缓存曾写在 `EncryptedSprite.vue` 的 `<script setup>` 顶层，编译后落在
> `setup()` 内部 → 每实例一份空 Map，命中率恒为 0、Blob URL 永不 revoke。跨实例共享的
> 状态必须放独立 `.ts` 模块（见 [../ui/component-conventions.md](../ui/component-conventions.md)）。

## 三条调度不变量（别改坏）

引擎 key = `<kind>:<id>/<variant>`（item 的 variant 恒为占位串 `icon`），值是 `{ url, refs }`。

1. **限流 4 并发**。不限流时几十个请求同时丢给浏览器，浏览器 FIFO 排队，当前视口排在已划过去的行后面。
   （H5 单域 6 连接，留余量给 FB bundle；解密是主线程 WASM。）
2. **优先级 → 批间 LIFO → 批内 FIFO**。出队排序键是 **`(priority, batch, seq)`**：
   `priority` 大优先（默认 0，渐进式 preview 传 1）→ `batch` 大优先（每帧自增）→ 同批 `seq` 小优先。
   - 批内必须 FIFO：纯 LIFO 会让首屏「从下往上」冒。
   - 批间必须 LIFO：纯 FIFO 则退回原 bug（视口排在旧行后面）。
   - **`priority` 必须凌驾于 `batch` 之上**：第 1 张卡的 preview 一结算就入队它的高清图，
     而那是个**更新的 batch**，若只按 `(batch, seq)` 排就会插到其余卡还在排队的 preview
     前面，退化成「第一张先高清、其余仍黑着」，恰好毁掉「先用低清点亮整屏」的目的。
   - 同一张图被不同 priority 的调用方同时要时**取 max**（提权已入队的 job），
     否则先到的低优先级会把后来的急件压在队尾。
3. **离屏取消**。组件的 IntersectionObserver **不是一次性的** —— 滑出视口 abort
   在途请求腾出槽位。多 waiter 时只有 waiters 归零才真取消，否则列表卡片卸载会连累详情页同一张。

**引用计数**：`acquire*` refs++，`release*` refs--。同一张可能被列表 + 详情同时引用，
refs 归零才允许 LRU 淘汰（淘汰即 `revokeObjectURL`；在屏的图 refs>0 不会被撤，撤了就裂图）。

取消抛中止错误（pokemon 侧 `SpriteAbortError`，是引擎 `ImageAbortError` 的子类），
组件据此保持骨架屏（不显示兜底图），等下次进视口重来。

## 渐进式两段加载（仅 sprite）

服务器上同一形态的 `front`（96×96，约 **1.9 KB**）与 `home`（512×512，约 **122 KB**）
差约 65 倍，而列表卡只渲染 64–70px。所以先拉 `front` 点亮整屏（一屏 20 张约 38 KB），
再后台换高清。体积实测见
[../security/encryption-pipeline.md](../security/encryption-pipeline.md) 第 4.2 节。

分层（每层只做一件事，别把编排塞回组件）：

| 层 | 文件 | 职责 |
|----|------|------|
| 常量 | `constants/spriteVariants.ts` | `SPRITE_PREVIEW` / `SPRITE_FALLBACKS` / `buildSpriteChain`（**唯一定义处**） |
| 编排 | `services/resources/spriteLoader.ts` | `loadSpriteChain`：preview 先行 + 404 回落链。**纯函数、无 Vue 依赖** |
| 生命周期 | `composables/useEncryptedImage.ts` | 视口懒加载 / 离屏取消 / 引用配对，把编排结果映射成渲染状态 |
| 渲染 | `components/sprite/EncryptedSprite.vue` | 图片 / 骨架 / 兜底三态 |

编排刻意不写进 composable：`vitest.config.ts` 是 `environment: 'node'`，项目没装
`@vue/test-utils` / happy-dom，写在 `onMounted` 里的逻辑跑不了用例。纯函数版本用假
deps 就能覆盖全部分支（`tests/spriteLoader.spec.ts`）。

### 三条约定

1. **引用所有权单向移交，不许两边都记**。加载途中 preview 的引用归 `loadSpriteChain`，
   `loadSpriteChain` 返回后才交给 composable 的 `held`。两边都记的话，「preview 已上屏
   → 组件卸载」会被归还两次，把别人的 refs 扣成 0 → 在屏图被 revoke → 裂图。
   返回 `stale` / 抛错时**引用已由 `loadSpriteChain` 全部归还**，调用方不得再 release。
2. **preview 的 404 静默，链上的 404 才回落**。某些 id 有 home 无 front（如 10301），
   preview 失败不该拖累主图、也不该打日志。但**非 404 错误一律立即抛出** ——
   同一把 DEK 解不开 front 就解不开 home，把它当"没图"会把真故障伪装成数据缺口。
3. **LRU 上限要容得下一屏的两倍**。一张卡最多占两个 key（preview + full），
   `SPRITE_MAX_ENTRIES = 320`（原 200）—— 太小会让 preview 刚点亮就被自己的 full 挤掉。
   该常量已导出，用例断言直接引用它，改一处不会留下写死的数字。

`hasSprite === false`（数据层已知无正面图）时**一个请求都不发**，直接落占位图。

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

不是每个 id 都有对应 `.bin`。404 不算解密失败：引擎抛 `BinaryRequestError(404)`。

- **sprite**：`loadSpriteChain` 按 `home → artwork → front` 逐个试，**整条链都 404**
  才由 composable 降级为 warn（`无资源`）并置 `failed` → 回退 `/static/default.png`。
  数字 id 里缺 `home` 的 10 个中有 8 个能靠 artwork 救回来。
  preview 的 404 **静默处理**，不打日志、不影响主图。
- **道具图标**：无 variant 概念，404 即回落中性占位盒。

缺口清单与实测口径见
[../security/encryption-pipeline.md](../security/encryption-pipeline.md) 第 4.3 节。

## 测试

```bash
pnpm test -- spriteCache spritePersist itemImage spriteLoader spriteVariants
```

- `spriteCache.spec.ts` / `spritePersist.spec.ts` —— 引擎的限流 / 调度 / 引用计数 /
  落盘自愈（走 pokemon 薄封装）。**含调度优先级一组**：priority 压过 batch、
  同 priority 内仍 LIFO/FIFO、同 key 取 max、不传 priority 行为不变。
- `spriteLoader.spec.ts` —— preview + 回落链编排。假 deps，每个用例都对账引用数
  （漏 release = 静默泄漏，多 release = 裂图）。
- `spriteVariants.spec.ts` —— chain 构造：主 variant 恒为首项、去重。
- `itemImage.spec.ts` —— item 接线差异：扁平远端路径、与 sprite 缓存相互独立、
  404 契约、`item-img:` 前缀的跨刷新密文。

改限流 / 调度 / 引用计数 / 落盘自愈 / 回落链时别跳过。测数据要覆盖：多 waiter 取消、
离屏 abort、索引与数据不一致两种方向、非 IDB 后端 no-op、以及 **stale 时两槽引用都归还**。

> LRU 上限的断言引用导出的 `SPRITE_MAX_ENTRIES`，不要写死数字 ——
> 这个常量因渐进式加载从 200 调到 320 时，写死 200 的三个用例集体变红过。

> 按项目测试约定：**写完把 bug 注回去确认它变红**。本次逐个验证过 6 处变异
> （去掉 priority 排序 / 去掉取 max / 三处漏 release / 把非 404 当没图 / 去掉 preview 去重）
> 都能被捕获；其中「去掉取 max」第一版用例**没抓住**，改成跨 batch 场景后才生效。
