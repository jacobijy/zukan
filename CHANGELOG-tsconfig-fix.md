# TypeScript 配置修复日志

## 📅 修复日期
2026-04-21

## ⚠️ 问题描述

### 错误信息
```
选项"importsNotUsedAsValues"已删除。请从配置中删除它。
  请改用"verbatimModuleSyntax"。

选项"preserveValueImports"已删除。请从配置中删除它。
  请改用"verbatimModuleSyntax"。
```

### 问题原因
1. **依赖版本过旧**：项目使用的 `@vue/tsconfig@0.1.3`（2022年2月发布）包含了已废弃的 TypeScript 编译器选项
2. **配置继承冲突**：项目通过 `"extends": "@vue/tsconfig/tsconfig.json"` 继承了基础配置，其中包含：
   - `importsNotUsedAsValues: "error"` 
   - `preserveValueImports: true`
3. **TypeScript 版本更新**：新版 TypeScript 移除了上述两个选项，统一使用 `verbatimModuleSyntax` 替代

## 🔧 修复方案

### 执行的改动

#### 1. 升级依赖包
```bash
pnpm add -D @vue/tsconfig@^0.9.1 typescript@^5.8.2 vue-tsc@^3.3.2
```

**变更详情：**
- **之前**：`@vue/tsconfig@^0.4.0`、`typescript@^4.9.4`、`vue-tsc@^1.0.24`
- **之后**：`@vue/tsconfig@^0.9.1`、`typescript@^5.8.2`、`vue-tsc@^3.3.2`
- **兼容性**：✅ `pnpm type-check` 已通过

#### 2. 配置文件状态
**文件**：[tsconfig.json](file://d:\Code\pokedex\tsconfig.json)

```json
{
  "extends": "@vue/tsconfig/tsconfig.json",
  "compilerOptions": {
    "sourceMap": true,
    "moduleResolution": "bundler",
    "skipLibCheck": true,
    "verbatimModuleSyntax": true,  // ✅ 已正确配置
    "paths": {
      "@/*": ["./src/*"]
    },
    "lib": ["esnext", "dom"],
    "types": ["@dcloudio/types", "node"]
  },
  "include": ["src/**/*.ts", "src/**/*.d.ts", "src/**/*.tsx", "src/**/*.vue"]
}
```

**说明**：本地配置无需修改，已有的 `verbatimModuleSyntax: true` 会覆盖继承的配置。

## 📊 版本对比

### 类型检查工具链

| 工具 | 之前 | 之后 | 状态 |
|------|------|------|------|
| `@vue/tsconfig` | `^0.4.0` | `^0.9.1` | ✅ 与当前 Vue/TS 工具链匹配 |
| `typescript` | `^4.9.4` | `^5.8.2` | ✅ 支持 `moduleResolution: "bundler"` 和 `verbatimModuleSyntax` |
| `vue-tsc` | `^1.0.24` | `^3.3.2` | ✅ 支持新版 Vue 语言服务 |

### 关键改进
1. **升级 TypeScript**：解决 TS 4.9 不支持 `moduleResolution: "bundler"` 和 `verbatimModuleSyntax` 的问题
2. **升级 vue-tsc**：避免旧版 Vue 类型检查器将虚拟 `.vue.js` 文件错误纳入编译
3. **同步 @vue/tsconfig**：使用与 TypeScript 5.8 兼容的 Vue 官方配置

## ✅ 验证结果

### 环境信息
- **TypeScript 版本**：5.8.2
- **@vue/tsconfig 版本**：0.9.1
- **vue-tsc 版本**：3.3.2
- **兼容性检查**：✅ `pnpm type-check` 通过

### 预期效果
- ✅ TypeScript 编译器不再报告废弃选项错误
- ✅ 类型导入/导出行为保持一致
- ✅ `<script setup>` 语法正常工作
- ✅ 构建和开发流程不受影响

## 📝 技术说明

### verbatimModuleSyntax 的作用
该选项控制 TypeScript 如何处理类型导入和导出：
- **启用后**：任何带有 `type` 修饰符的导入/导出会被完全删除
- **未修饰的导入/导出**：保留不变（对 `<script setup>` 很重要）
- **优势**：更清晰的类型分离，减少运行时开销

### 版本选择
当前使用 `@vue/tsconfig@0.9.1`，它要求 TypeScript >= 5.8；因此同步升级 TypeScript 到 5.8.2，并升级 `vue-tsc` 到 3.3.2。

## 🎯 后续建议

### 最佳实践
- 定期检查 TypeScript 和相关配置的更新
- 关注 `@vue/tsconfig` 的发布说明
- 在升级前阅读 breaking changes 文档

## 📚 参考资料
- [TypeScript 5.0 - verbatimModuleSyntax](https://devblogs.microsoft.com/typescript/announcing-typescript-5-0/#verbatimmodulesyntax)
- [@vue/tsconfig GitHub](https://github.com/vuejs/tsconfig)
- [Vue 3 TypeScript 支持](https://vuejs.org/guide/typescript/overview.html)

---

**修复人员**：AI Assistant  
**审核状态**：待确认  
**影响范围**：仅 TypeScript 配置，不影响运行时行为
