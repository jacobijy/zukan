# 图鉴二进制文件解密文档

## 概述

图鉴数据以 AES-256-GCM 加密的 `.bin` 文件形式下发，前端在内存中解密后使用。服务端不解密——它只存储和转发密文。

## 文件格式

```
┌─────────┬─────────┬──────────┬──────────────────────────┐
│ magic   │ version │  nonce   │  ciphertext + tag        │
│ (4 B)   │  (1 B)  │ (12 B)   │  (N - 17 B)              │
├─────────┼─────────┼──────────┼──────────────────────────┤
│ Z K D X │   0x01  │  随机值  │  AES-256-GCM 输出         │
└─────────┴─────────┴──────────┴──────────────────────────┘
```

| 偏移 | 长度 | 字段 | 说明 |
|------|------|------|------|
| 0 | 4 | magic | 魔数 `ZKDX`（`0x5A 0x4B 0x44 0x58`），用于快速识别文件类型 |
| 4 | 1 | version | 密钥版本号，决定使用哪一代 DEK |
| 5 | 12 | nonce | AES-GCM 初始化向量（IV），每次加密随机生成 |
| 17 | N - 17 | ciphertext + tag | AES-256-GCM 加密输出，末尾 16 字节为认证标签 |

**最小文件长度**：`5 (header) + 12 (nonce) + 16 (tag) = 33 B`

## 解密流程

```
加密文件 (.bin)                    DEK (hex, 64 字符)
     │                                  │
     ▼                                  ▼
 ┌─────────┐     ┌──────────┐     ┌──────────┐
 │ magic   │ ──► │  校验    │     │ hex → 32B│
 │ = ZKDX? │     │ 版本号   │     │  密钥    │
 └─────────┘     └──────────┘     └──────────┘
     │                │                │
     ▼                ▼                ▼
 ┌─────────────────────────────────────────┐
 │       AES-256-GCM 解密                   │
 │       cipher.decrypt(nonce, payload)     │
 └─────────────────────────────────────────┘
                    │
                    ▼
              ┌──────────┐
              │  明文数据  │
              │ (Vec<u8>) │
              └──────────┘
```

### 步骤详解

1. **长度校验**：`len >= 5 + 12 + 16`，不足则拒绝
2. **Magic 校验**：前 4 字节必须等于 `b"ZKDX"`
3. **版本校验**：第 5 字节必须等于支持的最高版本（当前 `1`），否则说明 DEK 版本不匹配
4. **提取 nonce**：从第 5\~16 字节取出 12 字节 nonce
5. **提取密文**：剩余全部字节作为 `ciphertext_with_tag`（末尾 16 字节为 GCM 认证标签）
6. **解析 DEK**：hex 字符串解码为 32 字节 AES-256 密钥
7. **AES-256-GCM 解密**：使用 nonce + 密钥解密，认证标签自动验证完整性

## 密钥管理

### 数据加密密钥（DEK）

- **长度**：32 字节（256 位）
- **编码**：hex 字符串（64 字符）
- **来源**：服务端环境变量 `ZUKAN_DEK`
- **版本**：`ZUKAN_DEK_VERSION`（当前 `1`）
- **下发接口**：`GET /api/v1/zukan/key`（需鉴权）

### 密钥轮换流程

当 DEK 需要轮换时：

1. 服务端设置新的 `ZUKAN_DEK`，递增 `ZUKAN_DEK_VERSION`
2. 服务端用新 DEK 重加密全部 `.bin` 文件（更新 version 字节）
3. 客户端调用 `GET /api/v1/zukan/key` 获取新 DEK + version
4. 客户端用新 DEK 和文件中的 version 字节匹配解密
5. 旧版本文件可保留或淘汰

## 项目中的实现

### 前端（解密端）

| 文件 | 职责 |
|------|------|
| `src/infra/wasm/src/crypto.rs` | Rust 核心：`decrypt_zukan()`、`encrypt_zukan()`、`is_valid_zukan_file()`、`get_zukan_version()` |
| `src/infra/wasm/src/lib.rs` | WASM 绑定：将上述函数导出到 JavaScript |
| `src/infra/wasm/index.ts` | TypeScript 封装：`decryptZukan()`、`encryptZukan()`、`isValidZukanFile()`、`getZukanVersion()` |

### 服务端（加密/分发端）

| 文件 | 职责 |
|------|------|
| `crates/wasm-crypto/src/lib.rs` | Rust 核心：定义文件格式常量、加密解密实现（与前端 crypto.rs 一致） |
| `crates/server/src/features/zukan/` | Axum handler：`GET /api/v1/zukan/{era}/{id}` 下发密文，`GET /api/v1/zukan/key` 下发 DEK |
| `crates/server/src/api/mod.rs` | 路由聚合与 `/api/v1` 前缀（具体路由表在各 feature 的 `routes.rs`） |
| `crates/server/src/config.rs` | 环境变量解析：`ZUKAN_DEK`、`ZUKAN_DEK_VERSION` |
| `openspec/specs/zukan-binary/spec.md` | 加密二进制下发规范 |

## 前端接入示例

```typescript
import { initWasm, decryptZukan, isValidZukanFile } from '@/infra/wasm';

await initWasm();

// 1. 从服务端获取加密文件
const resp = await fetch('/api/v1/zukan/red/001', {
  headers: { Authorization: `Bearer ${token}` },
});
const encrypted = new Uint8Array(await resp.arrayBuffer());

// 2. 检查文件格式
if (!isValidZukanFile(encrypted)) {
  throw new Error('Invalid zukan file format');
}

// 3. 获取 DEK
const keyResp = await fetch('/api/v1/zukan/key', {
  headers: { Authorization: `Bearer ${token}` },
});
const { dek } = await keyResp.json();

// 4. 解密
const plaintext = decryptZukan(encrypted, dek);
// plaintext 即图鉴明文数据
```

## 常量对照表

| 常量 | 前端 `src/infra/wasm/src/crypto.rs` | 后端 `crates/wasm-crypto/src/lib.rs` | 后端 `crates/server/src/features/zukan/service.rs` |
|------|---|---|---|
| MAGIC | `b"ZKDX"` | `b"ZKDX"` | `b"ZKDX"` |
| FORMAT_VERSION | `1` | `1` | `1` |
| NONCE_SIZE | `12` | `12` |（硬编码 12） |
| TAG_SIZE | `16` | `16` |（硬编码 16） |
| HEADER_SIZE | `5` | `5` | `5` |

## 更新指南

当解密逻辑需要变更时，按以下步骤操作：

### 新增加密算法

1. 在 `crypto.rs` 中添加新的解密函数（如 `decrypt_zukan_v2()`）
2. 在 `crypto.rs` 中更新 `FORMAT_VERSION` 或在 `decrypt_zukan()` 中按 version 分派
3. 在 `lib.rs` 中添加对应的 `#[wasm_bindgen]` 导出
4. 在 `index.ts` 中添加 TypeScript 封装
5. **同步更新后端** `crates/wasm-crypto/src/lib.rs` 中的对应函数
6. 更新本文档的格式图和常量表

### 修改文件格式

- 所有文件格式常量（magic、header size 等）在前后端各有三处定义，必须同步修改
- 修改后需要更新 `openspec/specs/zukan-binary/spec.md` 规范文档

### 密钥轮换

- 仅需更新服务端环境变量，客户端代码无需改动
- 客户端 `get_zukan_version()` 可用于在 UI 中提示密钥版本变更