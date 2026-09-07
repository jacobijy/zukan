/**
 * 开发者工具门禁 —— 唯一判断处。
 *
 * `import.meta.env.DEV` 会被 Vite **静态替换**成字面量，因此正式构建里
 * `if (devtoolsEnabled)` 是恒假分支，其中的 `await import('./DevAssetInspector.vue')`
 * 属死代码，Rollup 连那个分包一起丢掉 —— 工具实现体不进产物。
 *
 * 换成运行时开关（localStorage 之类）就失去这个性质：实现体会被静态分析认定「可能用到」
 * 而打进包里。真要在预发环境排查，宁可临时起一次 dev 构建。
 *
 * 注意页面壳仍在 `pages.json` 里（静态 JSON 无法条件注册），正式构建下它只渲染一句
 * 「未启用」。也就是说被剔除的是**实现体**，不是那条路由。
 */
export const devtoolsEnabled = import.meta.env.DEV;
