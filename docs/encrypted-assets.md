# 资源加密方案

> 防止简单爬虫直接下载精灵图片资源，同时保证前端（Web / 微信小程序）正常加载。

## 1. 方案选型

| 方案 | 防护力度 | 前端兼容性 | 实现成本 |
|------|----------|-----------|---------|
| Referer 检查 | 低 | ✅ `<img>` 直接用 | 极低 |
| Referer + 限速 | 中 | ✅ `<img>` 直接用 | 低 |
| **加密二进制** | **高** | ⚠️ 需 WASM 解密 | **中** |
| 签名 URL | 高 | ✅ `<img>` 直接用 | 中 |

**选择：加密二进制** — 因为前端是客户端 + 小程序，不走浏览器 `<img>`，加密后不影响加载，且防护最彻底。

---

## 2. 架构总览

```
┌──────────────────────────────────────────────────┐
│  WASM 模块                                        │
│  ├─ sha256_hash()  │   │  decrypt()              │
│  └─ hmac_sign()    │   │  decrypt_raw() ← 新增   │
│                     │   └────────────────────────│
│                     │                            │
│  Crypto key ────────┘                            │
└──────────────────────┬───────────────────────────┘
                       │
┌──────────────────────▼───────────────────────────┐
│  后端 (Rust / Axum)                               │
│                                                   │
│  GET /assets/encrypted/pokemon/25/default         │
│  ├─ 1. 读取 assets/public/pokemon/25/default.png  │
│  ├─ 2. 用 DEK 做 AES-256-GCM 加密                 │
│  │    → nonce(12B) + ciphertext                   │
│  ├─ 3. 返回 application/octet-stream              │
│  │    Cache-Control: private, max-age=3600        │
│  └─ 4. X-Dek-Version: 1                          │
└───────────────────────────────────────────────────┘
```

### 请求链路

```
前端                        后端
  │                          │
  │  GET /assets/encrypted/  │
  │  pokemon/25/default.png  │
  │ ───────────────────────→ │
  │                          ├─ 读取原始 PNG
  │                          ├─ AES-256-GCM 加密
  │  nonce(12B) + ciphertext │
  │ ←─────────────────────── │
  │                          │
  ├─ WASM decrypt_raw()      │
  ├─ Blob / ArrayBuffer      │
  └─ 渲染到页面               │
```

---

## 3. 后端改动

### 新增路由 `GET /assets/encrypted/*path`

```rust
// routes.rs: 在 build_router 中追加
.route("/assets/encrypted/*path", get(assets::get_encrypted))
```

### Handler 实现

```rust
// assets/handler.rs 新增

pub async fn get_encrypted(
    State(state): State<AppState>,
    Path(rel_path): Path<String>,
) -> Result<Response, AppError> {
    // 1. 路径穿越防护
    let base = PathBuf::from(&state.config.assets_dir).join("public");
    let full = base.join(&rel_path);
    // ... 穿越检查同 get_protected ...

    // 2. 读取原始 PNG
    let raw = tokio::fs::read(&full).await.map_err(|_| AppError::NotFound)?;

    // 3. AES-256-GCM 加密
    use aes_gcm::{
        aead::{Aead, AeadCore, KeyInit, OsRng},
        Aes256Gcm, Nonce,
    };
    let key = aes_gcm::Key::<Aes256Gcm>::from_slice(&state.config.zukan_dek);
    let cipher = Aes256Gcm::new(key);
    let nonce = Aes256Gcm::generate_nonce(&mut OsRng);
    let ciphertext = cipher
        .encrypt(&nonce, &*raw)
        .map_err(|_| AppError::Internal("加密失败".into()))?;

    // 4. 拼接 nonce(12) + ciphertext
    let mut payload = nonce.to_vec();
    payload.extend_from_slice(&ciphertext);

    // 5. 返回
    Response::builder()
        .status(200)
        .header("Content-Type", "application/octet-stream")
        .header("Cache-Control", "private, max-age=3600")
        .header("X-Dek-Version", state.config.zukan_dek_version)
        .body(Body::from(payload))
        .unwrap()
}
```

### 注意

- 使用与图鉴数据 **同一个 DEK**（`ZUKAN_DEK`），前端只需持有一个密钥
- 加密是实时的，单次耗时 < 1ms（AES-256-GCM 硬件加速），对吞吐影响极小
- 响应头 `X-Dek-Version` 让前端知道当前使用的密钥版本

---

## 4. WASM 改动

### 新增 `decrypt_raw`

当前 WASM 已有 `decrypt(key_base64, ciphertext_base64)`，它处理 base64 编码的文本数据。图片加密需要直接操作二进制：

```rust
#[wasm_bindgen]
pub fn decrypt_raw(key_base64: &str, data: &[u8]) -> Result<Vec<u8>, JsValue> {
    let key_bytes = base64_decode(&key_base64)?;
    let key = aes_gcm::Key::<Aes256Gcm>::from_slice(&key_bytes);
    let cipher = Aes256Gcm::new(key);

    if data.len() < 12 {
        return Err("数据太短".into());
    }
    let (nonce_bytes, ciphertext) = data.split_at(12);
    let nonce = Nonce::from_slice(nonce_bytes);

    let plaintext = cipher
        .decrypt(nonce, ciphertext)
        .map_err(|_| "解密失败")?;

    Ok(plaintext)
}
```

### TypeScript 封装

