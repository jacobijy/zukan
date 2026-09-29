# 微信小程序构建与平台适配

图鉴主目标是 H5，小程序是次要平台。要让微信小程序真正能跑、能上传，有几处
平台差异需要维护：devtools 与 WASM 用 uni-app 的**条件编译**，Tailwind 兼容靠
`tailwind.config.js` 按平台开关，产物瘦身脚本，再加一层**运行时**平台分流
（wasm 初始化、解密产物如何喂给 `<image>`）——后者不写进 `#ifdef`，而是运行时
探测能力，避免 vue-tsc 看到重复声明。本文是唯一说明处。

## 命令

- 开发：`pnpm dev:mp-weixin`（产物 `dist/dev/mp-weixin`，导入微信开发者工具）
- 发布构建：`pnpm build:mp-weixin`（产物 `dist/build/mp-weixin`）

条件编译宏：`H5` 仅 H5、`MP-WEIXIN` 仅微信、`#ifndef X` 取反。写法是注释，
**vue-tsc 看得到完整源码（两个分支都会类型检查），只有 uni 构建时按平台剥离**：

```html
<!-- #ifdef H5 --> … <!-- #endif -->
```

```ts
// #ifdef MP-WEIXIN
…
// #endif
```

## 适配一：devtools 页仅 H5

`src/pages/devtools/devtools.vue` 用 `<component :is="Impl">` 在两个动态 import 的
实现体间切换。**微信小程序编译器不支持 `<component :is>`**（直接报错
`<component is=""/> is not supported`），且实现体依赖动态 import + WASM，小程序本就
跑不起来。整个动态机制（模板与脚本）用 `#ifdef H5` 包住，`#ifndef H5` 显示
「开发者工具仅 H5 可用」。dev-only 实现体在正式产物中仍被剔除，规则不变。

## 适配二：WASM 在小程序内的初始化

图鉴 FB bundle / 加密图片 / i18n 的解密（`decryptZukan`）与伤害计算都依赖
`src/infra/wasm`（RUST + wasm-bindgen）。wasm-bindgen 默认初始化是

```js
new URL('zukan_wasm_bg.wasm', import.meta.url)  // + fetch / instantiateStreaming
```

这套在微信小程序里全不可用：`import.meta.url`、`fetch` 远程 wasm、
`instantiateStreaming` 都没有，且微信没有标准 `WebAssembly` 全局。
小程序改用 **`WXWebAssembly`**，其 `instantiate` 第一参直接是**代码包内
`.wasm` 的路径字符串**（不读字节、不 fetch，由运行时自己加载），wasm-bindgen
的 glue 已被 vite 插件 `adaptWasmToWx` 改造成走这条路径。因此：

1. `scripts/copy-wasm.mjs` 把 `infra/wasm/pkg/zukan_wasm_bg.wasm` 拷到
   `src/static/wasm/`（只有 src/static 下的文件才会进小程序包）。已嵌入
   dev/build 命令开头；单独执行用 `pnpm copy:wasm`。
2. `src/infra/wasm/index.ts` 里 `#ifdef MP-WEIXIN` 分支把
   `/static/wasm/zukan_wasm_bg.wasm` 这个**路径**传给 `wasmModule.default(path)`
   （不是先读字节再传 `BufferSource`）；其他平台仍 `module.default()`。
3. wasm-bindgen 的 glue 在 mp-weixin 下必须**静态引入**：动态 `import()` 在该
   平台会被错编成 `await "字符串"` 而失效。

> 重新构建 Rust WASM（wasm-pack）后 copy 脚本会自动把新 wasm 同步进包，无需手操。
> 构建期那条 `new URL(...) doesn't exist at build time` 警告来自 pkg JS 里的默认
> 兜底分支，小程序运行时传的是路径、走不到它，可忽略。

### 动态 `import()` 在小程序端整体失效（比 wasm 更广）

上面只提了 glue，但根因是平台级的：**uni-app 的 mp-weixin 编译器把 `import('x')`
编译成 `await "x.js"`** —— 只 await 一个字符串字面量，不加载任何模块。
所以任何形式都拿不到模块对象：

- 解构 → `const { f } = await "..."` → `f` 是 `undefined`，静默失效
- `.then(m => m.f())` → `"字符串".then is not a function`，TypeError 抛到外层 catch
- `#ifdef` 条件编译挡不住：编译在剥离宏之后发生

**唯一稳妥的断环手段是让依赖方向本身不闭合**，或改用无 Vue/平台依赖的纯函数 +
注入（见 `services/pokemon/pokemon.ts` 的 `NameResolvers`、`services/pokemon/
evolution.ts` 的 `EvolutionResolvers`）。已因此修过的点：`boot.ts`（i18n store）、
`services/pokemon/pokemon.ts`（i18n store）、`services/pokemon/evolution.ts`（两个
store）、`pages/calc/calc-engine.ts`（wasm pkg + TypeChart）、`services/session/key.ts`
（authApi.refresh）。

