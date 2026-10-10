# 认证与会话

`src/services/session/` 管 DEK 的获取、401/403 恢复、登录弹层去重。
加密格式本身见 [./encryption-pipeline.md](./encryption-pipeline.md)。
登录入口的第三方方式及登录后的绑定管理走 platform 体系；分渠道构建的入口配置见
[./channel-login-build.md](./channel-login-build.md)。

## `getKey()` 是唯一入口

全 app 拿 DEK 只通过 `src/services/session/key.ts::getKey()`。调用点共 3 类
（`boot.ts`、`resourceManager`、加密图片引擎 `imageCache`——后者同时服务 sprite 与道具图标），
CDN 403 重签时各再调一次。

职责：
- **内存缓存 + 并发去重**：`keyCache` 命中直接返回；并发调用共享同一个 `keyPromise`。
- **401 恢复集中在这里**，不散在调用点（否则同样分支重复 6 遍且容易漏）。
- `clearKeyCache()` 在登出 / DEK 轮换 / CDN 403 重签路径调用。

### 401 恢复决策树

```
401 UNAUTHENTICATED
  ├─ 本地有 refresh token → authApi.refresh() → 重试一次 fetchKey
  │    └─ refresh 也失败 → clearSession() → 弹登录层
  └─ 无 refresh token     → 弹登录层 → 登录成功后重试
```

- 是否「未认证」优先信服务端下发的 `code === 'UNAUTHENTICATED'`，回退裸 401（兼容旧后端）。
- refresh 本身并发去重（`refreshPromise`），6 个调用点并发只打一次 `/auth/refresh`。
- 用户关闭登录层抛 `LoginDismissedError`，调用方**静默降级**（不重试、不报错）。

## `authGate` 是模块级单例

`authGate.ts` 负责登录弹层去重 —— 6 个 getKey 调用点不会各开一个弹窗。

它**故意不是 Pinia store**：store 会依赖 session，反过来 session 又要触发 store 动作，
形成 `store ⇄ session` 循环依赖。模块单例没有这个问题。

## 写操作登录闸门：`confirmLogin()`

`getKey()` 内部的 `requireLogin()` 是**一点就弹登录框**（用于资源解密等被动 401 恢复）。
用户**主动触发的写操作**（收藏、保存 / 删除队伍、保存 / 删除云端模板）不应一点就被打断，
统一走 `src/services/session/confirmLogin.ts` 的 `confirmLogin()`：

```
已登录                            → true（直接续跑原操作）
未登录 → uni.showModal「是否去登录」
          ├─ 取消               → false（调用方静默中止、不发请求）
          └─ 去登录 → authGate.requireLogin() 打开全局 LoginModal
                      ├─ 成功   → true（在同一动作内继续原写操作）
                      └─ 关闭   → false（LoginDismissedError，静默中止）
```

- 返回 boolean，`await` 后为 `true` 才继续；非取消类的意外错误向上抛。
- 确认框用原生 `uni.showModal`（H5 / 小程序 / App 一致），文案走 i18n
  （`auth.loginRequiredTitle` / `loginRequiredContent` / `goLogin`）。
- 弹的仍是同一个全局 `LoginModal`（`authGate.visible` 单例），因此**触发所在页面必须挂载
  `LoginModal`**，并把 `@success` 接到 `authGate.notifySuccess()`（index、mine、detail、
  teams 两页、templates 两页均已挂）。
- 登录成功后的数据刷新：收藏由 `LoginModal` 统一 `loadFavorites(true)`（覆盖表单 / 注册 /
  第三方登录及所有挂载页）；teams / templates 各自在页面 `@success` 里 `load(true)`。

## 循环依赖防护

曾经的环：

```
session/key → api/zukanKey → session/token → session/key
```

- 闭合回边是 `token → key`：`clearSession()` 为了顺带清 DEK，反向 import 了
  上层的 `clearKeyCache`。
- **断法是依赖反转（注入回调），不是动态 import**：`token.ts` 暴露
  `onSessionClear(hook)`，`key.ts` 在模块加载时把 `clearKeyCache` 注册进去；
  `clearSession()` 改为遍历触发这些钩子。依赖方向回到 `key → token`，回边消失。
  小程序端动态 `import()` 会被错编成 `await "字符串"`，本来也不能用来断环。
- 钩子是惰性注册的，但安全：钩子存在 ⇔ key 模块已被加载 ⇔ 可能存在 DEK 缓存。
  若 key 从没被 import，`keyCache` 本就是 null，漏清也无物可清。
- `key.ts` **静态** import `api/auth.ts` 与 `api/zukanKey.ts`：auth 只依赖 `http`
  与 `session/token`，不反向依赖 key，不构成 `session ⇄ api` 环；产物里无动态 import。
- `clearSpriteCache()` 在 `mine.vue` 的登出路径调用，**不在** `clearSession()` 内部 ——
  否则 `session ⇄ resources` 成环。
- `authGate` 是模块单例而非 Pinia store（见上）。

## `keyPromise` 清理的微任务陷阱

`keyPromise` 的清理必须挂在主链的 `.finally` 上，**不能**写成
`keyPromise.catch(() => { keyPromise = null })`：

`.catch` 返回一个新 promise，它的回调在微任务里才跑。这期间进来的并发调用者会看到并复用
那个**注定 reject** 的旧 promise，全部跟着失败。

`.finally` 挂在 `fetchWithRecovery().then(...)` 主链上，settle 时同步清空引用，没有空窗。

## token 与会话清理

- `token.ts`：access / refresh token 读写，`getRefreshToken()`、`clearSession()`。
- `clearSession()` 清会话凭证；**它不清 sprite 磁盘缓存**（密文没 DEK 解不开，不构成泄露，
  留着下次登录命中），那条由登出路径显式调 `clearSpriteCache()` 决策。
  见 [../caching/sprite-cache.md](../caching/sprite-cache.md)。
