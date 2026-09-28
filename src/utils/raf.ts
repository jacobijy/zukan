/**
 * 跨平台 requestAnimationFrame 兜底
 *
 * 微信小程序等非 H5 环境没有全局 requestAnimationFrame / cancelAnimationFrame，
 * 直接调用会抛 `requestAnimationFrame is not a function`（TabBar 挂载、VirtualGrid
 * 滚动时都会踩到）。H5 用原生 rAF（与渲染帧对齐）；其余平台用 setTimeout 按
 * 约 60fps（16ms）调度，返回值统一为数字句柄，用 cancelRaf 取消。
 */

const hasNativeRaf = typeof requestAnimationFrame === 'function';

export function raf(callback: () => void): number {
    if (hasNativeRaf) return requestAnimationFrame(callback);
    return setTimeout(callback, 16) as unknown as number;
}

export function cancelRaf(handle: number): void {
    if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(handle);
    else clearTimeout(handle);
}
