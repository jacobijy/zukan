# 数据 JSON 化转换方案

## 一、方案概述

将宝可梦对战模拟系统中的 TypeScript 数据文件转换为「纯数据 JSON + 逻辑处理 TypeScript」的分离结构。

**设计原则：**
- 静态配置数据 → JSON 文件
- 动态逻辑代码 → TypeScript 处理函数
- 运行时通过 `Object.assign()` 或 `mergeEffects()` 合并使用

## 二、文件转换状态

| 数据类型 | 源文件 | JSON 文件 | 状态 | 回调函数数量 |
|---------|--------|-----------|------|-------------|
| 性格数据 | natures.ts | natures.json | ✅ 完成 | 0（纯数据） |
| 属性克制 | typechart.ts | typechart.json | ✅ 完成 | 0（纯数据） |
| 脚本配置 | scripts.ts | scripts.json | ✅ 完成 | 0（纯数据） |
| 筛选标签 | tags.ts | tags.json | ✅ 完成 | 有分类标记 |
| 状态效果 | conditions.ts | conditions.json | ✅ 完成 | 约 48 个 |
| 道具数据 | items.ts | items.json | ✅ 完成 | 约 324 个 |
| 特性数据 | abilities.ts | abilities.json | ✅ 完成 | 约 305 个 |
| 规则配置 | rulesets.ts | rulesets.json | ✅ 完成 | 约 164 个 |
| 分级数据 | formats-data.ts | formats-data.json | ✅ 完成 | 0（纯数据） |
| 技能数据 | moves.ts | moves.json | ✅ 完成 | 约 419 个 |

## 三、JSON 数据结构规范

### 3.1 基础数据字段

所有 JSON 条目都保留以下纯数据字段：

```typescript
// 通用字段
{
  "num": number,           // 官方编号
  "name": string,          // 名称
  "isNonstandard": string, // 是否非标准（Past/Custom等）
  "gen": number,           // 世代
  "desc": string,          // 描述
  "shortDesc": string,     // 简短描述
  "rating": number,        // 评分
  "flags": {}              // 标记
}
```

### 3.2 各数据类型特有字段

#### 技能 (moves.json)
```json
{
  "accuracy": true | number,
  "basePower": number,
  "category": "Physical" | "Special" | "Status",
  "pp": number,
  "priority": number,
  "target": string,
  "type": string,
  "contestType": string,
  "boosts": { "atk": 1, "def": -1 },
  "secondary": { "chance": number, "boosts": {} },
  "critRatio": number,
  "drain": [number, number],
  "recoil": [number, number],
  "heal": [number, number],
  "forceSwitch": boolean,
  "self": {},
  "spreadModifier": string,
  "willCrit": boolean
}
```

#### 特性 (abilities.json)
```json
{
  "rating": number  // 1-5 强度评分
}
```

#### 道具 (items.json)
```json
{
  "fling": { "basePower": number },
  "megaStone": string,
  "zMove": string,
  "zMoveFrom": string,
  "onPlate": string,
  "berry": boolean,
  "naturalGift": { "basePower": number, "type": string }
}
```

#### 状态 (conditions.json)
```json
{
  "effectType": string,
  "duration": number,
  "noCopy": boolean
}
```

## 四、回调函数分类与处理方案

### 4.1 回调函数命名转换

统一去除 `on` 前缀并转为小驼峰：

```
onStart → start
onHit → hit
onResidual → residual
onModifySTAB → modifySTAB
onModifyType → modifyType
onAfterMove → afterMove
onDamagingHit → damagingHit
onSwitchIn → switchIn
```

### 4.2 回调函数分类体系

#### A. 按执行时机分类

| 类别 | 触发时机 | 示例函数 |
|-----|---------|---------|
| **启动类** | 状态/特性生效时 | `start`, `switchIn` |
| **修改类** | 数值计算前 | `modifySTAB`, `modifyType`, `modifyAtk`, `modifySpd` |
| **伤害类** | 伤害计算时 | `basePower`, `damage` |
| **命中类** | 命中判定时 | `accuracy`, `modifyAccuracy` |
| **命中后** | 技能命中后 | `hit`, `afterMove`, `damagingHit` |
| **回合类** | 每回合/每半回合 | `residual`, `residualOrder` |
| **优先级类** | 控制执行顺序 | `*Priority` |

#### B. 按数据类型分类

**技能回调函数 (Move Effects)**:
```typescript
// 基础数值计算
basePowerCallback
accuracyCallback
damageCallback
criticalHitCallback

// 命中前后
prepareHit
hit
beforeMove
afterMove
afterMoveSecondary
onDamage

// 特殊效果
stealBoosts
forceSwitch
selfBoost
```

**特性回调函数 (Ability Effects)**:
```typescript
// 数值修正
modifySTAB
modifyType
modifyAtk
modifyDef
modifySpA
modifySpD
modifySpe
modifyPriority

// 状态与抗性
immuneType
statusImmunity
updateCondition

// 触发时机
switchIn
start
residual
damagingHit
afterMoveSecondary
```