```ts
// src/infra/wasm/index.ts

/**
 * 解密加密图片二进制数据
 * @param key Base64 编码的 AES 密钥
 * @param encrypted 服务器返回的原始 ArrayBuffer（nonce + ciphertext）
 * @returns 解密后的 PNG 字节
 */
export function decryptImage(key: string, encrypted: ArrayBuffer): Uint8Array {
  assertWasmReady()
  return wasmModule!.decrypt_raw(key, new Uint8Array(encrypted))
}
```

---

## 5. 前端改动

### 5.1 Web 客户端

```tsx
// src/components/EncryptedSprite.tsx

import { initWasm, decryptImage } from '@/infra/wasm'

// 假设密钥通过安全接口获取
let cryptoKey: string | null = null
async function getKey(): Promise<string> {
  if (cryptoKey) return cryptoKey
  const resp = await fetch('/api/crypto-key')  // 或从本地存储读取
  const data = await resp.json()
  cryptoKey = data.key
  return cryptoKey!
}

export function EncryptedSprite({ pokemonId, variant }: Props) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null)

  useEffect(() => {
    let revoked = false
    ;(async () => {
      await initWasm()
      const key = await getKey()
      const resp = await fetch(`/assets/encrypted/pokemon/${pokemonId}/${variant}`)
      const encrypted = await resp.arrayBuffer()
      const decrypted = decryptImage(key, encrypted)
      const blob = new Blob([decrypted], { type: 'image/png' })
      const url = URL.createObjectURL(blob)
      if (!revoked) setBlobUrl(url)
    })()
    return () => { revoked = true; if (blobUrl) URL.revokeObjectURL(blobUrl) }
  }, [pokemonId, variant])

  if (!blobUrl) return <div className="skeleton" />
  return <img src={blobUrl} alt={`Pokemon #${pokemonId}`} />
}
```

### 5.2 微信小程序

```ts
// utils/encrypted-asset.ts

const CRYPTO_KEY = '...' // 固化在小程序代码中或从服务器获取

async function loadEncryptedSprite(path: string): Promise<string> {
  return new Promise((resolve, reject) => {
    wx.request({
      url: `https://api.zukan.dev/assets/encrypted/${path}`,
      responseType: 'arraybuffer',
      success(res) {
        // 使用 WASM 解密
        const wasm = require('../wasm/pkg')
        const decrypted = wasm.decrypt_raw(CRYPTO_KEY, new Uint8Array(res.data as ArrayBuffer))
        const base64 = wx.arrayBufferToBase64(decrypted.buffer)
        resolve('data:image/png;base64,' + base64)
      },
      fail: reject,
    })
  })
}

// 使用
// <image src="{{spriteUrl}}" />
Page({
  data: { spriteUrl: '' },
  async onLoad() {
    const url = await loadEncryptedSprite('pokemon/25/default')
    this.setData({ spriteUrl: url })
  }
})
```

---

## 6. 密钥管理

### 密钥从哪里来

- 后端环境变量 `ZUKAN_DEK`（32 字节 hex），与图鉴数据共用
- 前端第一次启动时，通过一个额外接口获取

```
GET /api/crypto-key
Authorization: Bearer <token>  // 需要登录
Response: { key: "base64encodedkey..." }
```

### 或者：固化密文

如果不想每次请求都先拿密钥，可以将密钥打包到小程序代码中（前提是小程序包不会被轻易逆向）：

```ts
// 小程序代码中直接嵌入
const CRYPTO_KEY = atob('c2VjdXJl...') // 至少做一层混淆
```

> **注意**：密钥在前端无法做到绝对安全，只能提高爬虫门槛。如果要求极高安全性，应使用签名 URL 方案。

---

## 7. 缓存策略

| 场景 | 缓存方式 |
|------|---------|
| **后端** | 不缓存加密结果，实时加密（开销极小） |
| **CDN** | 不可缓存（`private` 指令），或按 `Vary: Authorization` 缓存 |
| **前端** | `decrypted` 结果用 `URL.createObjectURL`，组件卸载时 revoke |
| **小程序** | 自己维护 LRU 缓存，避免重复解密 |

---

## 8. 其他资源路径对照

| 前端构造的 URL | 后端读取的文件 |
|----|----|
| `/assets/encrypted/pokemon/25/default` | `assets/public/pokemon/25/default.png` |
| `/assets/encrypted/pokemon/25/shiny` | `assets/public/pokemon/25/shiny.png` |
| `/assets/encrypted/pokemon/25/home` | `assets/public/pokemon/25/home.png` |
| `/assets/encrypted/pokemon/25/versions/1/red-blue` | `assets/public/pokemon/25/versions/1/red-blue.png` |
| `/assets/encrypted/pokemon/25/versions/1/red-blue/back` | 同上，子变体处理 |
| `/assets/encrypted/items/242` | `assets/public/items/242.png` |
| `/assets/encrypted/types/10` | `assets/public/types/10.png` |
| `/assets/encrypted/badges/1` | `assets/public/badges/1.png` |

---

## 9. 实施步骤

1. **WASM** — 加 `decrypt_raw` 函数并构建
2. **后端** — 加 `get_encrypted` handler，注册路由
3. **前端** — 封装 `EncryptedSprite` 组件（Web）/ 工具函数（小程序）
4. **密钥分发** — 确定前端获取密钥的方式（登录接口或固化）
5. **测试** — 验证 Web + 小程序 两端正常加载