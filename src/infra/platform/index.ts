/**
 * 平台检测入口。barrel + 薄 detector（调 uni），归一逻辑在纯函数中。
 */

import { hostPlatform } from './host';
import { resolvePlatform, type Platform, type PlatformLikeInfo } from './resolve';

export { hostPlatform, type HostPlatform } from './host';
export { resolvePlatform, type Platform, type PlatformLikeInfo } from './resolve';
export {
    supportedProviders,
    weixinAppType,
    PROVIDER_ORDER,
    type AuthProvider,
    type WeixinAppType,
} from './capabilities';

/**
 * 检测当前运行平台。`uni.getSystemInfoSync` 不可用 / 抛错时退化为仅依据编译期宿主。
 */
export function detectPlatform(): Platform {
    let info: PlatformLikeInfo | null = null;
    if (typeof uni !== 'undefined' && typeof uni.getSystemInfoSync === 'function') {
        try {
            info = uni.getSystemInfoSync();
        } catch {
            info = null;
        }
    }
    return resolvePlatform(hostPlatform, info);
}