排查手法：`grep -rn 'import(' src`，逐个看它要拿的东西在小程序上是必须成功的还是可
静默降级的。**注意 `services/meta/moveRefs.ts` 仍是动态 import**（刻意：让模块顶层
无平台依赖，好在 node 单测环境跑）。目前它所在调用链都在 H5 才走，但一旦小程序端
页面依赖 `moveRefs` 反查，会静默拿到空索引 —— 接之前先把那处改成静态引入。

核对方式：构建后 grep 产物，出现 `"./xxx.js"` 紧跟 `.then` 就是漏网的动态 import：

```bash
grep -rn '\.then' dist/dev/mp-weixin --include=*.js | grep '"\./' 
```

### 解密产物如何喂给 `<image>`（运行时分流，非 `#ifdef`）

解密链在两端**完全共用**（`decryptZukan` 同一份 wasm、同一 DEK、同一 ZKDX），
只有产物落地这一个原语平台相关，收口在 `src/services/resources/objectUrl.ts`：

- **H5**：`URL.createObjectURL(new Blob(...))` / `revokeObjectURL`。
- **小程序**：没有 Blob URL（`URL` 整个为 `undefined`，直接调即 TypeError）。
  改为把解密后的字节用 `uni.getFileSystemManager().writeFile` 写进
  `${USER_DATA_PATH}/zukan-img/` 下的本地文件，返回**文件路径**给 `<image>`；
  release 时 `unlink` 删掉该文件。

引用计数 / LRU / 限流（`imageCache`）两端一致，不受影响。注意这一层与
`binaryStorage` 的持久化缓存不同：这里落的是**明文**（临时、可回收），
持久化缓存层另按 `storageBackend` 决定是否落密文。
> 兜底分支，小程序运行时永远传字节、走不到它，可忽略。

## 适配三：Tailwind 在小程序的两处兼容

`tailwind.config.js` 顶部用 `process.env.UNI_PLATFORM`（uni CLI 在加载配置前写入，
`h5` / `mp-weixin`）算出 `isMiniProgram`，据此在小程序端做两件事，H5 完全不动：

1. **关闭 preflight**（`corePlugins.preflight = false`）。preflight 是给 H5 的
   html/body 做的 reset，含小程序不支持的 `:host` / `::backdrop` / `:where()`，
   小程序也没有 html/body 元素。
2. **开启 `experimental.optimizeUniversalDefaults`**（注意在 Tailwind v3 里属于
   experimental，**不是 future**）。只要项目用到 transform / ring / filter 等工具类，
   Tailwind 默认会额外注入（**独立于 preflight、关 preflight 也挡不住**）：

   ```css
   *, ::before, ::after { --tw-translate-x: 0; --tw-scale-x: 1; … }
   ::backdrop { …同上… }
   ```

   其中通用选择器 `*` 与 `::backdrop` 在微信 WXSS 同样报错（控制台定位框指向这一
   行）。开启优化后，默认值被收敛到**实际使用工具类的 class 选择器**上
   （`.translate-x-0`、`.rotate-180`、`.scale-105`、`.transform` …），`*` 与
   `::backdrop` 都不再生成，且带工具类的元素才需要这些默认值，行为等价。
   构建时那条 `experimental features: optimizeUniversalDefaults` 是提示，可忽略。

## 适配四：构建产物瘦身（只动 dist，不碰 src）

微信限制：**单个主包/分包 ≤ 2MB，整包 ≤ 30MB**（见微信「分包加载」文档）。

属性贴纸（01–18 × s/m/l）和招式分类（× s/m/l）在**源目录是刻意保留的成套资源**，
由 `tests/typeIcons.spec.ts` / `tests/moveCategory.spec.ts` 守护「文件存在」，H5 也会
用到全部尺寸 —— 所以**不能删源文件**。但当前小程序 UI 只渲染 `m` 档
（TypeBadgeIcon / MoveCard 的调用都传 `m`）。`scripts/slim-mp-weixin.mjs` 在
`uni build` 之后从**产物**剔除 s/l（共 42 个文件），源与测试不受影响。

- 仅 `build:mp-weixin` 执行；dev 产物保留全套（模拟器不卡 2MB，便于验证未来尺寸）。
- 小程序接入列表（s）/详情（l）贴纸时，从 `slim-mp-weixin.mjs` 的规则里删掉对应项。

当前发布产物实测约 **1.41 MiB（1,481,792 字节）**，主包达标。
注意别用 `du -sh` 判断（小文件按 4K 块对齐会严重虚高，曾显示 4.1M），
用 `find . -type f -printf '%s\n' | awk '{s+=$1}END{print s}'` 算真实字节。

## 发布 checklist

1. 在 `src/manifest.json` 的 `mp-weixin.appid` 填真实 appid —— 留空时产物
   `project.config.json` 会被置成占位 `touristappid`，无法真机预览/上传。
2. `pnpm type-check` 0 error、`pnpm test` 全绿。
3. `pnpm build:mp-weixin` 成功且末尾打印 slim 释放量。
4. 微信开发者工具导入 `dist/build/mp-weixin`，真机预览后点「上传」，再到
   小程序管理后台提交审核。上传/审核必须用你的账号在开发者工具里操作，无法无头完成。
