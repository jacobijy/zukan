# Proposal

## Why

登录入口的"按平台分叉"逻辑（平台能力矩阵 + 启用闸门 + 平台管理对象）已经落地，但第三方入口当前被空的 `VITE_AUTH_PROVIDERS` 闸门统一压成零——任何平台实际只显示账号密码。App 即将**国内 / 海外双渠道发行**：海外渠道（Google Play）需要 Google 账号这一操作系统级登录方式，国内渠道（无 GMS）既调不起 Google、也不应显示该入口。因此需要一种**可复现、按发行渠道切换登录入口集合**的构建方式，并补齐 Google provider。

## What Changes

- **新增 Google 第三方登录**（仅 App Android）：`app-android` 静态能力矩阵加入 `google`；新增 Google 凭据获取（uni-app OAuth 内置 `provider: 'google'`，无新增 npm 依赖）、`/auth/google` 端点封装、按钮图标与 i18n 文案、对应单测。
- **按构建 mode 切换入口集合**：新增 `.env.china` / `.env.overseas` 两个 mode 文件，分别声明各自的 `VITE_AUTH_PROVIDERS`；`package.json` 新增 `build:app:china` / `build:app:overseas`，经 `uni build -p app -m <mode>` 选择。
- **闸门语义微调（代码零改动）**：`providerConfig` 的交集闸门由"后端是否上线该方式"沿用为"本发行包是否启用该方式"；Google 一旦进入 `PROVIDER_ORDER`，`VITE_AUTH_PROVIDERS` 按包控制自动生效。
- **原生打包侧对齐**：海外渠道包需在 HBuilderX / 云打包勾选 OAuth 模块并填入 Google `clientid`（与前端 mode 配置保持一致，属打包配置而非本仓运行时代码）。
- 不改动账号密码登录，不改动微信 / Apple 现有行为。

## Capabilities

### New Capabilities

- `platform-login`: 按当前**平台**与**发行渠道构建配置**选择、渲染并执行第三方登录入口（微信 / Apple / Google），含平台理论能力矩阵、启用交集闸门、第三方登录 / 绑定凭据的获取与执行。

### Modified Capabilities

<!-- 项目此前无已归档 spec，无既有 capability 需要修改。 -->

## Impact

- **前端代码**：`src/infra/platform/capabilities.ts`（矩阵 / provider 类型 / 排序）、`src/services/platform/managers/base.ts`（Google 凭据与编排）、`src/services/api/auth.ts`（`loginWithGoogle` 及错误映射）、`src/components/shared/SocialLoginButtons.vue`（Google 图标 / 文案）、i18n bundles、`tests/platformManagers.spec.ts`。
- **构建配置**：新增 `.env.china`、`.env.overseas`；`package.json` 新增两个 `build:app:*` 脚本。`src/services/platform/providerConfig.ts` 无需改动。
- **原生打包（外部）**：`manifest` 的 OAuth 模块勾选 + Google iOS/Android `clientid`，仅在海外渠道包生效；需与 mode 配置一致，避免"显示按钮但 SDK 未打进包"。
- **后端契约（外部，zukan-server）**：需提供 `POST /auth/google`（校验 Google ID token 后下发本系统 token 对），请求 / 响应体与现有 `/auth/apple` 同构。本仓只实现前端调用，后端由其后端仓库管理。
- **明确不在本次范围**：海外 iOS 的 Google 入口（iOS 已由 Apple 满足审核，维持微信 + Apple）、本机号一键登录 `phone` 放开、h5 微信网页扫码、运行时 GMS 可用性探测。
