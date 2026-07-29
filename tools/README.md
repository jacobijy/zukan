# FlatBuffers 数据结构优化工具

## 目录结构

```
# 项目根目录结构
├── src/
│   ├── core/data/        # 数据层
│   │   ├── csv/          # CSV 源文件 (6 个)
│   │   └── json/         # 优化后的 JSON 数据
│   └── infra/
│       └── flatbuffers/  # FlatBuffers Schema
└── tools/                # 转换脚本（本目录）
    ├── *.py             # Python 处理脚本
    └── *.ts             # TypeScript 处理脚本
```

## 架构设计

### 前后端分离原则

- **前端逻辑数据**：JSON / FlatBuffers 二进制，仅包含 id 和数值属性（无名称文本）
- **名称文本数据**：从后端按需请求的二进制文件解析而来
- **多语言支持**：按语言生成独立的名称二进制文件，前端按需加载

```
后端生成：
  - pokemon_data.bin (逻辑数据: moves/items/abilities + 数值属性)
  - names_en.bin (英文名称数据)
  - names_zh.bin (中文名称数据)
  - names_ja.bin (日文名称数据)

前端加载：
  1. 加载 pokemon_data.bin → 核心战斗逻辑数据
  2. 根据用户语言设置加载 names_{lang}.bin → 显示名称
```

## 优化阶段

### 阶段 1: 字符串枚举化 (`convert_1_enums.py`)
将所有字符串类型字段转换为整数 ID：
- `category`: Physical/Special/Status → 0/1/2
- `target`: 15 种目标类型 → 0-14
- `type`: 19 种属性类型 → 0-20
- `contestType`: 5 种华丽大赛类型 → 0-4
- `isNonstandard`: 6 种非标准类型 → 0-5

### 阶段 2: Flags 位掩码化 (`convert_2_flags.py`)
将 38 个 flags + 22 个布尔字段压缩为 64 位 ulong：
- bits 0-37: 标准 flags (protect, mirror, contact, metronome 等)
- bits 38-59: 布尔字段 (stallingMove, ignoreAbility, selfSwitch 等)

### 阶段 3: 数据与文本分离 (`final_adjust.py`)
- 逻辑数据：`num` → `id`，移除所有 `name` 字段
- 名称文本：通过后端二进制文件按 id 解析
- CSV 作为后端生成二进制的源文件

### 阶段 4: 结构扁平化 (`convert_4_flatten.py`)
- Boost 结构标准化 (atk, def, spa, spd, spe, evasion, accuracy)
- `zMove` / `maxMove` 嵌套对象扁平化
- 单一 `secondary` 转换为 `secondaries` 数组
- 移除默认值字段 (priority=0, basePower=0 等)

## 验证

```bash
cd /home/jacobi/Code/zukan
python3 src/core/data/tools/verify_optimizations.py
```

## 优化效果

| 优化项 | 原始 | 优化后 | 节省 |
|--------|------|--------|------|
| 枚举化 | 字符串 | ubyte | ~34 KB |
| Flags 位掩码 | 60 字段 | ulong | ~33 KB |
| 数据文本分离 | 内嵌名称 | 分离 id | ~12 KB |
| 扁平化/默认值 | 嵌套/冗余 | 精简 | ~24 KB |

**JSON 总计**: 596 KB → 430 KB (**27.8% 节省**)
**FlatBuffers 二进制预估**: ~193 KB (**67.6% 节省**)
**FlatBuffers + gzip 预估**: ~87 KB (**85.4% 节省**)

## 前端名称查找接口（TypeScript）

```typescript
// 从后端加载的名称二进制文件解析后，通过 id 查找名称
interface NameTable {
  [id: number]: string;
}

// 全局名称表（从后端二进制解析）
let moveNames: NameTable = {};
let itemNames: NameTable = {};
let abilityNames: NameTable = {};
let typeNames: NameTable = {};
let natureNames: NameTable = {};

// 查找示例
function getMoveName(moveId: number): string {
  return moveNames[moveId] || `Move #${moveId}`;
}

function getItemName(itemId: number): string {
  return itemNames[itemId] || `Item #${itemId}`;
}

function getAbilityName(abilityId: number): string {
  return abilityNames[abilityId] || `Ability #${abilityId}`;
}

function getTypeName(typeId: number): string {
  return typeNames[typeId] || `Type #${typeId}`;
}

function getNatureName(natureId: number): string {
  return natureNames[natureId] || `Nature #${natureId}`;
}
```

## 枚举 JSON 生成 (`gen_enums.py`)

从本地 pokeapi CSV（默认 `/home/jacobi/Code/pokeapi/data/v2/csv`）生成 **英文 slug → id** 的枚举字典，
落地到 `src/static/enums/*.json`，共 14 份表：

```bash
# 使用默认路径
python3 tools/gen_enums.py

# 或指定
python3 tools/gen_enums.py \
  --pokeapi /path/to/pokeapi/data/v2/csv \
  --out src/static/enums
```

产物形如 `types.json`：`{ "normal": 1, "fire": 10, "fairy": 18, ... }`；前端消费：

```ts
import types from '@/static/enums/types.json'
types['fire']  // 10
```

新增 pokeapi 表想被收录时，直接在 `TABLES` 里加一行 `(csv_filename, out_filename)` 即可——
所有表都是 `identifier` 列 → id，无需额外配置。
