# 语言文本下载解密

> 语言文本（物种名、技能名、属性名、图鉴描述等）以 FlatBuffers bundle 形式加密分发，
> 每语言独立两个文件：名称组（names.bin）和描述组（flavor.bin）。
> 下载解密流程与数值 bundle 共用 `resourceManager` 基础设施。

---

## 1. 设计原则

- **与数值 bundle 共用加密格式**：同样使用 ZKDX（AES-256-GCM），同理 `decryptZukan()` 解密
- **名称与描述分离**：两个文件的原因——
  - 名称组（~170–290 KB）体积小，可按需加载界面就近的文本
  - 描述组（~600 KB–2.7 MB）占总体积约 90%，可延迟加载甚至按人称懒加载
- **单语言独立文件**：一个 bundle 只包含一种语言，语言标识写在 bundle 头部
- **字符串池**：描述组利用去重池（text_pool），重复文本只存一次，下标引用

---

## 2. 文件格式

### 2.1 加密层

与所有加密资源相同，ZKDX 格式：

```
┌─────────┬─────────┬──────────┬──────────────────────────┐
│ magic   │ version │  nonce   │  ciphertext + tag        │
│ (4 B)   │  (1 B)  │ (12 B)   │  (N - 17 B)              │
├─────────┼─────────┼──────────┼──────────────────────────┤
│ Z K D X │   0x01  │  随机值  │  AES-256-GCM 输出         │
└─────────┴─────────┴──────────┴──────────────────────────┘
```

解密后得到 FlatBuffers 二进制。详见 [`docs/encryption.md`](encryption.md) 和 [`docs/zukan-decryption.md`](zukan-decryption.md)。

### 2.2 名称组（names.bin）

**file_identifier**: `PKNM`  
**FlatBuffers root type**: `I18nNamesBundle`  
**Schema**: `tools/schemas/i18n_names_bundle.fbs`（在 zukan-server 项目中）

```fbs
table I18nNamesBundle {
  language_id: uint8;       // 上游 languages.csv 的 id
  language: string;         // 标识符：如 "zh-hans"、"en"

  // 特殊形状
  species:   [SpeciesName];   // id + name + genus
  forms:     [FormName];      // id + form_name + pokemon_name
  locations: [LocationName];  // id + name + subtitle
  shapes:    [ShapeEntry];    // id + name + awesome_name + description

  // id + 名称（只需一列文本）
  moves:     [NamedEntry];
  abilities: [NamedEntry];
  items:     [NamedEntry];
  types:     [NamedEntry];
  // ……共 28 张表，详细见 schema
}
```

典型解码后使用方式：

```typescript
// 物种名：按 id 查
bundle.species[0]  // { id: 1, name: "Bulbasaur", genus: "Seed Pokémon" }

// 技能名：按 id 查
bundle.moves[0]    // { id: 1, name: "Pound" }
```

### 2.3 描述组（flavor.bin）

**file_identifier**: `PKFL`  
**FlatBuffers root type**: `I18nFlavorBundle`  
**Schema**: `tools/schemas/i18n_flavor_bundle.fbs`

```fbs
table I18nFlavorBundle {
  language_id: uint8;
  language: string;

  // 字符串池：text_pool[0] 恒为空串，表示"无文本"
  text_pool: [string];

  // 图鉴描述（按 version_id 区分）
  species: [FlavorRef];     // FlavorRef { id, text, version }
  // 技能说明（按 version_group_id 区分）
  moves:   [FlavorRef];
  // 特性说明
  abilities: [FlavorRef];
  // 道具说明
  items:     [FlavorRef];

  // 效果说明（仅英文有数据）
  ability_effects: [ProseRef];  // ProseRef { id, short_effect, effect }
  move_effects:   [ProseRef];
}
```

字符串池查找示例：

```typescript
// text_pool[0] 恒为空串
const text = bundle.text_pool(ref.text);  // ref.text=0 → ""
```

---

## 3. 文件名与远程路径

| 语言 | 标识符 | 远程路径 |
|------|--------|----------|
| 日语（平假名） | `ja-hrkt` | `/assets/encrypted/fb/i18n/ja-hrkt/names.bin` |
| 日语（罗马音） | `ja-roma` | `/assets/encrypted/fb/i18n/ja-roma/names.bin` |
| 日语 | `ja` | `/assets/encrypted/fb/i18n/ja/names.bin` |
| 英语 | `en` | `/assets/encrypted/fb/i18n/en/names.bin` |
| 西班牙语 | `es` | `/assets/encrypted/fb/i18n/es/names.bin` |
| 法语 | `fr` | `/assets/encrypted/fb/i18n/fr/names.bin` |
| 德语 | `de` | `/assets/encrypted/fb/i18n/de/names.bin` |
| 意大利语 | `it` | `/assets/encrypted/fb/i18n/it/names.bin` |
| 韩语 | `ko` | `/assets/encrypted/fb/i18n/ko/names.bin` |
| 简体中文 | `zh-hans` | `/assets/encrypted/fb/i18n/zh-hans/names.bin` |
| 繁体中文 | `zh-hant` | `/assets/encrypted/fb/i18n/zh-hant/names.bin` |
| 巴西葡萄牙语 | `pt-br` | `/assets/encrypted/fb/i18n/pt-br/names.bin` |
| 拉美西班牙语 | `es-419` | `/assets/encrypted/fb/i18n/es-419/names.bin` |
| 捷克语 | `cs` | `/assets/encrypted/fb/i18n/cs/names.bin` |

