# 加密方案

> 图鉴数据和精灵图片统一使用 AES-256-GCM 加密（ZKDX 格式）。
> 后端负责加密和分发，前端 WASM 运行时解密。

---

## 1. 设计原则

- **统一格式**：数据文件（`.bin`）和图片文件（加密后的 `.bin`）使用完全相同的 ZKDX 格式
- **后端加密 CLI**：加密在 `zukan-server` 项目中通过 CLI 二进制完成，构建时一次性加密
- **前端解密**：WASM `decryptZukan()` 运行时解密，与加密方式无关
- **加密即保护**：加密后的资源公开分发，密钥通过鉴权接口下发，资源本身无需认证

---

## 2. ZKDX 文件格式

所有加密资源（数据和图片）统一使用此格式：

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
| 0 | 4 | magic | ASCII `ZKDX`（`0x5A 0x4B 0x44 0x58`），文件类型标识 |
| 4 | 1 | version | 密钥版本号，当前恒为 `1` |
| 5 | 12 | nonce | AES-GCM 初始化向量，每次加密随机生成 |
| 17 | N - 17 | ciphertext + tag | AES-256-GCM 加密输出，末尾 16 字节为 GCM 认证标签 |

最小文件长度：`5 (header) + 12 (nonce) + 16 (tag) = 33 B`

常量定义（各端保持一致）：

| 常量 | 后端 `wasm-crypto/src/lib.rs` | 后端 `zukan/mod.rs` | 前端 `crypto.rs` |
|------|---|---|---|
| MAGIC | `b"ZKDX"` | `b"ZKDX"` | `b"ZKDX"` |
| FORMAT_VERSION | `1` | `1` | `1` |
| HEADER_SIZE | `5` | `5` | `5` |

---

## 3. 全链路架构

```
                    ┌───────────────────────────┐
                    │   构建时 CLI 加密           │
                    │   cargo run --bin encrypt   │
                    └──────────┬────────────────┘
                               │
                    ┌──────────┴──────────┐
                    ▼                     ▼
           ┌──────────────┐     ┌──────────────────┐
           │ zukan_data/   │     │ encrypted-assets/ │
           │ red/001.bin   │     │ pokemon/25/       │
           │ (ZKDX)        │     │   default.bin     │
           └──────┬───────┘     │   shiny.bin        │
                  │             └────────┬─────────┘
                  │                      │
                  ▼                      ▼
           ┌──────────────────────────────────────┐
           │         Axum 服务端（文件分发）         │
           │                                      │
           │  /api/v1/zukan/{era}/{id}  需要认证   │
           │  /api/v1/zukan/key         需要认证   │
           │  /assets/encrypted/*       无需认证   │
           └───────────────────┬──────────────────┘
                               │
                               ▼
                      ┌────────────────┐
                      │  前端 WASM 解密  │
                      │ decryptZukan() │
                      │  src/infra/    │
                      │  wasm/         │
                      └────────┬───────┘
                               │
                    ┌──────────┴──────────┐
                    ▼                     ▼
              ┌─────────┐          ┌────────────┐
              │ 图鉴数据  │          │ Blob URL   │
              │ (JSON)   │          │ → <img>    │
              └─────────┘          └────────────┘
```

---

## 4. 后端加密：CLI 预加密

在 `zukan-server` 中新增一个 CLI 二进制，遍历原始 PNG 输出 ZKDX 文件。加密在构建/部署时一次性完成，运行时零开销。

**新增文件**：`crates/server/src/bin/encrypt-assets.rs`

