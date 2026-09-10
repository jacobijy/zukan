# 加密图片缓存（imageCache / imagePersist：sprite 与道具图标）

宝可梦立绘（sprite）与**道具图标**走同一条加密图片通道，与数据 bundle 相互独立。
引擎与种类无关，两类资源各自一个实例：

| 种类 | 远端密文 | 内存 Blob URL | 跨刷新密文 |
|------|----------|---------------|------------|
| 宝可梦立绘 pokemon | `/assets/encrypted/pokemon/<id>/<variant>.bin` | `spriteCache.ts`（**320** 条，约 20–30 MB） | `spritePersist.ts`（前缀 `sprite:`，预算 60 MB） |
| 道具图标 item | `/assets/encrypted/items/<id>.bin`（扁平、无 variant） | `itemImage.ts`（200 条） | `itemImage.ts`（前缀 `item-img:`，预算 8 MB） |

> sprite 是 320 而非 200：渐进式加载让一张卡最多占两个 key（低清 preview + 高清），
> 详见下文「渐进式两段加载」。
>
> sprite 另有一层**几百字节**的可用性记录（`spriteAvailability.ts`，全平台启用），
> 只记回落链的落点，不存图，详见下文「可用性记录」。

## 模块结构

通用逻辑在两个工厂里，与种类无关；差异（远端路径 / MIME / 持久化前缀 / 预算）由
`imageKind.ts` 的 `ImageKindSpec` 注入：

- `imageCache.ts` — `createImageCache(spec, persist, opts)`：限流调度 + 引用计数 +
  内存 LRU + 离屏取消。每种类一个实例，LRU / 任务队列 / 并发槽互不影响。
- `imagePersist.ts` — `createImagePersist(spec, maxBytes)`：IndexedDB 密文持久化。
  每种类独立索引 / 预算 / 对账状态，**道具图不挤占 sprite 的 60MB 配额**。
- `imageKind.ts` — `IMAGE_KINDS.pokemon` / `.item`：远端路径函数、MIME 兜底
  （解密后按字节嗅探真实格式，`spec.mime` 只在嗅探失败时用；详见 `imageMime.ts`）、
  `persistRoot`（磁盘 key 前缀）、`indexStorageKey`（uni storage 索引 key）。
- `spriteCache.ts` / `spritePersist.ts` — pokemon 实例的**薄封装**，保留
  `acquireSprite` / `releaseSprite` / `clearSpriteCache` / `pruneSpriteVersions` 等
  历史名字与签名（用例与调用方无需改动）。
- `itemImage.ts` — item 实例：`acquireItemIcon(id)` / `releaseItemIcon(id)` /
  `clearItemIconCache()` / `pruneItemIconVersions(v)`。
- `spriteLoader.ts` / `constants/spriteVariants.ts` — **仅 sprite**：低清先行 +
  404 回落链的编排与常量（见下文）。item 不参与，plan 退化为「无 preview、单项 chain」。
- `spriteAvailability.ts` — **仅 sprite**：按版本记住回落链的落点（见下文「可用性记录」）。
  `spriteLoader` **不直接 import 它**，而是由 composable 以 `hint` 注入 ——
  这样编排层仍无平台依赖，node 用例不必 stub 全局 `uni`。
- `imageMime.ts` — 按明文字节判定图片 MIME（PNG / JPEG / GIF / WebP / **SVG**）。
  与种类无关，`imageCache` 建 Blob 前调一次。**必须按内容判，不能按种类写死**：
  `dream` variant 全是 SVG，而浏览器对 SVG **不做内容嗅探** —— MIME 标成 image/png
  就一律不渲染，整条链其它环节都对也只得到一张裂图。栅格格式标错反而无害（浏览器
  会嗅探），所以这个 bug 只在 SVG 上暴露，藏了很久。

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
| 常量 | `constants/spriteVariants.ts` | `SPRITE_PREVIEW` / `SPRITE_FALLBACKS` / `SPRITE_SHINY_FALLBACKS` / `buildSpriteChain` / `heroVariant`（**唯一定义处**） |
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
   另有一类 404 是**有含义的**：`female` / `home-female` 只有 103 个 id 有，缺席说明
   「该形态不分性别」，所以链里给它们插一步无性别版本（`home-female → home`、
   `female → front`），插在通用回落之前。`shiny` 刻意不这样配对 —— 闪光缺失时回落
   非闪光是显示错的东西。因此闪光目标单独走 `SPRITE_SHINY_FALLBACKS`
   （`home-shiny → artwork-shiny → shiny`，全闪光，整链 404 直接落占位）。而详情页
   hero 的闪光/性别切换由 `heroVariant` 在 home 系三态（`home` / `home-female` /
   `home-shiny`）间换算，闪光的低清先行也换 `shiny`（否则先闪一下非闪配色）。
   见 [../security/encryption-pipeline.md](../security/encryption-pipeline.md) 4.3。
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
  `female` / `home-female` 的 404 是「不分性别」而非缺口，先回落无性别版本。
  闪光目标走 `SPRITE_SHINY_FALLBACKS`（全闪光链，见上文第 2 条）。
