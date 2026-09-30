/**
 * 跨平台二进制存储抽象
 *
 * - H5：IndexedDB（DB `zukan-fb`，object store `blobs`，key=string，value=Uint8Array）
 * - MP：`uni.setStorage` + `uni.arrayBufferToBase64` / `uni.base64ToArrayBuffer`
 *
 * MP 端受单 key 与总量限制（微信约 1MB/key、10MB 总量）；写入 quota 类错误
 * 静默丢弃，`get()` 下次按 miss 处理并重下，不做分片。
 */

export interface BinaryStorage {
    get(key: string): Promise<Uint8Array | null>;
    put(key: string, data: Uint8Array): Promise<void>;
    delete(key: string): Promise<void>;
    /** 清空前缀匹配的 key；不传前缀则清空全部（仅本模块管理的键） */
    clear(prefix?: string): Promise<void>;
    /** 尽力枚举 key；MP 平台通过 `uni.getStorageInfoSync().keys` 过滤 */
    keys(prefix?: string): Promise<string[]>;
}

// ─────────────────────────────────────────────────────────
// IndexedDB 后端（H5）
// ─────────────────────────────────────────────────────────

const IDB_NAME = 'zukan-fb';
const IDB_STORE = 'blobs';
const IDB_VERSION = 1;

let idbPromise: Promise<IDBDatabase> | null = null;

function openIdb(): Promise<IDBDatabase> {
    if (idbPromise) return idbPromise;
    idbPromise = new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open(IDB_NAME, IDB_VERSION);
        req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains(IDB_STORE)) {
                db.createObjectStore(IDB_STORE);
            }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
    return idbPromise;
}

function idbTx(mode: IDBTransactionMode): Promise<IDBObjectStore> {
    return openIdb().then((db) => db.transaction(IDB_STORE, mode).objectStore(IDB_STORE));
}

