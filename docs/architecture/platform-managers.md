# 按平台区分管理对象（Platform Managers）

## 目的

平台交互操作（需要调起平台 SDK / 与具体平台打交道的动作）按**平台对象**收口，而不是
散成按功能分的裸函数。第一个落地的操作是第三方登录 / 绑定；预期支付、推送、分享、
平台 SDK 调用等都走同一套结构。

## 三层职责边界（关键，勿混）

| 层 | 位置 | 职责 | 性质 |
|----|------|------|------|
| 平台检测 | `src/infra/platform/` | 当前是哪个平台、各平台**理论**支持哪些登录（静态矩阵） | 纯函数/纯数据，可 node 测试 |
| 能力闸门 | `src/services/platform/providerConfig.ts` | 平台支持 ∩ 后端是否已启用 → **UI 是否渲染某入口的唯一依据** | 纯函数 |
| 平台管理对象 | `src/services/platform/managers/` | **执行**与平台交互的操作（login/bind/unbind，以后支付/推送…） | 有副作用（uni / api） |

Manager **不复制能力矩阵**：平台差异（如微信 `app_type`）继续调 infra 的纯函数
（`weixinAppType`）；「这个平台能不能做」由能力闸门在 UI 把关，manager 只负责把被
请求的操作执行好。这样数据表只有一处定义。

## 类层次

```
PlatformManager (types.ts 接口)
  └─ BasePlatformManager (base.ts, abstract)
        · uniLogin：Promise 化 uni.login
        · newNonce：一次性 Apple nonce（~128 bit）
        · weixinPayload / applePayload / phonePayload：取授权凭据（登录与绑定共用，不重复）
        · login / bind / unbind：编排 authApi
        ├─ MpWeixinManager        (mpWeixin.ts)
        ├─ H5Manager              (h5.ts)
        ├─ UnknownManager         (unknown.ts，平台识别失败兜底)
        └─ AppManager (app.ts, abstract)   ← App 侧共性（支付/推送/plus.io wasm…）以后加这里
              ├─ AppIosManager      (appIos.ts)
              └─ AppAndroidManager  (appAndroid.ts)
```

当前登录逻辑的平台差异已全部被 infra 纯函数 + 构造传入的 `platform` 消化，所以各具体
子类现在只声明平台标识——它们是**为未来平台特有操作预留的扩展点**，不是无意义空壳。

## 使用

```ts
import { getPlatformManager } from '@/services/platform/managers';

const manager = getPlatformManager();   // 缺省按 detectPlatform()；可显式传平台
await manager.login('weixin');
await manager.bind('apple');
await manager.unbind('phone');
```

`getPlatformManager` 用 `Map<Platform, PlatformManager>` 缓存，同平台全局单例。

## 以后怎么扩展

- **加一个平台操作**（如支付）：
  1. `types.ts` 的 `PlatformManager` 接口加方法签名；
  2. 共性逻辑放 `BasePlatformManager`（或 App 的 `AppManager`），仅某平台的差异在对应
     子类重写；
  3. 平台「是否提供/启用」仍走 infra 能力矩阵 + providerConfig 风格的闸门。
- **加一个新平台**：新增一个 manager 文件（extends 最近的基类）+ `registry.ts` 的
  `createManager` switch 加一分支；检测层 `Platform` 类型与 `resolvePlatform` 也要能产
  出该平台标识。

## 测试

`tests/platformManagers.spec.ts`：`vi.mock('@/services/api')` + stub `uni.login`，通过
`getPlatformManager('<platform>')` 取对象，覆盖各平台凭据（微信 app_type、Apple nonce、
本机号 token）、绑定/解绑、不支持的 provider、凭据缺失与授权失败，以及 registry 的
选型/继承/单例。因顶层静态 import 会立即触发 api mock，mocks 用 `vi.hoisted` 声明。
