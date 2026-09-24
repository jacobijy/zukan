/**
 * 平台登录能力矩阵 —— 编码 zukan-server `docs/account-auth-design.md` §1.2。
 * 纯数据 + 纯函数，是「该平台**理论上**支持哪些登录方式」的唯一来源；
 * 「后端是否已启用」是另一条独立闸门（见 services/platform/providerConfig.ts）。
 */

import type { Platform } from './resolve';

/** 登录提供方。`platform` 为外部宿主/渠道下发 token（◐ 条件可用，不进静态矩阵）。 */
export type AuthProvider = 'weixin' | 'apple' | 'phone' | 'platform';

/** UI 中 provider 的固定展示顺序。 */
export const PROVIDER_ORDER: AuthProvider[] = ['weixin', 'apple', 'phone', 'platform'];

/**
 * 该平台支持的第三方登录方式（按 `PROVIDER_ORDER` 排序）。
 *
 * - h5：暂无（P2 的网页扫码另算）
 * - mp-weixin：仅微信
 * - app-ios：微信 + Apple（App Store 要求第三方登录必须同时提供 Sign in with Apple）
 * - app-android：仅微信
 */
export function supportedProviders(platform: Platform): AuthProvider[] {
    const supported: AuthProvider[] =
        platform === 'mp-weixin'
            ? ['weixin']
            : platform === 'app-ios'
              ? ['weixin', 'apple']
              : platform === 'app-android'
                ? ['weixin']
                : [];
    return PROVIDER_ORDER.filter((p) => supported.includes(p));
}

/** 微信登录时上报的来源类型，决定后端选用哪组 appid/secret。 */
export type WeixinAppType = 'mp' | 'app' | 'web';

export function weixinAppType(platform: Platform): WeixinAppType {
    if (platform === 'mp-weixin') return 'mp';
    if (platform === 'app-ios' || platform === 'app-android') return 'app';
    return 'web';
}