- **道具图标**：无 variant 概念，404 即回落中性占位盒。

缺口清单与实测口径见
[../security/encryption-pipeline.md](../security/encryption-pipeline.md) 第 4.3 节。

## `hasSprite` prop 是三态，缺省必须是 `undefined`（踩过一次）

`EncryptedSprite` 在**发请求前**有两条「直接落默认图、一个请求都不发」的短路：
`hasSprite === false`（数据层 FB 字段）与 `hint.noSprite`（运行时实测记录）。
前者的语义刻意做成**三态**：

- `true` / `false` —— 数据层明确知道「有 / 没有正面立绘」（`PokemonCard`、`SpecimenHero`
  显式 `:has-sprite="pokemon.hasSprite"`）；
- **缺席（`undefined`）—— 「未知，照常下载，靠 404 回落链兜」**。`EvolutionNode` 就走这条：
  `EvolutionStage` 不携带 `hasSprite`（见 [../data/bundle-decode.md](../data/bundle-decode.md)）。

**坑：Vue 的 `Boolean` prop 在「属性缺席且没有 default」时会被隐式置为 `false`，不是 `undefined`。**
于是 `skip: () => props.hasSprite === false` 把「没传」误判成「数据层确认无图」，
进化链所有节点一个请求都不发、全部渲染成 `/static/default.png`（早期一次竞态里还表现成
相邻节点同图的「张冠李戴」）。`PokemonCard` / `SpecimenHero` 因为显式传值而幸免，
唯独不传该字段的进化链 100% 中招 —— 「几乎每只宝可梦的进化链图都错」。

修复只有一行：在 `withDefaults` 里显式 `hasSprite: undefined`，让缺席保持 `undefined`。
**以后新增不传 `has-sprite` 的调用点，或有人「清理」掉这条默认值，这个 bug 会原样复发。**
判定「无图」只能信严格的 `=== false`，不能用真值判断。

## 可用性记录（spriteAvailability，仅 sprite）

`services/resources/spriteAvailability.ts`：**按资源版本**把「回落链的实际落点」记在本地 KV，
下次刷新直接从对的 variant 开始，省掉注定 404 的请求。

与数据层 `hasSprite` 的分工（两者不重复，缺一不可）：

| | `hasSprite`（FB 字段） | `spriteAvailability`（本地记录） |
|---|---|---|
| 来源 | 后端构建期扫目录 | 前端运行时实测 |
| 粒度 | 布尔「有没有正面图」 | **哪个 variant 能取到** / preview 缺 / 整链缺 |
| 载体 | 随 `gen-N.bin` 走三层缓存 | 独立 KV（`zukan_sprite_avail`） |

**只记偏差，不记全量。** 绝大多数 id 走 `home` 首发命中，那是默认行为、无需记录；
落盘的只有「首发 404 过」的条目（今天约 9 条，不到 1 KB）。若把 1300+ id 的正常结论
全存下来，索引会涨到几十 KB，而收益是零。

**所有平台都开**，与 `imagePersist` 的「仅 IDB」不同：那个存的是几十 MB 密文，
会挤爆小程序 10MB 配额；这个是几百字节，而且小程序**没有密文持久化**，反而更需要
省掉这些 404。

### 三条约定

1. **记录不是真相，只是提示。** 按记录直取的 variant 一旦 404，必须 `forget()` 掉该条
   并继续走完整条链。否则一次偶发 404（服务端临时抽风、资源刚补上前的空窗）会被永久
   固化成「这张没图」，图补上了前端也再也不去看。