```rust
// crates/server/src/bin/encrypt-assets.rs
//
// 批量加密精灵图片：读取 assets/public/pokemon/{id}/*.png
// 输出 ZKDX 格式到 assets/encrypted-assets/{id}/*.bin
//
// 使用：ZUKAN_DEK=... cargo run --bin encrypt-assets

use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use std::path::PathBuf;
use std::{env, fs};
use walkdir::WalkDir;

const VERSION: u8 = 1;
const NONCE_SIZE: usize = 12;

fn main() {
    let dek_hex = env::var("ZUKAN_DEK").expect("ZUKAN_DEK required");
    let key_bytes = hex::decode(&dek_hex).expect("invalid hex");
    let key = aes_gcm::Key::<Aes256Gcm>::from_slice(&key_bytes);
    let cipher = Aes256Gcm::new(&key);

    let input_dir = PathBuf::from("assets/public");
    let output_dir = PathBuf::from("assets/encrypted-assets");

    for entry in WalkDir::new(&input_dir) {
        let entry = entry.unwrap();
        if entry.path().extension().unwrap_or_default() != "png" { continue; }

        let png = fs::read(entry.path()).unwrap();

        // AES-256-GCM 加密
        let nonce_bytes = rand::random::<[u8; NONCE_SIZE]>();
        let nonce = Nonce::from_slice(&nonce_bytes);
        let ciphertext = cipher.encrypt(&nonce, &*png).unwrap();

        // 组装 ZKDX
        let mut zkdx = Vec::with_capacity(5 + NONCE_SIZE + ciphertext.len());
        zkdx.extend_from_slice(b"ZKDX");
        zkdx.push(VERSION);
        zkdx.extend_from_slice(&nonce_bytes);
        zkdx.extend_from_slice(&ciphertext);

        // 输出
        let rel = entry.path().strip_prefix(&input_dir).unwrap();
        let out = output_dir.join(rel).with_extension("bin");
        fs::create_dir_all(out.parent().unwrap()).unwrap();
        fs::write(&out, &zkdx).unwrap();
    }
}
```

编译 & 运行：

```bash
# 在 zukan-server 目录下
ZUKAN_DEK=<hex-key> cargo run --bin encrypt-assets

# 或写入 Makefile
encrypt:
	ZUKAN_DEK=$$(grep ZUKAN_DEK .env | cut -d= -f2) \
		cargo run --bin encrypt-assets
```

---

## 5. 后端资源服务

### 5.1 路由配置

```rust
// crates/server/src/api/mod.rs
pub fn build_router(state: AppState) -> Router {
    let encrypted_assets_dir = format!("{}/encrypted-assets", state.config.assets_dir);

    Router::new()
        .route("/health", get(health))
        .nest("/auth", auth_routes)

        // 加密数据：需认证
        .nest("/zukan", zukan_routes)

        // 加密静态资源（预加密图片）：无需认证，加密即保护
        .nest_service("/assets/encrypted", ServeDir::new(&encrypted_assets_dir))

        .layer(/* Cache-Control, TraceLayer */)
        .with_state(state)
}
```

### 5.2 资源路径对照

| 前端 URL | 服务端读文件 | 说明 |
|---|---|---|
| `GET /api/v1/zukan/red/001` | `zukan_data/red/001.bin` | 加密数据（需认证） |
| `GET /api/v1/zukan/key` | — | 返回 DEK（需认证） |
| `GET /assets/encrypted/pokemon/25/default.bin` | `assets/encrypted-assets/pokemon/25/default.bin` | 加密精灵图（无需认证） |

---

## 6. 前端 WASM 解密模块

所有解密代码位于前端 `src/infra/wasm/`，与后端加密无关。

### 文件结构

| 文件 | 职责 |
|---|---|
| `src/infra/wasm/src/crypto.rs` | Rust 核心：`decrypt_zukan()`、`is_valid_zukan_file()`、`get_zukan_version()` |
| `src/infra/wasm/src/lib.rs` | WASM 绑定：`#[wasm_bindgen]` 导出到 JavaScript |
| `src/infra/wasm/index.ts` | TypeScript 封装：对外暴露类型安全 API |

### TypeScript API

```typescript
import {
  initWasm,
  decryptZukan,      // 解密 ZKDX 格式数据/图片
  isValidZukanFile,  // 校验 ZKDX 文件头
  getZukanVersion,   // 获取密钥版本
} from '@/infra/wasm'
```

### 前端解密流程

```typescript
import { initWasm, decryptZukan } from '@/infra/wasm'

async function loadPokemonSprite(id: number, variant = 'default'): Promise<string> {
  await initWasm()

  // 1. 获取密钥（需认证）
  const resp = await fetch('/api/v1/zukan/key', {
    headers: { Authorization: `Bearer ${token}` },
  })
  const { dek } = await resp.json()

  // 2. 请求加密图片（无需认证）
  const encResp = await fetch(`/assets/encrypted/pokemon/${id}/${variant}.bin`)
  const encrypted = new Uint8Array(await encResp.arrayBuffer())

  // 3. WASM 解密 → Blob URL
  const decrypted = decryptZukan(encrypted, dek)
  return URL.createObjectURL(new Blob([decrypted], { type: 'image/png' }))
}
```