描述组将 `names.bin` 替换为 `flavor.bin`：

```
/assets/encrypted/fb/i18n/<lang>/flavor.bin
```

---

## 4. 下载解密流程

### 4.1 沿用现有基础设施

整个流程与数值 bundle 完全一致，所有基础设施（`fetchBinary`、`decryptZukan`、`buildCdnUrl`、`binaryStorage`）都已就位：

```
memoryCache → inflight → binaryStorage → fetchBinary → decryptZukan → 解码
```

### 4.2 BundleSpec 构造

在 `resourceManager` 中新增一组合法函数：

```typescript
function specI18nNames(lang: string): BundleSpec {
  return {
    cacheKey: `${currentCacheKeyPrefix()}:i18n:names:${lang}`,
    remotePath: `/assets/encrypted/fb/i18n/${lang}/names.bin`,
  };
}

function specI18nFlavor(lang: string): BundleSpec {
  return {
    cacheKey: `${currentCacheKeyPrefix()}:i18n:flavor:${lang}`,
    remotePath: `/assets/encrypted/fb/i18n/${lang}/flavor.bin`,
  };
}
```

### 4.3 解密 & 解码

```typescript
import { initWasm, decryptZukan } from '@/infra/wasm';
import { fetchBinary, buildCdnUrl } from '@/services/http';
import { getKey } from '@/services/session/key';
import { binaryStorage } from '@/infra/storage/binaryStorage';

async function loadI18nNames(lang: string): Promise<Uint8Array> {
  await initWasm();
  const key = await getKey();
  const spec = specI18nNames(lang);

  // 1. 读存储缓存
  let bytes = await binaryStorage.get(spec.cacheKey).catch(() => null);

  // 2. miss → 远程下载
  if (!bytes) {
    bytes = await fetchBinary(buildCdnUrl(spec.remotePath, key.cdn));
    await binaryStorage.put(spec.cacheKey, bytes).catch(() => {});
  }

  // 3. ZKDX 解密
  return decryptZukan(bytes, key.dek);
}
```

### 4.4 FlatBuffers 解码

解密后的 `Uint8Array` 需用 FlatBuffers 运行时库解码。有两种方案：

**方案 A：WASM 中解码（推荐，与现有模式一致）**

在 `src/infra/wasm/src/lib.rs` 中新增 `#[wasm_bindgen]` 解码函数：

```rust
#[wasm_bindgen(js_name = decodeI18nNamesBundle)]
pub fn decode_i18n_names_bundle(data: &[u8]) -> Result<JsValue, JsValue> {
    let bundle = I18nNamesBundle::get_root_as(data);
    // 转为 JS 对象
    serialization::to_js_value(&bundle)
}
```

在 `src/infra/wasm/index.ts` 中导出：

```typescript
export function decodeI18nNamesBundle(data: Uint8Array): I18nNamesBundle {
  assertWasmReady();
  return wasmModule!.decodeI18nNamesBundle(data);
}
```

**方案 B：JavaScript 侧直接解码**

使用 `flatbuffers` npm 包，直接读取 schema 生成的表：

```typescript
import { flatbuffers } from 'flatbuffers';
import { I18nNamesBundle } from '@/infra/wasm/schemas/i18n-names-bundle'; // 待生成

function decodeNames(data: Uint8Array): I18nNamesBundle {
  const buf = new flatbuffers.ByteBuffer(data);
  return I18nNamesBundle.getRootAsI18nNamesBundle(buf);
}
```

> 推荐方案 A，与现有 decode 模式一致，且 schema 变更时只需改 Rust 一处。

---

## 5. 解码后使用

### 5.1 名称查找表

解码后创建 `Map<id, name>` 查找表，供 UI 层使用：

```typescript
interface I18nLookup {
  species: Map<number, { name: string; genus: string }>;
  moves: Map<number, string>;
  abilities: Map<number, string>;
  types: Map<number, string>;
  items: Map<number, string>;
  // ……其余表
}

function buildLookup(bundle: I18nNamesBundle): I18nLookup {
  const species = new Map(
    Array.from({ length: bundle.speciesLength() }, (_, i) => {
      const s = bundle.species(i)!;
      return [s.id(), { name: s.name()!, genus: s.genus()! }];
    })
  );
  const moves = new Map(
    Array.from({ length: bundle.movesLength() }, (_, i) => {
      const m = bundle.moves(i)!;
      return [m.id(), m.name()!];
    })
  );
  return { species, moves, /* … */ };
}
```

### 5.2 描述查找

