/**
 * 把「编译期宿主」+「运行时系统信息」归一为唯一平台标识。纯函数，无平台依赖，
 * 可直接在 node 单测中以各种组合驱动。
 */

import type { HostPlatform } from './host';

export type Platform = 'h5' | 'mp-weixin' | 'app-ios' | 'app-android' | 'unknown';

/** 仅需要 SystemInfo 中的 `platform` 字段（'ios' | 'android' | 'devtools' …）。 */
export interface PlatformLikeInfo {
    platform?: string;
}

/**
 * @param host 编译期宿主（`host.ts`）
 * @param info `uni.getSystemInfoSync()` 的最小结构；缺省/异常时可传 `{}`
 */
export function resolvePlatform(host: HostPlatform, info: PlatformLikeInfo | null | undefined): Platform {
    switch (host) {
        case 'h5':
            return 'h5';
        case 'mp-weixin':
            return 'mp-weixin';
        case 'app': {
            // 用 platform 字段区分，不解析 `system`（如 'iOS 17.0'）字符串。
            switch (info?.platform?.toLowerCase()) {
                case 'ios':
                    return 'app-ios';
                case 'android':
                    return 'app-android';
                default:
                    return 'unknown';
            }
        }
        case 'unknown':
            return 'unknown';
    }
}
