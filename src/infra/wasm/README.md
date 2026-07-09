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

## 📁 目录结构

```
wasm/
├── src/
│   ├── lib.rs          # 模块入口 + 导出
│   ├── crypto.rs       # 加密解密
│   └── calculator.rs   # 伤害计算器
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
