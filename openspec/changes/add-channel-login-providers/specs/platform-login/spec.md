# Spec Delta

## Purpose

按用户所在平台（H5、微信小程序、iOS / Android App）与该发行包的渠道构建配置，选择并执行第三方登录入口（微信 / Apple / Google），并在授权成功后建立本系统会话。

## ADDED Requirements

### Requirement: 第三方登录入口的可见性

登录弹层 SHALL 仅渲染同时满足以下两条件的第三方登录入口：当前平台在其理论能力矩阵中支持该方式，且当前发行包的构建配置已启用该方式。可见入口 SHALL 按固定顺序（微信、Apple、Google）排列；交集为空时 SHALL NOT 渲染第三方登录区（含其分割线）。

#### Scenario: 国内渠道 Android App

- **WHEN** 用户在国内渠道构建的 Android App 打开登录弹层
- **THEN** 仅显示微信第三方登录入口

#### Scenario: 海外渠道 Android App

- **WHEN** 用户在海外渠道构建的 Android App 打开登录弹层
- **THEN** 显示微信与 Google 两个第三方登录入口

#### Scenario: iOS App

- **WHEN** 用户在任一渠道的 iOS App 打开登录弹层
- **THEN** 显示微信与 Apple 入口，且不显示 Google 入口

#### Scenario: 微信小程序

- **WHEN** 用户在微信小程序打开登录弹层
- **THEN** 仅显示微信入口

#### Scenario: H5

- **WHEN** 用户在 H5 打开登录弹层
- **THEN** 不渲染第三方登录区

#### Scenario: 渠道启用但平台不支持

- **WHEN** 发行包构建配置启用了 Google，但当前平台为 iOS
- **THEN** 交集裁剪后不显示 Google 入口

#### Scenario: 未启用任何第三方方式

- **WHEN** 发行包构建配置未启用任何第三方登录方式
- **THEN** 不渲染第三方登录区及其分割线

### Requirement: 经第三方登录建立会话

用户在任一可见入口完成平台授权后，系统 SHALL 用取得的第三方凭据换取本系统 access token 与 refresh token 并本地持久化，使后续需鉴权请求携带该会话；该主体在本系统不存在时 SHALL 自动建号并完成登录。

#### Scenario: Google 登录成功

- **WHEN** 用户在海外 Android 包选择 Google 并授权成功
- **THEN** 系统保存本系统 access / refresh token，关闭登录弹层并继续登录前的操作

#### Scenario: 首次登录自动建号

- **WHEN** 第三方凭据对应的主体在本系统不存在
- **THEN** 系统自动创建账号、完成登录，并将该次标记为新用户

#### Scenario: 已存在用户直接登录

- **WHEN** 第三方凭据对应已存在的用户
- **THEN** 系统直接登录且不重复创建账号

### Requirement: 第三方登录的失败处理

第三方授权或换取会话失败时，系统 SHALL NOT 建立或残留半完成会话，并按失败原因返回可区分的错误；用户主动取消授权 SHALL 静默处理、停留在登录弹层，不显示错误。

#### Scenario: 用户取消授权

- **WHEN** 用户在平台授权页主动取消
- **THEN** 静默返回登录弹层，不显示错误且不产生会话

#### Scenario: 凭据无效或过期

- **WHEN** 第三方凭据被服务端或上游平台拒绝
- **THEN** 提示凭据无效，用户可重新发起登录

#### Scenario: 上游平台不可用

- **WHEN** Google / 微信等上游平台暂时不可用
- **THEN** 提示稍后重试且不写入任何 token

#### Scenario: 网络中断

- **WHEN** 授权或换取 token 过程中网络不可用
- **THEN** 提示网络错误且不写入任何 token

### Requirement: 发行渠道由构建 mode 选择

系统 SHALL 支持以构建 mode 选择每个发行包启用的第三方登录入口集合：`china` mode 仅启用微信，`overseas` mode 启用微信与 Google。同一源码与 mode 配置 MUST 可重复产出相同的入口集合；构建命令行显式提供的环境变量 SHALL 覆盖 mode 文件中的取值。

#### Scenario: china mode 构建

- **WHEN** 以 App 平台与 `china` mode 构建
- **THEN** 产物的登录入口集合为仅微信

#### Scenario: overseas mode 构建

- **WHEN** 以 App 平台与 `overseas` mode 构建
- **THEN** 产物的登录入口集合包含微信与 Google

#### Scenario: 命令行覆盖 mode 文件

- **WHEN** 构建命令行显式提供登录入口环境变量
- **THEN** 产物以命令行取值为准，而非 mode 文件中的值

#### Scenario: 构建可复现

- **WHEN** 使用相同源码与同一 mode 重复构建
- **THEN** 两次产物的登录入口集合一致
