# Tasks

## 1. Google 能力矩阵（infra 数据层）

- [x] 1.1 在 `src/infra/platform/capabilities.ts` 将 `'google'` 加入 `AuthProvider` 联合类型与 `PROVIDER_ORDER`（置于 `apple` 之后），并在 `app-android` 平台矩阵加入 google（其余平台不变）；扩展 `tests/platform.spec.ts`，断言 app-android 为 `weixin`+`google`、app-ios 仍为 `weixin`+`apple`、h5/mp-weixin 不含 google，并验证 google 在固定排序中的位置；`pnpm test -- platform` 通过。

## 2. Google 凭据、API 与编排（service 层）

- [x] 2.1 在 `src/services/platform/managers/base.ts` 新增 `googlePayload()`（`uni.login({ provider: 'google' })` 取授权凭据，缺凭据抛错，与 `applePayload()` 同形），并在 `login()` 与 `bind()` 编排中接入 google（`unbind()` 已按 provider 通用，无需改）；扩展 `tests/platformManagers.spec.ts`，覆盖 google 凭据获取、login/bind 走 google、凭据缺失与授权失败；`pnpm test -- platformManagers` 通过。
- [x] 2.2 在 `src/services/api/auth.ts` 增加 Google 请求/响应类型与 `loginWithGoogle()`（`POST /auth/google`，成功后落盘 access/refresh），并在错误映射的 `MapKind` 增加 `'google'`、纳入登录类集合（401→`INVALID_CREDENTIALS`，503→`UPSTREAM_UNAVAILABLE`）；扩展 `tests/authSocial.spec.ts`，覆盖成功落盘与 401/503 映射；`pnpm test -- authSocial` 通过。

## 3. Google UI 入口与文案（登录 + 账号绑定）

- [x] 3.1 在 `src/components/shared/SocialLoginButtons.vue` 增加 Google 单色图标、品牌配色与 `labelFor('google')` 分支；`pnpm type-check` 通过，并在开发态/真机观察海外 Android 登录弹层渲染微信 + Google、点击触发 Google 登录。
- [x] 3.2 在 `src/components/shared/AccountBindings.vue` 补齐 google：`labelFor()` 增加 google 分支（避免错误回落到 phone 文案）、`providersFromResponse()` 的 `known` 列表加入 google；`pnpm type-check` 通过，并观察账号绑定区 Google 行文案与绑定/解绑动作正确。
- [x] 3.3 在各语言 i18n bundle 增加 Google 文案（如 `login.googleLogin`）；运行 `pnpm test -- i18nLookup languages`，确认各语言无缺失键。

## 4. 分渠道构建配置（mode 文件 + 脚本 + 文档）

- [x] 4.1 新增 `.env.china`（`VITE_AUTH_PROVIDERS=weixin`）与 `.env.overseas`（`VITE_AUTH_PROVIDERS=weixin,google`）；用 Vite `loadEnv`（临时 node 命令）验证 china 解析为 `weixin`、overseas 解析为 `weixin,google`。
- [x] 4.2 在 `package.json` 增加 `build:app:china`（`node scripts/copy-wasm.mjs && uni build -p app -m china`）与 `build:app:overseas`（同构，`-m overseas`）；分别运行两脚本，验证构建成功且产物内启用集合分别为仅微信 / 微信 + Google。
- [x] 4.3 新增 `docs/security/channel-login-build.md`，记录 mode 文件、构建脚本、env 优先级（命令行 > `.env.[mode].local` > `.env.[mode]`）、默认 production 行为不变，以及与原生 manifest OAuth/clientid 的对齐要求，并从 `docs/security/auth-session.md` 与 `docs/architecture/platform-managers.md` 加入链接；按需同步到 `CLAUDE.md`；验证文档中命令可照跑。

## 5. 发布对齐与集成验证

- [ ] 5.1 原生打包对齐（design D4）：海外渠道包在 HBuilderX/云打包勾选 OAuth 模块并填入 Google `clientid`，国内包不配置 google；在云打包/真机（需后端 `/auth/google` 就绪）验证海外包 Google 登录成功、国内包登录区仅微信。
- [ ] 5.2 降级与回归：海外包在无 GMS 设备点 Google 时走授权失败/上游不可用提示且不崩溃、不留半登录态；china 包回归仅微信；不带 `-m` 的默认 production 构建行为与现状一致（无第三方入口）。
- [x] 5.3 全量把关：`pnpm type-check`、`pnpm test`、`pnpm lint` 全部通过。
