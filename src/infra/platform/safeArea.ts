/**
 * 安全区归一：把「编译期宿主 + 运行时系统信息」归一为应占用的顶部状态栏高度。
 *
 * 这是「刘海 / 挖孔 / 状态栏」适配的唯一真相源。页面不自读系统信息、不硬编码高度，
 * 只消费 App.vue 注入的 `--status-bar-height` / `--navbar-total-height`。
 *
 * 纯函数、无平台依赖，可在 node 单测中以各种组合驱动。
 */

import type { HostPlatform } from './host';
import { resolvePlatform, type Platform, type PlatformLikeInfo } from './resolve';

/**
 * 归一安全区所需的 SystemInfo 字段：`platform`（区分 iOS/Android）+ `statusBarHeight`。
 * 缺省/异常时可传 `{}`。
 */
export interface SafeAreaLikeInfo extends PlatformLikeInfo {
    statusBarHeight?: number;
}

/**
 * 归一当前宿主应占用的顶部状态栏高度（单位：rpx 无关的 **px 字符串**）。
 *
 * 判定口径：
 * - **App / 小程序**：`uni.getSystemInfoSync().statusBarHeight`——自定义导航栏（`navigationStyle: custom`）
 *   必须由自己给顶部留出状态栏，否则标题压进刘海 / 挖孔。iOS 刘海 ~44–59，Android 挖孔 ~24–48。
 *   uni-app 的 `statusBarHeight` 已经是可直接用于布局的 px。
 * - **H5**：`0`。浏览器的地址栏 / 视口在 safe-area 之外，浏览器内 `padding-top: 0` 恰好够用。
 *   真正的 PWA 全屏安全区由 CSS 侧的 `env(safe-area-inset-top)` 兜住（见 App.vue 的 `max(...)`）。
 *
 * 容错：读不到 / 抛错 / 非有限数值时一律回退 `0`——宁可不留白（退化为改动前的现状），
 * 也不能让一个坏值把整条安全区链算崩。
 *
 * @param host 编译期宿主（`hostPlatform`）
 * @param info `uni.getSystemInfoSync()` 的最小结构；`null`/`undefined` 表示读取失败
 * @returns 形如 `'"44px"'` 的 px 字符串，恒非空
 */
export function resolveStatusBarHeight(host: HostPlatform, info: SafeAreaLikeInfo | null | undefined): string {
    const platform = resolvePlatform(host, info);
    // H5 走 CSS env() 兜底，JS 侧不占位。
    if (platform === 'h5') return '0px';

    const raw = info?.statusBarHeight;
    if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) {
        return `${raw}px`;
    }
    return '0px';
}
