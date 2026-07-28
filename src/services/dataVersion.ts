/**
 * 游戏数据版本本地存储
 *
 * 服务端在 `GET /zukan/key` 响应里返回 `version: number`（单调递增整数）。
 * 客户端把它 KV 到本地，启动时对比：不一致则清旧版本字节缓存并写回新值。
 *
 * 跨平台通过 `uni.getStorageSync`（H5 走 localStorage 桥、MP 走原生 storage）。
 */

const KEY = 'zukan_data_version';

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

export function clearStoredDataVersion(): void {
  try {
    uni.removeStorageSync(KEY);
  } catch {
    // ignore
  }
}
