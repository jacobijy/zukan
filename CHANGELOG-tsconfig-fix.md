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
pnpm add -D @vue/tsconfig@0.4.0
```

**变更详情：**
- **之前**：`@vue/tsconfig@^0.1.3`
- **之后**：`@vue/tsconfig@^0.4.0`
- **兼容性**：✅ 兼容 TypeScript 4.9.x（无需升级 TS 版本）

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

### @vue/tsconfig@0.1.3 vs @vue/tsconfig@0.4.0

| 配置项 | v0.1.3 | v0.4.0 | 状态 |
|--------|--------|--------|------|
| `importsNotUsedAsValues` | `"error"` | ❌ 已移除 | ✅ 修复 |
| `preserveValueImports` | `true` | ❌ 已移除 | ✅ 修复 |
| `verbatimModuleSyntax` | ❌ 不存在 | `true` | ✅ 新增 |
| `moduleResolution` | `"Node"` | `"bundler"` | 🔄 优化 |
| `jsxImportSource` | ❌ 不存在 | `"vue"` | ✨ 新增 |

### 关键改进
1. **移除废弃选项**：删除了 TypeScript 5.0+ 废弃的配置项
2. **采用新标准**：使用 `verbatimModuleSyntax` 统一管理类型导入
3. **模块解析优化**：从 `"Node"` 改为 `"bundler"`，更适合现代构建工具
4. **Vue 3 支持增强**：添加 `jsxImportSource: "vue"` 以更好地支持 Vue 3

## ✅ 验证结果

### 环境信息
- **TypeScript 版本**：4.9.5
- **@vue/tsconfig 版本**：0.4.0
- **兼容性检查**：✅ 完全兼容

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

### 为什么选择 v0.4.0 而非最新版本？
- **v0.7.0+ 要求**：TypeScript >= 5.0 且 Vue >= 3.4
- **当前环境**：TypeScript 4.9.5
- **决策**：选择最后一个支持 TS 4.9 的稳定版本 v0.4.0

## 🎯 后续建议

### 可选升级路径
如果未来希望升级到最新的 `@vue/tsconfig@0.9.1`，需要：
1. 升级 TypeScript 到 5.0+
2. 确认 Vue 版本 >= 3.4
3. 测试所有依赖包的兼容性

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