2. **重排不删项。** `reorderByHint` 把命中过的 variant 提到队首，其余项**原序保留在后面**，
   不是替换成单元素链 —— 否则记录一旦过期（那个 variant 后来被删了）就彻底取不到图。
3. **只在真的偏离默认时才写。** `onResolved` 仅当本次**确实见过 404**（`sawNotFound`）
   才落盘；首发即命中不写。同理 `recordResolvedVariant` 在「记录的 variant 恰好等于主
   variant」时是**清除**记录（连带清掉过期的「整链缺」结论），而不是写一条恒真的废记录。

版本失效跟 FB bundle 同一条链：`boot.ts` → `resourceManager.pruneOtherVersions(keep)`
→ `pruneSpriteAvailability(keep)`（版本号不符即整表丢弃，**同步落盘**，不走 500ms 防抖，
避免刷新竞态）。日常写入与索引一样带 500ms 防抖。

## 测试

```bash
pnpm test -- spriteCache spritePersist itemImage spriteLoader spriteVariants spriteAvailability imageMime
```

- `spriteCache.spec.ts` / `spritePersist.spec.ts` —— 引擎的限流 / 调度 / 引用计数 /
  落盘自愈（走 pokemon 薄封装）。**含调度优先级一组**：priority 压过 batch、
  同 priority 内仍 LIFO/FIFO、同 key 取 max、不传 priority 行为不变。
  **另含 Blob MIME 一组**：SVG 明文标 `image/svg+xml`、PNG 仍标 `image/png`、
  嗅探不出时退回种类默认值。
- `imageMime.spec.ts` —— 格式嗅探本身。重点是 SVG（含 BOM / 前导空白 / `<?xml` 声明
  这些真实产物形态），以及**不能把 HTML 错误页误判成 SVG** —— 把错误页当图渲染会
  掩盖真故障，比不渲染更糟。
- `spriteLoader.spec.ts` —— preview + 回落链编排。假 deps，每个用例都对账引用数
  （漏 release = 静默泄漏，多 release = 裂图）。**含 hint 一组**：按记录重排、
  记录过期时仍能靠后续项救回、只在见过 404 时才回写、`noPreview` 跳过低清段。
- `spriteVariants.spec.ts` —— chain 构造：主 variant 恒为首项、去重、**性别回落**
  （无性别版本插在通用回落之前、shiny 不配对、回落目标必在 catalog 内）。
- `spriteAvailability.spec.ts` —— 记录层本身：版本不符整表丢弃、条目空了删 key、
  防抖落盘、坏 JSON / 坏结构回落空表、`forget` 与自命中清除。
  （`environment: 'node'` 没有 uni，用例自行 `vi.stubGlobal('uni', …)` + 假定时器。）
- `itemImage.spec.ts` —— item 接线差异：扁平远端路径、与 sprite 缓存相互独立、
  404 契约、`item-img:` 前缀的跨刷新密文。

改限流 / 调度 / 引用计数 / 落盘自愈 / 回落链时别跳过。测数据要覆盖：多 waiter 取消、
离屏 abort、索引与数据不一致两种方向、非 IDB 后端 no-op、以及 **stale 时两槽引用都归还**。

> LRU 上限的断言引用导出的 `SPRITE_MAX_ENTRIES`，不要写死数字 ——
> 这个常量因渐进式加载从 200 调到 320 时，写死 200 的三个用例集体变红过。

> 按项目测试约定：**写完把 bug 注回去确认它变红**。本次逐个验证过 6 处变异
> （去掉 priority 排序 / 去掉取 max / 三处漏 release / 把非 404 当没图 / 去掉 preview 去重）
> 都能被捕获；其中「去掉取 max」第一版用例**没抓住**，改成跨 batch 场景后才生效。
>
> 可用性记录同样验证过 5 处变异：`reorderByHint` 退化成单元素链 / 过期记录不 `forget` /
> 无条件回写 `onResolved` / `loadIndex` 跳过版本校验 / 自命中不清除旧结论 —— 均变红。
>
> MIME 嗅探验证过 4 处（去掉 SVG 分支 / SVG 给 image/png / 不跳 BOM /
> `imageCache` 退回写死 `spec.mime`）均变红；**另有 1 处存活**：删掉「第一个非空白
> 字符必须是 `<`」的守卫后全绿 —— 因为紧随其后的四个前缀检查本身就都以 `<` 开头，
> 没有任何输入能区分。那句是死代码，已删。这正是变异测试该抓的东西。
