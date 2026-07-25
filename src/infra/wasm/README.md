# Zukan WASM Module

宝可梦图鉴高性能 WASM 模块，提供加密解密和战斗计算功能。

## 📋 功能列表

### 🔐 图鉴二进制文件加解密
- **AES-256-GCM** 加密解密（ZKDX 二进制格式）
- 文件格式校验与版本查询
- 通用密钥生成（Hex 编码）、SHA-256 哈希、HMAC-SHA256 签名与验证

### ⚔️ 伤害计算器
- 伤害计算（第 5-9 代公式）
- 批量伤害范围计算
- 能力值计算
- 性格修正查询

### 📦 FlatBuffers 解码
- 解码 zukan-server `assets/fb/*.bin` 的四种 root：
  - `PokemonGenBundle` (fid `PKMB`) — 宝可梦基础参数（gen-1..9）
  - `PokemonVgMovesBundle` (fid `PMOV`) — 招式学习记录（原始行式）
  - `PokemonMovesBundle` (fid `PMSB`) — 招式学习记录（按宝可梦聚合）
  - `MovesDataBundle` (fid `MDAT`) — 招式定义

## 🚀 快速开始

### 前置依赖

```bash
# 安装 Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# 安装 wasm-pack
cargo install wasm-pack
```

### 构建

```bash
cd src/infra/wasm

# 开发构建
pnpm build

# 发布构建（优化体积）
pnpm build:release

# 运行测试
pnpm test
```

### 前端使用

```typescript
import {
  initWasm,
  sha256,
  calculateDamage,
  calculateDamageBatch,
} from '@/infra/wasm';

// 1. 初始化 WASM 模块（只需一次）
await initWasm();

// 2. 使用加密功能
const hash = sha256('hello pokemon');
console.log(hash);

// 3. 使用伤害计算
const damage = calculateDamage({
  level: 50,
  attack: 120,
  defense: 100,
  basePower: 80,
  stab: 150,        // 1.5x
  typeEffectiveness: 200,  // 2x
  burnMod: 100,
});

console.log('单次伤害:', damage);

// 4. 批量计算所有随机范围
const range = calculateDamageBatch({
  level: 50,
  attack: 120,
  defense: 100,
  basePower: 80,
  stab: 150,
  typeEffectiveness: 200,
});

console.log('伤害范围:', range.min, '-', range.max);
console.log('平均伤害:', range.average);
```

## 📐 API 文档

### 图鉴二进制文件加解密

| 函数 | 参数 | 返回值 | 说明 |
|------|------|--------|------|
| `decryptZukan(data, dekHex)` | Uint8Array, string | Uint8Array | 解密 ZKDX 格式加密数据 |
| `encryptZukan(plaintext, dekHex, version)` | Uint8Array, string, number | Uint8Array | 加密为 ZKDX 格式二进制文件 |
| `isValidZukanFile(data)` | Uint8Array | boolean | 校验是否为合法 ZKDX 文件 |
| `getZukanVersion(data)` | Uint8Array | number | 获取密钥版本号 |
| `generateKey()` | - | string | 生成 Hex 编码的 256 位密钥 |
| `sha256(data)` | string | string | SHA-256 哈希 |
| `hmacSign(key, data)` | string, string | string | HMAC 签名 |
| `hmacVerify(key, data, sig)` | - | boolean | 验证签名 |

### 伤害计算

| 函数 | 说明 |
|------|------|
| `calculateDamage(input)` | 单次伤害计算 |
| `calculateDamageBatch(input)` | 16 种随机值范围计算 |
| `calculateStat(level, base, iv, ev, natureMod)` | 能力值计算 |
| `calculateHp(level, base, iv, ev)` | HP 计算 |
| `getNatureMod(natureId)` | 获取性格修正 |

### FlatBuffers 解码

| 函数 | 参数 | 返回值 | 说明 |
|------|------|--------|------|
| `decodePokemonGenBundle(data)` | Uint8Array | `PokemonGenBundle` | 解码 `gen-N.bin` (fid `PKMB`) |
| `decodePokemonVgMovesBundle(data)` | Uint8Array | `PokemonVgMovesBundle` | 解码 `moves/vg-XX.bin` (fid `PMOV`) |
| `decodePokemonMovesBundle(data)` | Uint8Array | `PokemonMovesBundle` | 解码 `pokemon_moves/*.bin` (fid `PMSB`) |
| `decodeMovesDataBundle(data)` | Uint8Array | `MovesDataBundle` | 解码 `moves_data/*.bin` (fid `MDAT`) |