---

## 7. EncryptedSprite 前端组件

```vue
<!-- src/components/sprite/EncryptedSprite.vue -->
<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { initWasm, decryptZukan } from '@/infra/wasm'

const props = defineProps<{
  pokemonId: number
  variant?: string   // default / shiny / home 等
}>()

const blobUrl = ref<string | null>(null)
const loading = ref(true)

// ── 密钥缓存（全局共享） ──
let keyPromise: Promise<{ dek: string }> | null = null

async function getKey(): Promise<{ dek: string }> {
  if (!keyPromise) {
    keyPromise = fetch('/api/v1/zukan/key', {
      headers: { Authorization: `Bearer ${getToken()}` },
    }).then(r => r.json())
  }
  return keyPromise
}

// ── 解密结果 LRU 缓存 ──
const decryptedCache = new Map<string, string>()
const MAX_CACHE = 200

onMounted(async () => {
  const cacheKey = `${props.pokemonId}/${props.variant || 'default'}`

  // 1. 命中缓存
  const cached = decryptedCache.get(cacheKey)
  if (cached) { blobUrl.value = cached; loading.value = false; return }

  // 2. 初始化 WASM（幂等）
  await initWasm()

  // 3. 获取密钥
  const { dek } = await getKey()

  // 4. 请求加密图片
  const resp = await fetch(
    `/assets/encrypted/pokemon/${props.pokemonId}/${props.variant || 'default'}.bin`
  )
  const encrypted = new Uint8Array(await resp.arrayBuffer())

  // 5. WASM 解密
  const decrypted = decryptZukan(encrypted, dek)

  // 6. Blob URL
  const url = URL.createObjectURL(new Blob([decrypted], { type: 'image/png' }))

  // 7. LRU 缓存
  if (decryptedCache.size >= MAX_CACHE) {
    const oldest = decryptedCache.keys().next().value
    if (oldest) decryptedCache.delete(oldest)
  }
  decryptedCache.set(cacheKey, url)

  blobUrl.value = url
  loading.value = false
})
</script>

<template>
  <div class="sprite-wrapper">
    <img v-if="blobUrl" :src="blobUrl" :alt="`Pokemon #${props.pokemonId}`" />
    <div v-else-if="loading" class="skeleton" />
  </div>
</template>
```

---

## 8. 缓存策略

| 资源 | Cache-Control | 说明 |
|---|---|---|
| `/api/v1/zukan/{era}/{id}` | `private, max-age=3600` | 认证态，CDN 不缓存 |
| `/api/v1/zukan/key` | `private, no-cache` | 每次重新获取 |
| `/assets/encrypted/*` | `public, max-age=31536000, immutable` | 预加密不可变文件，CDN 大力缓存 |

---

## 9. 实施步骤

| 步骤 | 内容 | 项目 |
|---|---|---|
| 1 | 新增 CLI 二进制 `crates/server/src/bin/encrypt-assets.rs` | `zukan-server` |
| 2 | 注册 `/assets/encrypted/*` 路由（`ServeDir`） | `zukan-server` |
| 3 | 运行 `make encrypt` 批量预加密图片 | `zukan-server` 构建 CI |
| 4 | 前端编写 `EncryptedSprite.vue` 组件 | `zukan` |
| 5 | 将 `EncryptedSprite` 接入列表页和详情页 | `zukan` |

---

## 10. 参考

- 前端 WASM 模块：[`src/infra/wasm/`](../src/infra/wasm/)
- WASM TypeScript API：[`src/infra/wasm/index.ts`](../src/infra/wasm/index.ts)
- 加密核心 Rust 代码：[`src/infra/wasm/src/crypto.rs`](../src/infra/wasm/src/crypto.rs)
- 服务端路由聚合：[`crates/server/src/api/mod.rs`](../../../zukan-server/crates/server/src/api/mod.rs)
- 服务端加密数据 handler：[`crates/server/src/features/zukan/`](../../../zukan-server/crates/server/src/features/zukan/)
- WASM crypto crate：[`crates/wasm-crypto/src/lib.rs`](../../../zukan-server/crates/wasm-crypto/src/lib.rs)