const idbStorage: BinaryStorage = {
    async get(key) {
        const store = await idbTx('readonly');
        return new Promise((resolve, reject) => {
            const req = store.get(key);
            req.onsuccess = () => {
                const val = req.result;
                if (val == null) return resolve(null);
                if (val instanceof Uint8Array) return resolve(val);
                if (val instanceof ArrayBuffer) return resolve(new Uint8Array(val));
                resolve(null);
            };
            req.onerror = () => reject(req.error);
        });
    },
    async put(key, data) {
        const store = await idbTx('readwrite');
        return new Promise((resolve, reject) => {
            const req = store.put(data, key);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    },
    async delete(key) {
        const store = await idbTx('readwrite');
        return new Promise((resolve, reject) => {
            const req = store.delete(key);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    },
    async clear(prefix) {
        const keys = await this.keys(prefix);
        await Promise.all(keys.map((k) => this.delete(k)));
    },
    async keys(prefix) {
        const store = await idbTx('readonly');
        return new Promise<string[]>((resolve, reject) => {
            const req = store.getAllKeys();
            req.onsuccess = () => {
                const all = (req.result as IDBValidKey[]).map(String);
                resolve(prefix ? all.filter((k) => k.startsWith(prefix)) : all);
            };
            req.onerror = () => reject(req.error);
        });
    },
};

// ─────────────────────────────────────────────────────────
// uni.setStorage 后端（小程序）
// ─────────────────────────────────────────────────────────

const QUOTA_PATTERN = /exceed|size|quota|超过|超出/i;

function u8ToBase64(data: Uint8Array): string {
    // uni.arrayBufferToBase64 只吃 ArrayBuffer，且部分平台不接受 SharedArrayBuffer
    const ab = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
    return uni.arrayBufferToBase64(ab);
}

function base64ToU8(b64: string): Uint8Array {
    const ab = uni.base64ToArrayBuffer(b64);
    return new Uint8Array(ab);
}

const uniStorage: BinaryStorage = {
    async get(key) {
        return new Promise((resolve) => {
            uni.getStorage({
                key,
                success: (res) => {
                    try {
                        resolve(base64ToU8(res.data as string));
                    } catch {
                        resolve(null);
                    }
                },
                fail: () => resolve(null),
            });
        });
    },
    async put(key, data) {
        return new Promise((resolve) => {
            let b64: string;
            try {
                b64 = u8ToBase64(data);
            } catch (err) {
                console.warn('[binaryStorage] base64 编码失败，跳过写入', key, err);
                resolve();
                return;
            }
            uni.setStorage({
                key,
                data: b64,
                success: () => resolve(),
                fail: (err) => {
                    if (err && QUOTA_PATTERN.test(err.errMsg ?? '')) {
                        console.warn('[binaryStorage] 存储容量不足，跳过持久化', key, err.errMsg);
                    } else {
                        console.warn('[binaryStorage] setStorage 失败', key, err);
                    }
                    // 静默：下次访问按 miss 处理
                    resolve();
                },
            });
        });
    },
    async delete(key) {
        return new Promise((resolve) => {
            uni.removeStorage({ key, success: () => resolve(), fail: () => resolve() });
        });
    },
    async clear(prefix) {
        const keys = await this.keys(prefix);
        await Promise.all(keys.map((k) => this.delete(k)));
    },
    async keys(prefix) {
        return new Promise<string[]>((resolve) => {
            uni.getStorageInfo({
                success: (info) => {
                    const all = info.keys ?? [];
                    resolve(prefix ? all.filter((k) => k.startsWith(prefix)) : all);
                },
                fail: () => resolve([]),
            });
        });
    },
};

// ─────────────────────────────────────────────────────────
// 文件系统后端（小程序 / App 图片密文持久层专用）
// ─────────────────────────────────────────────────────────
//
// 用 USER_DATA_PATH 的本地文件存 ZKDX **密文**，给加密图片持久层注入用。
// 与 objectUrl.ts 的 zukan-img/ 明文临时落点分开（不同目录、不同生命周期）：
// 这里是跨刷新缓存，objectUrl 那里是 <image> 原语的临时文件、release 即删。
//
// 刻意**不**塞进 binaryStorage 单例 —— 那是 FB bundle 用的，FB 走 uniStorage
// （10MB 装得下几个 bundle 即够）。fs 后端单独导出供 imagePersist 注入。
//
// 用 *Sync 变体（writeFileSync/readFileSync/... 均存在于 uni 类型），外包 Promise
// 适配 BinaryStorage 接口，使上层 async 调用与 IDB 后端形态一致。
//
// 配额：USER_DATA_PATH 是本地缓存 + 用户文件共享的 200MB（不占 storage 的 10MB）。
// 生命周期跟随代码包（清缓存 / 卸载即清），无需自管清理。

const FS_CACHE_DIR = 'zukan-cache';

/**
 * key → 文件名的**全转义**映射（单射，可无损还原）。
 *
 * 只转 `_` `/` `:` 三个字符：当前 key 格式里出现的特殊字符就是这三个。
 * 转义顺序里 `_` 必须最先 —— 否则把 `/` `:` 转成 `%2F` `%3A` 后引入的下划线
 * 会被二次转义。`fileNameToKey` 是逆操作，顺序相反（先还原 `%5F` 之类）。
 * 单射性由 tests 断言 `fileNameToKey(keyToFileName(k)) === k` 锁住。
 */
function keyToFileName(key: string): string {
    return key
        .replace(/_/g, '%5F')
        .replace(/\//g, '%2F')
        .replace(/:/g, '%3A');
}

function fileNameToKey(name: string): string {
    return name
        .replace(/%3A/g, ':')
        .replace(/%2F/g, '/')
        .replace(/%5F/g, '_');
}

function fsBaseDir(): string | null {
    // node 测试环境无 uni 全局；typeof 判断（不能用 uni 直接取属性，会 ReferenceError）
    if (typeof uni === 'undefined') return null;
    const userPath = (uni as any).env?.USER_DATA_PATH as string | undefined;
    return userPath ? `${userPath}/${FS_CACHE_DIR}` : null;
}

/** 取精确的底层 ArrayBuffer（fs 只收 ArrayBuffer/string） */
function toArrayBuffer(data: Uint8Array): ArrayBuffer {
    return data.byteOffset === 0 && data.byteLength === data.buffer.byteLength
        ? data.buffer
        : data.slice().buffer;
}

/** 读文件 → Uint8Array；不存在或读失败返回 null（按 miss 处理） */
function readFileSyncSafe(dir: string, key: string): Uint8Array | null {
    const filePath = `${dir}/${keyToFileName(key)}`;
    try {
        const raw = uni.getFileSystemManager().readFileSync(filePath);
        // readFileSync 无 encoding 时返回 ArrayBuffer；类型是 string | ArrayBuffer，显式判
        if (raw instanceof ArrayBuffer) return new Uint8Array(raw);
        return null;
    } catch {
        return null;
    }
}

/**
 * fs 后端实例。`USER_DATA_PATH` 不存在（H5 / 测试环境）时返回**退化后端**：
 * 恒 miss、写入 no-op —— 等同未持久化，不抛错，让上层无脑注入。
 */
function createFsStorage(): BinaryStorage {
    const base = fsBaseDir();

    // 退化后端：无文件系统时的安全默认
    if (!base) {
        return {
            get: async () => null,
            put: async () => undefined,
            delete: async () => undefined,
            clear: async () => undefined,
            keys: async () => [],
        };
    }

    // 非空绑定：base 在 guard 后必然为 string，但闭包里 TS 会重新加宽回 string | null，
    // 这里钉死一个非 null const 供闭包捕获。
    const dir: string = base;

    function ensureDir(): void {
        try {
            uni.getFileSystemManager().mkdirSync(dir, true);
        } catch {
            /* 已存在 / 已就绪，忽略 */
        }
    }

    return {
        async get(key) {
            return readFileSyncSafe(dir, key);
        },
        async put(key, data) {
            ensureDir();
            try {
                uni.getFileSystemManager().writeFileSync(`${dir}/${keyToFileName(key)}`, toArrayBuffer(data));
            } catch (err) {
                // 持久化是纯优化，写不进（配额满 / 磁盘满）下次重下即可，静默
                console.warn('[binaryStorage] fs 写入失败，跳过持久化', key, err);
            }
        },
        async delete(key) {
            try {
                uni.getFileSystemManager().unlinkSync(`${dir}/${keyToFileName(key)}`);
            } catch {
                /* 不存在，忽略 */
            }
        },
        async clear(prefix) {
            const keys = await this.keys(prefix);
            await Promise.all(keys.map((k) => this.delete(k)));
        },
        async keys(prefix) {
            try {
                const names = uni.getFileSystemManager().readdirSync(dir);
                const all = names.map((n) => fileNameToKey(n));
                return prefix ? all.filter((k) => k.startsWith(prefix)) : all;
            } catch {
                // 目录尚未创建 / 读取失败 —— 空缓存
                return [];
            }
        },
    };
}

/** fs 后端单例（H5 上为退化后端）。供 imagePersist 注入。 */
export const fsStorage: BinaryStorage = createFsStorage();

/**
 * 当前平台是否有可用的文件系统持久后端（小程序 / App）。
 * H5 没有 USER_DATA_PATH，返回 false —— 图片持久层此时走 IDB。
 * 与 `storageBackend`（描述 binaryStorage 单例）正交：那是 FB bundle 的后端，
 * 这个决定图片持久层该注入 fs 还是默认 IDB。
 */
export function hasFileSystemBackend(): boolean {
    return fsBaseDir() !== null;
}

// ─────────────────────────────────────────────────────────
// 内存后端（仅 dev）
// ─────────────────────────────────────────────────────────

/**
 * dev 专用：进程内 Map，刷新即清空。换源重打包后刷新页面就是最新数据，
 * 不必 bump 数据版本号 / 手动清 IndexedDB。图片持久层据 `storageBackend`
 * （非 'idb'）整体 no-op，连内存里也不留密文。
 */
const memoryMap = new Map<string, Uint8Array>();

const memoryStorage: BinaryStorage = {
    async get(key) {
        return memoryMap.get(key) ?? null;
    },
    async put(key, data) {
        memoryMap.set(key, data);
    },
    async delete(key) {
        memoryMap.delete(key);
    },
    async clear(prefix) {
        for (const k of memoryMap.keys()) {
            if (!prefix || k.startsWith(prefix)) memoryMap.delete(k);
        }
    },
    async keys(prefix) {
        const all = [...memoryMap.keys()];
        return prefix ? all.filter((k) => k.startsWith(prefix)) : all;
    },
};

// ─────────────────────────────────────────────────────────
// 后端选择
// ─────────────────────────────────────────────────────────

/**
 * dev 下默认**不跨刷新持久化**：`pnpm dev:h5` 时二进制缓存走内存 Map、
 * 图片密文干脆不写盘，重新打包后刷新即拉最新，省掉 bump 版本号 / 清站点数据。
 * 需要在 dev 里验证缓存失效 / prune 时，控制台设
 * `localStorage['zukan:dev-persist'] = '1'` 后刷新，即恢复真实 IndexedDB。
 * 正式构建（`import.meta.env.DEV === false`）不受影响。
 */
const forcePersistInDev = typeof localStorage !== 'undefined' && localStorage.getItem('zukan:dev-persist') === '1';
const devNoPersist = import.meta.env.DEV && !forcePersistInDev;

function pickBackend(): BinaryStorage {
    if (devNoPersist) return memoryStorage;
    // H5：优先 IndexedDB
    if (typeof indexedDB !== 'undefined') return idbStorage;
    // 其它平台走 uni-storage
    return uniStorage;
}

/**
 * 当前后端类型。调用方据此决定「值不值得往里塞大批数据」：
 * IDB 有几十上百 MB 配额，`uni.setStorage` 只有约 10MB 总量 ——
 * 把上千张 sprite 塞进后者会把 FB bundle 顶出去，得不偿失
 * （见 `imagePersist.ts`）。`memory` 仅 dev，等同「不持久化」。
 */
export const storageBackend: 'idb' | 'uni' | 'memory' = devNoPersist
    ? 'memory'
    : typeof indexedDB !== 'undefined'
      ? 'idb'
      : 'uni';

export const binaryStorage: BinaryStorage = pickBackend();
