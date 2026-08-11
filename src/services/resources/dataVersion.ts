/**
 * 游戏数据版本本地存储
 *
 * 服务端在 `GET /zukan/key` 响应里返回 `version: number`（单调递增整数）。
 * 客户端把它 KV 到本地，启动时对比：不一致则清旧版本字节缓存并写回新值。
 *
 * 跨平台通过 `uni.getStorageSync`（H5 走 localStorage 桥、MP 走原生 storage）。
 */

const KEY = 'zukan_data_version';

/**
 * boot 未完成（或老后端不下发 version）时的兜底版本号。
 * WASM schema / ZKDX 格式变更时手动 bump，一并 bump WASM 版本。
 */
export const FALLBACK_DATA_VERSION = 1;

/**
 * 缓存 key 用的资源版本号：优先服务端下发值，未 boot 时兜底。
 * `resourceManager`（FB bundle）与 `spritePersist`（sprite 密文）共用，
 * 保证两者的版本前缀同步失效 —— 否则 DEK 轮换后一方清了另一方没清。
 */
export function currentDataVersion(): number {
    return getStoredDataVersion() ?? FALLBACK_DATA_VERSION;
}

export function getStoredDataVersion(): number | null {
    try {
        const raw = uni.getStorageSync(KEY) as number | string | undefined;
        if (raw == null || raw === '') return null;
        const n = typeof raw === 'number' ? raw : Number.parseInt(raw, 10);
        return Number.isFinite(n) ? n : null;
    } catch {
        return null;
    }
}

export function setStoredDataVersion(v: number): void {
    try {
        uni.setStorageSync(KEY, v);
    } catch (err) {
        console.warn('[dataVersion] 写入失败', err);
    }
}