```typescript
function lookupFlavor(
  bundle: I18nFlavorBundle,
  speciesId: number,
  versionId: number,
): string | null {
  for (let i = 0; i < bundle.speciesLength(); i++) {
    const ref = bundle.species(i);
    if (ref!.id() === speciesId && ref!.version() === versionId) {
      const text = bundle.textPool(ref!.text());
      return text || null;
    }
  }
  return null;
}
```

### 5.3 集成到现有模型

`pokemon.ts` 中的 `mergeBundleToModel` 当前使用占位符名称（`TODO(i18n)`）：

```typescript
// 当前：TODO(i18n)
name: `pokemon-${b.id}`,
formLabel: b.isDefault ? '' : `form-${b.id}`,

// 集成后：
name: i18n.species.get(b.speciesId)?.name ?? `pokemon-${b.id}`,
formLabel: b.isDefault ? '' : i18n.forms.get(b.id)?.formName ?? '',
```

---

## 6. 语言回落策略

### 6.1 上游数据缺口

| 语言 | 名称组 | 描述组 | 特性/技能效果 |
|------|--------|--------|---------------|
| en, ja-hrkt, ja, ko, zh-hans, zh-hant, fr, de, es, es-419, it | 完整 | 完整 | 仅英文有 |
| cs, pt-br | 空表 | 空表 | 无 |
| ja-roma | 仅物种名 | 空表 | 无 |

### 6.2 推荐策略

```
用户首选语言
    │
    ├─ bundle 存在 → 使用
    │
    └─ bundle 为空（0 行）→ 回落至英文（en）
        │
        └─ 指定表也空 → 显示占位符 / id
```

具体实现：

```typescript
async function getNamesBundle(lang: string): Promise<I18nNamesBundle> {
  const bundle = await loadI18nNames(lang);
  // 如果首选语言 bundle 没有实际数据（speciesLength === 0），回落英文
  if (bundle.speciesLength() === 0 && lang !== 'en') {
    return getNamesBundle('en');
  }
  return bundle;
}
```

> 注意：`ja-roma` 的 names 有物种名但无技能名，应局部回落：有数据的字段用 `ja-roma`，
> 缺失的字段 fallback 到 `en`。

---

## 7. 集成到 Boot 流程

### 7.1 启动时获取用户语言

```typescript
// src/services/boot.ts
import { getKey } from '@/services/session/key';
import { getStoredDataVersion, setStoredDataVersion } from '@/services/resources/dataVersion';
import { resourceManager } from '@/services/resources/resourceManager';
import { getPreferredLanguage } from '@/services/i18n/language';  // 待实现

const LATEST_GEN_ID = 9;

export async function bootPrefetch(): Promise<void> {
  try {
    const key = await getKey();
    const serverVersion = key.version;

    if (typeof serverVersion === 'number') {
      const localVersion = getStoredDataVersion();
      if (localVersion !== serverVersion) {
        await resourceManager.pruneOtherVersions(serverVersion);
        setStoredDataVersion(serverVersion);
      }
    }

    // 预取最新世代 + 用户语言名称组
    resourceManager.prefetchPokemonGen(LATEST_GEN_ID);
    const lang = getPreferredLanguage();
    resourceManager.prefetchI18nNames(lang);  // 新增
  } catch (err) {
    console.warn('[boot] prefetch skipped', err);
  }
}
```

### 7.2 语言切换

```typescript
async function switchLanguage(lang: string): Promise<void> {
  // 1. 下载新语言 bundle
  const namesBundle = await resourceManager.getI18nNames(lang);
  // 2. 更新全局 i18n 查找表
  i18nStore.setLookup(buildLookup(namesBundle));
  // 3. 可选：预取描述组
  if (needsFlavor()) {
    resourceManager.prefetchI18nFlavor(lang);
  }
}
```

---

## 8. 缓存策略

| 资源 | 缓存 key | 失效策略 |
|------|----------|----------|
| `i18n/<lang>/names.bin` | `fb:v{N}:i18n:names:<lang>` | 版本号升级时 `pruneOtherVersions` 清理 |
| `i18n/<lang>/flavor.bin` | `fb:v{N}:i18n:flavor:<lang>` | 同上 |

内存 LRU 上限与数值 bundle 共用 `MEMORY_LRU_CAP`（12 条）。由于 i18n bundle 按语言 + 类型计算 ≈ 2 条（names + flavor），通常不会挤占数值 bundle 的缓存槽。

---

## 9. 参考

- 服务端 i18n 打包脚本：`tools/sync-i18n.py`（zukan-server）
- 名称组 schema：`tools/schemas/i18n_names_bundle.fbs`（zukan-server）
- 描述组 schema：`tools/schemas/i18n_flavor_bundle.fbs`（zukan-server）
- 加密方案：`docs/encryption.md`
- 解密流程：`docs/zukan-decryption.md`
- 资源管理器：`src/services/resources/resourceManager.ts`
- 解密核心：`src/infra/wasm/src/crypto.rs`
- WASM 绑定：`src/infra/wasm/index.ts`