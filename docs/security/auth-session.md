# 认证与会话

`src/services/session/` 管 DEK 的获取、401/403 恢复、登录弹层去重。
加密格式本身见 [./encryption-pipeline.md](./encryption-pipeline.md)。

## `getKey()` 是唯一入口

全 app 拿 DEK 只通过 `src/services/session/key.ts::getKey()`。调用点共 3 个
（`boot.ts`、`resourceManager`、`spriteCache`），CDN 403 重签时各再调一次。

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

## 循环依赖防护

- `key.ts` 用**动态 import** 引 `api/auth.ts`（`import('@/services/api/auth')`），
  打断 `api/auth → session/token → ... → api/auth` 的顶层环。
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