**道具回调函数 (Item Effects)**:
```typescript
onStart
onModifySpe
onModifyAtk
onDamagingHit
onResidual
onFling
```

**状态回调函数 (Condition Effects)**:
```typescript
start
residual
modifySpe
beforeMove
onEnd
```

### 4.3 运行时合并方案

#### 方案一：对象合并（推荐）

```typescript
// src/core/data/index.ts
export function mergeEffects<T>(
  data: Record<string, any>,
  effects: Record<string, any>
): T {
  const result: Record<string, any> = {};
  for (const key of Object.keys(data)) {
    result[key] = { ...data[key], ...(effects[key] || {}) };
  }
  return result as T;
}

// 使用
const MovesWithEffects = mergeEffects<MoveDataTable>(MovesJSON, MoveEffects);
```

#### 方案二：按需加载

```typescript
// 延迟加载效果函数，减少初始包体积
export function getMoveWithEffects(moveId: string) {
  const data = MovesJSON[moveId];
  const effects = MoveEffects[moveId];
  return { ...data, ...effects };
}
```

### 4.4 _handlers 元数据字段

在 JSON 中使用 `_handlers` 数组标记每个条目拥有哪些处理函数：

```json
// moves.json 示例
"acrobatics": {
  "num": 512,
  "name": "Acrobatics",
  "...": "...",
  "_handlers": ["basePowerCallback"]
},
"sleeppowder": {
  "num": 151,
  "name": "Sleep Powder",
  "_handlers": ["hit", "accuracy"]
}
```

用途：
1. 运行时快速判断条目是否有特殊逻辑
2. 类型安全检查
3. 调试与文档生成

## 五、导出层设计

### 5.1 统一导出文件 (index.ts)

```typescript
// ============= 纯数据 JSON =============
import naturesData from './json/natures.json';
import typechartData from './json/typechart.json';
import movesData from './json/moves.json';
// ...

export const Natures = naturesData as NatureDataTable;
export const TypeChart = typechartData as TypeDataTable;
export const Moves = movesData as MoveDataTable;
// ...

// ============= 效果处理函数 =============
import { MoveEffects } from './effects/move-effects';
import { AbilityEffects } from './effects/abilities-effects';
// ...

export { MoveEffects, AbilityEffects, ItemEffects, ConditionEffects };

// ============= 辅助工具 =============
export { mergeEffects, getMoveWithEffects };
```

### 5.2 向后兼容

为确保现有代码不中断，保持从原始 `.ts` 文件的导出：

```typescript
// 向后兼容：从原始 TS 文件导出
export { Moves } from './moves';
export { Abilities } from './abilities';
// ...

// 新结构：JSON + Effects
export const MovesJSON = movesData as MoveDataTable;
export { MoveEffects };
// ...
```

## 六、Effects 文件格式规范

### 6.1 TypeScript 类型安全

```typescript
// src/core/data/effects/move-effects.ts
import type { MoveDataTable } from '../sim/dex-moves';

export const MoveEffects: Record<string, Partial<MoveDataTable>> = {
  'acrobatics': {
    basePowerCallback(pokemon, target, move) {
      if (!pokemon.item) {
        return move.basePower * 2;
      }
      return move.basePower;
    },
  },
  // ...
};
```

### 6.2 函数签名保持一致

效果函数的参数签名与原始代码完全保持一致，仅去除 `on` 前缀：

```typescript
// 原始
onBasePower(basePower, pokemon, target, move) { ... }

// 转换后
basePower(basePower, pokemon, target, move) { ... }
```

## 七、实施步骤

### 阶段一：数据提取（已完成 ✅）
1. 从各 `.ts` 文件中提取纯数据字段
2. 转换为标准 JSON 格式
3. 添加 `_handlers` 元数据标记

### 阶段二：效果函数整理（待进行）
1. 提取所有回调函数到独立的 `effects/*.ts` 文件
2. 统一去除 `on` 前缀
3. 添加 TypeScript 类型注解
4. 验证函数逻辑完整性

### 阶段三：集成与验证（待进行）
1. 实现 `mergeEffects` 合并逻辑
2. 运行现有测试确保行为一致
3. 性能基准测试
4. 更新相关引用

## 八、优势与收益

| 维度 | 改进前 | 改进后 |
|-----|-------|-------|
| **数据可编辑性** | 需懂 TypeScript | 纯 JSON，可视化编辑 |
| **打包体积** | 所有代码强制打包 | 数据与逻辑分离，可按需加载 |
| **数据验证** | 无 | 可做 JSON Schema 验证 |
| **国际化** | 耦合代码 | 数据层可独立翻译 |
| **热更新** | 需重新编译 | JSON 可动态加载 |
| **测试隔离** | 数据与逻辑混合 | 可单独测试效果函数 |
