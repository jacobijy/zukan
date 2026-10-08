# 分渠道登录入口构建配置

第三方登录入口同时受两层控制：静态能力矩阵（`src/infra/platform/capabilities.ts`
按**平台**分叉）与 `providerConfig` 交集闸门（按**本发行包是否启用**过滤，
依据 `VITE_AUTH_PROVIDERS`，见 [../architecture/platform-managers.md](../architecture/platform-managers.md)）。
本文记录后者在"国内 / 海外分渠道发行"下如何配置与验证。

## 渠道与启用集合

| 构建 mode | `VITE_AUTH_PROVIDERS` | App Android 可见入口 | 备注 |
|-----------|----------------------|----------------------|------|
| `china`   | `weixin`             | 微信                 | 国内各厂渠道包共享 |
| `overseas`| `weixin,google`      | 微信 + Google        | Google Play 海外包 |
| （默认 production） | 未设置 → 交集为空 | 无第三方入口 | 与历史行为一致 |

配置文件：`.env.china` / `.env.overseas`（均入 git，团队共享）。

## 构建命令

```bash
pnpm build:app:china      # → 微信
pnpm build:app:overseas   # → 微信 + Google
```

底层是 `node scripts/copy-wasm.mjs && uni build -p app -m <mode>`（复制 WASM 后以
对应 mode 构建 App 资源包）。产物在 `dist/build/app`。

## env 优先级（高 → 低）

```
命令行内联环境变量（VITE_AUTH_PROVIDERS=... pnpm build:app:overseas）
.env.<mode>.local          ← 个人覆盖，不进 git（*.local 已忽略）
.env.<mode>                 （.env.china / .env.overseas，进 git)
.env                        （所有 mode 的公共默认）
```

`VITE_APP_AUTH_PROVIDERS` 由构建期替换为字面量注入产物，因此不能用"改运行时配置"
的方式切换登录入口 —— 想换入口必须重新构建。

## 验证产物实际启用了哪些入口

```bash
pnpm build:app:china
grep -rhoE '(weixin,google|weixin)(?=[^a-zA-Z])' dist/build/app --include='*.js' | sort | uniq -c
# china    → 只见 weixin
# overseas → 出现 weixin,google
```

## ⚠️ 与原生打包配置必须对齐

前端 mode 只决定**按钮显不显示**；能否真正调起由原生侧决定。构建模式与
HBuilderX/云打包 的 OAuth 模块配置不一致时，会出现"显示入口但点了失败"：

| 构建 mode | manifest OAuth 模块要求 |
|-----------|------------------------|
| `china`   | 无需 google；微信 appid 按需 |
| `overseas`| **勾选 OAuth + 配置 Google `clientid`**（`sdkConfigs.oauth.google`） |

海外包分发到无 GMS 设备时，Google 入口可点但调不起 —— 走现有授权失败 /
上游不可用提示路径，不引入运行时 GMS 探测（见本仓该特性 design.md）。

## 后端联动

`/auth/google`（校验 Google ID token 后下发本系统 token）由 zukan-server 提供；
前端契约与 `/auth/apple` 同构（`{ id_token }`），实现见 `src/services/api/auth.ts`。
海外包可用性依赖该端点就绪。