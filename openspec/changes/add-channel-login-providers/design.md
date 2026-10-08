# Design

## Context

现有的三层结构已就位（见 `docs/architecture/platform-managers.md`、`docs/security/auth-session.md`）：

- **平台理论能力矩阵**（`src/infra/platform/capabilities.ts`）：纯数据，声明各平台支持哪些第三方方式。
- **启用交集闸门**（`src/services/platform/providerConfig.ts`）：平台能力 ∩ `VITE_AUTH_PROVIDERS`，是 UI 是否渲染入口的唯一依据；当前该 env 未设置，交集恒为空。
- **平台管理对象**（`src/services/platform/managers/`）：执行 login / bind / unbind，按平台单例。

约束：Google 走 uni-app OAuth 内置 `provider: 'google'`，**无新增 npm 依赖**；`POST /auth/google` 在 zukan-server（另一仓库），本仓仅对齐前端契约；原生 `manifest` 当前为空脚手架，OAuth 模块与各 appid 在云打包侧注入。

## Goals / Non-Goals

**Goals:**

- Google provider 从矩阵、凭据、API、UI 到测试完整贯通，仅 App Android 提供。
- 以 mode 文件 + 构建脚本提供**可复现**的国内 / 海外分渠道登录入口构建。
- 复用现有交集闸门，不为此引入特殊分叉代码。

**Non-Goals:**

- 不引入运行时"地区 / 渠道"维度，也不做 GMS 可用性探测；渠道差异只存在于构建期。
- 不为国内细分渠道（华为 / 小米 / 应用宝…）建立独立 mode。
- 不实现后端端点，仅对齐契约。
- 不在 iOS 提供 Google 入口。

## Decisions

### D1：渠道差异只在构建期表达，用 Vite mode，不加运行时地区概念

新增 `.env.china` / `.env.overseas`，由 `uni build -m <mode>` 选择。真正需要为 Google 分叉的只有"国内 vs 海外"一刀，且它天然对应两个发行构建；国内细分渠道包共享 `china`（渠道标另打）。

- **Alternative（已否决）**：运行时探测 GMS / 地区再决定按钮——无 Play Services 设备上探测不可靠，且把地区逻辑长期留在产品代码中。
- **Alternative（已否决）**：仅用命令行内联变量——适合 CI 临时覆盖，但不可复现、易敲错且不进 git。命令行覆盖仍保留为最高优先级，供 CI / 临时构建使用。

### D2：Google 与微信 / Apple 同构，复用现有 provider 体系

`AuthProvider` 与 `PROVIDER_ORDER` 增加 `google`；`app-android` 矩阵加入；基类新增 `googlePayload()`（`uni.login({ provider: 'google' })`，取授权凭据，与 `applePayload` 同形）；`api/auth.ts` 新增 `loginWithGoogle()`（`POST /auth/google`，响应同 `SocialTokenPair`，错误映射增加 `google` kind）；`SocialLoginButtons` 增加 Google 图标与配色。

- **Alternative（已否决）**：引入第三方 Google 登录插件 / SDK 直连——uni OAuth 内置已支持，插件只增加维护与打包负担。

### D3：交集闸门语义扩为"本发行包启用"，代码零改动

该闸门本就是"平台理论能力 ∩ 外部启用信号"。将外部信号含义由"后端是否上线"沿用为"本发行包是否启用（含后端就绪）"。平台矩阵仍只放理论能力（Google 对 app-android 恒在），国内 / 海外差异不进入矩阵。

### D4：前端 mode 与原生 manifest OAuth 必须对齐，列为发布检查项

海外渠道包须在 HBuilderX / 云打包勾选 OAuth 模块并填入 Google `clientid`；国内包不要求。两处不一致会造成"显示 Google 但 SDK 未打进包"，故在 tasks 与文档中固定为发布前核对项。

## Risks / Trade-offs

- **海外包安装到无 GMS 设备，Google 入口可见但调不起** → 复用现有授权失败 / 上游不可用提示路径；属边缘场景，按 D1 不引入运行时探测。
- **mode 与 manifest `clientid` 配置漂移** → tasks 中列为每次发布的核对项；后续可补自动化构建校验。
- **后端 `/auth/google` 未就绪，海外包登录失败** → 海外发布与后端上线联动；契约与 `/auth/apple` 同构以降低后端成本。
- **mode 命名与 CI 约定不一致** → 固定 `china` / `overseas` 两个名称并写入文档。

## Migration Plan

纯增量改动：账号密码与现有微信 / Apple 行为不变；默认 production 构建在未使用新 mode 时交集仍为空、行为与现状一致，可安全合入。

发布顺序：后端 `/auth/google` 就绪 → 配置 Google `clientid` → 用 `overseas` mode 打包并验证（含无 GMS 设备的失败降级）→ `china` 包回归仅微信。

回滚：从对应 mode 移除 `google` 或停发海外包即可；代码保留不影响国内包。

## Open Questions

- 海外 iOS 将来是否加 Google（跨端账号一致）：本次排除；需要时在 app-ios 矩阵加入 `google` 即可，不影响现有结构。
- 是否增加自动化构建校验（比对 mode 与打包 manifest）：可作为独立改进延后。
