# 图鉴筛选、排序与收藏

主列表流程集中在 `src/pages/index/index.vue` + `src/store/pokemon.ts`，
纯筛选排序逻辑在 `src/utils/dexFilter.ts`。

## 数据流

```
resourceManager.getPokemonGen(gen)    加密 bundle → 解密 → 五表 join
        │
        ▼
store.defaultPokemons                 按 species 去重后的 ~1025 条默认形态
        │  setCriteria(全量替换条件)
        ▼
filterAndSortPokemons(list, criteria) 纯函数，src/utils/dexFilter.ts
        │
        ▼
store.matchedPokemons                 筛选排序结果（不分页）
        │
        ▼
VirtualGrid 定高虚拟化                DOM 只留视口附近
```

## 筛选条件（`DexFilterCriteria`）

页面组合搜索、属性筛选、仅收藏、世代筛选、排序，通过 `setCriteria()` **全量替换**推给 store
（不是 merge）。支持的排序键：`id` / `name` / `hp` / `attack` / `defense`。

要点：
- **对 `defaultPokemons`（去重后默认形态）筛选排序**，不是对全部 1351 条形态。
- **不分页** —— 渲染交给 `dex/VirtualGrid.vue` 定高虚拟化。
- 属性筛选要区分 OR / AND：单属性宝可梦会让 `some`/`every` 等价，测试数据必须含双属性
  （见 [../architecture/testing.md](../architecture/testing.md)）。

## 历史坑：先分页再筛选

早先流程是「先分页（首页 20 条）再筛选」。选任意非第一世代，首页 20 条被全滤掉 → 列表空 →
容器无内容 → 滚动不触发 → 死锁。现在是**先全量筛选排序，再虚拟化渲染**，不要回退成分页模式。

## 收藏

- **纯后端、需登录**：收藏 id 集合以 `GET /favorites`（`services/api/favorites.ts` 的
  `listFavorites`）为唯一来源，**不再落本地存储**。启动已登录时由 `boot.ts` 预载，
  登录成功由共享组件 `LoginModal` 统一刷新，登出清空内存（`resetFavorites`，防跨账号残留）。
- 点收藏（卡片心形 / 详情页星形）走 `store/pokemon.ts` 的 `toggleFavorite`：先
  `confirmLogin()`（未登录弹「是否去登录」确认框 → 登录框，任一步取消则静默、什么都不做），
  再乐观更新内存 + `POST/DELETE /favorites`，请求失败回滚内存。
- 「仅收藏」仍是筛选条件之一，和属性/搜索/世代叠加，读内存中的 favorites；未登录时为空。
- 行为用例见 `tests/favorites.spec.ts`（已无本地存储 / 旧格式迁移用例）。

## 默认世代

默认 gen 是 9：`DEFAULT_GEN_ID = 9`（store），与 `LATEST_GEN_ID = 9`（`boot.ts`）保持一致。
gen-N.bin 是「全物种在第 N 世代的数值快照」，不是「第 N 世代新增」—— 见
[./bundle-decode.md](./bundle-decode.md)。

## 测试

```bash
pnpm test -- dexFilter pokemonStore
```

数据集必须跨越分页边界、必须含双属性宝可梦（见 [../architecture/testing.md](../architecture/testing.md)）。
改筛选排序后把 bug 注回去确认用例变红。