字段命名、类型、有符号字段（`genderRate/priority/metaAilmentId/drain/healing/change`）
和哨兵值语义严格遵循 [zukan-server `assets/fb/README.md`](../../../../../zukan-server/assets/fb/README.md)。

**使用示例：**

```typescript
import {
  initWasm,
  decodePokemonGenBundle,
  decodePokemonMovesBundle,
} from '@/infra/wasm';

await initWasm();

// 加载 gen-3 全部宝可梦基础参数
const resp = await fetch('/dev-fb/gen-3.bin');
const buf = new Uint8Array(await resp.arrayBuffer());
const gen3 = decodePokemonGenBundle(buf);

console.log(gen3.generationId);            // 3
console.log(gen3.baseEntries.length);      // 1351
console.log(gen3.statEntries[0]);          // { id: 1, hp: 45, attack: 49, ... }

// Clefairy (35) 在第 3 代还是 Normal
const clefairyType = gen3.typeEntries.find(t => t.id === 35);
console.log(clefairyType?.type1Id);        // 1 (Normal，Fairy 到 gen-6 才有)

// 查询 SV baseline 里 Bulbasaur 学会的招式
const common = decodePokemonMovesBundle(
  new Uint8Array(await (await fetch('/dev-fb/pokemon_moves/common.bin')).arrayBuffer())
);
const bulba = common.entries.find(e => e.pokemonId === 1);
bulba?.levelUp.forEach(({ level, moveId }) => console.log(`Lv ${level}: move ${moveId}`));
```

### Schema 同步 / 绑定生成

Schema 从 zukan-server 拉取，需要 `flatc` (>= 23.x)：

```bash
sudo apt install flatbuffers-compiler   # 或 brew install flatbuffers

# 1) 从 zukan-server 拉最新 .fbs（假设两个仓平级 checkout）
bash scripts/sync-schemas.sh

# 2) 生成 Rust 绑定（产物提交入库，位于 src/fb/generated/）
bash scripts/generate-fb.sh
```

绑定产物在 `.gitattributes` 里标为 `linguist-generated=true`，diff 会自动折叠。

**测试**（`cargo test --release --test fb`）依赖邻居仓路径 `../../../../zukan-server/assets/fb/*.bin`
作为 fixture。若 CI 只 checkout `zukan`，把 fixture 复制到 `tests/fixtures/` 并调整
`tests/fb.rs` 里的 `include_bytes!` 路径。

## 📁 目录结构

```
wasm/
├── src/
│   ├── lib.rs          # 模块入口 + 导出
│   ├── crypto.rs       # 加密解密
│   ├── calculator.rs   # 伤害计算器
│   └── fb/             # FlatBuffers 解码
│       ├── mod.rs      # 入口 + FbDecodeError
│       ├── decode.rs   # 四个 root 的 decode 实现
│       ├── convert.rs  # Serialize-able owned 结构体
│       └── generated/  # flatc 生成产物（linguist-generated）
├── schemas/            # .fbs IDL（同步自 zukan-server/assets/fb/schemas）
├── scripts/
│   ├── sync-schemas.sh # 从 zukan-server 拉最新 schema
│   └── generate-fb.sh  # 调 flatc --rust 生成 Rust 绑定
├── tests/fb.rs         # 4 root × 抽样 + negative case（依赖邻居仓 fixture）
├── pkg/                # 构建产物（gitignore）
├── Cargo.toml          # Rust 配置
├── package.json        # npm 脚本
├── index.ts            # TypeScript 封装
└── README.md           # 本文档
```

## ⚡ 性能基准

| 操作 | JavaScript | WASM | 提升 |
|------|------------|------|------|
| SHA-256 (1KB) | 1x | ~3x | +200% |
| 伤害计算 (1万次) | 1x | ~8x | +700% |
| AES 加密 (1KB) | 1x | ~2.5x | +150% |

## 📝 注意事项

1. **初始化时机**: WASM 是异步加载，需在使用前调用 `initWasm()`
2. **类型安全**: `index.ts` 提供完整的 TypeScript 类型包装
3. **体积**: release 构建约 200KB，gzip 后约 80KB
4. **浏览器兼容性**: 所有现代浏览器支持 WASM（Chrome 61+, Firefox 54+, Safari 11+）
