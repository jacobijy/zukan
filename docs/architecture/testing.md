# 测试约定

## 配置

- 配置在 `vitest.config.ts`，**刻意不复用 `vite.config.ts`**。后者装了
  `@dcloudio/vite-plugin-uni`，插件要求完整 uni-app 上下文（pages.json、manifest.json、
  平台环境变量），在 node 测试环境跑不起来。
- 用例放 `tests/*.spec.ts`，已纳入 `tsconfig.json` 的 include，所以 `type-check` 也管测试代码。
- 环境是 `node`，**没有** uni 全局。要覆盖 `uni.getStorageSync` 这类平台 API 时在用例里
  `vi.stubGlobal('uni', …)`。`tests/favorites.spec.ts` 有一份与 uni-h5 语义一致的 storage stub 可抄。

## 现有用例

| 用例 | 覆盖 |
|------|------|
| `dexFilter.spec.ts` | 筛选/排序纯逻辑，含跨分页、双属性数据集 |
| `pokemonStore.spec.ts` | store 筛选排序、世代切换 |
| `favorites.spec.ts` | 收藏 storage 读写、旧 JSON 字符串兼容 |
| `spriteCache.spec.ts` | 限流、批间 LIFO、离屏取消、引用计数 |
| `spritePersist.spec.ts` | 密文落盘、仅 IDB、索引双向自愈、登出不清盘 |
| `virtualWindow.spec.ts` | 虚拟化窗口 off-by-one / 越界 |
| `i18nLookup.spec.ts` / `languages.spec.ts` | 名称查找、语言偏好与回落 |

## 两条写用例的硬规矩

### 1. 测数据要跨越分页/边界

图鉴的核心 bug 曾经是「筛选只作用于首页 20 条」，数据集小于一页的用例根本发现不了。
同理属性筛选的测试数据必须含**双属性宝可梦**，否则 `some` / `every`（OR / AND）在单属性数组上等价，
测不出区别 —— 这两个盲区都是变异测试查出来的。

### 2. 写完用例把 bug 注回去确认它变红

绿灯本身不证明用例有效。改完逻辑后，临时把实现改回旧的错误行为，确认新用例确实失败，再改回来。

## 门禁

```bash
pnpm type-check   # 必须 0 error
pnpm test         # 必须全绿
```

改 `src/utils/dexFilter.ts`、`src/store/pokemon.ts`、`src/constants/generations.ts`、
`src/services/resources/spriteCache.ts`、`src/services/resources/spritePersist.ts` 时尤其别跳过测试。

`type-check` 看不见的问题（scoped CSS 特异性、`<script setup>` 顶层伪单例、死 prop）
靠 review 和拉编译产物核对，见 [../ui/component-conventions.md](../ui/component-conventions.md)。
