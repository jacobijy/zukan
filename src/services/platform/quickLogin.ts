/**
 * 第三方快捷登录 / 绑定编排。
 *
 * 负责：调起平台 SDK 授权（uni.login）→ 取出凭据 → 交给 auth client（token 落盘在
 * client 内）。纯编排，平台差异通过显式 `platform` 参数注入（缺省由 detectPlatform
 * 探测），便于 node 单测驱动。
 *
 * 端点契约见 zukan-server `docs/account-auth-design.md` §3 / §4。
 */

import { detectPlatform, weixinAppType, type AuthProvider, type Platform } from '@/infra/platform';
import { authApi } from '@/services/api';

/** uni.login 的授权参数；`nonce` 运行时 Apple 需要但 @dcloudio 类型未声明。 */
type LoginOptionsExt = UniNamespace.LoginOptions & { nonce?: string };

/** 包装回调式 uni.login 为 Promise。 */
function uniLogin(options: LoginOptionsExt): Promise<UniNamespace.LoginRes> {
    return new Promise((resolve, reject) => {
        uni.login({
            ...options,
            success: (res) => resolve(res),
            fail: (err) => reject(new Error(err?.errMsg ?? '登录失败')),
        } as UniNamespace.LoginOptions);
    });
}

/** 生成一次性随机 nonce（base64url，约 128 bit）。优先 CSPRNG，node/浏览器均可。 */
export function generateNonce(): string {
    const bytes = new Uint8Array(16);
    const cryptoObj = globalThis.crypto;
    if (cryptoObj?.getRandomValues) {
        cryptoObj.getRandomValues(bytes);
    } else {
        for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
    }
    let bin = '';
    bytes.forEach((b) => (bin += String.fromCharCode(b)));
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** 微信一键登录；返回结果含 `new_user`。 */
export async function weixinLogin(platform: Platform = detectPlatform()) {
    const res = await uniLogin({ provider: 'weixin' });
    if (!res.code) throw new Error('微信未返回 code');
    return authApi.loginWithWeixin({ code: res.code, app_type: weixinAppType(platform) });
}

/** Sign in with Apple 一键登录；返回结果含 `new_user`。 */
export async function appleLogin() {
    const nonce = generateNonce();
    // App 端 Apple 授权结果在 identityToken 字段。
    const res = (await uniLogin({ provider: 'apple', nonce })) as UniNamespace.LoginRes & {
        identityToken?: string;
    };
    const identityToken = res.identityToken;
    if (!identityToken) throw new Error('Apple 未返回 identity_token');
    return authApi.loginWithApple({
        identity_token: identityToken,
        nonce,
        authorization_code: res.code,
    });
}

/** 运营商本机号一键登录；返回结果含 `new_user`。 */
export async function phoneLogin() {
    const res = (await uniLogin({ provider: 'univerify' })) as UniNamespace.LoginRes & {
        authResult?: string;
    };
    // univerify 的授权结果是 JSON 字符串，access_token 在其中。
    let accessToken = '';
    if (res.authResult) {
        try {
            accessToken = (JSON.parse(res.authResult) as { access_token?: string }).access_token ?? '';
        } catch {
            accessToken = '';
        }
    }
    if (!accessToken) throw new Error('运营商未返回 access_token');
    return authApi.loginWithPhone({ access_token: accessToken });
}

/**
 * 已登录态：绑定某 provider。按 provider 调起授权、取凭据后提交绑定。
 * @returns 绑定后的登录方式列表
 */
export async function bindProvider(provider: AuthProvider, platform: Platform = detectPlatform()) {
    if (provider === 'weixin') {
        const res = await uniLogin({ provider: 'weixin' });
        if (!res.code) throw new Error('微信未返回 code');
        return authApi.bindIdentity('weixin', { code: res.code, app_type: weixinAppType(platform) });
    }
    if (provider === 'apple') {
        const nonce = generateNonce();
        const res = (await uniLogin({ provider: 'apple', nonce })) as UniNamespace.LoginRes & {
            identityToken?: string;
        };
        if (!res.identityToken) throw new Error('Apple 未返回 identity_token');
        return authApi.bindIdentity('apple', {
            identity_token: res.identityToken,
            nonce,
            authorization_code: res.code,
        });
    }
    if (provider === 'phone') {
        const res = (await uniLogin({ provider: 'univerify' })) as UniNamespace.LoginRes & {
            authResult?: string;
        };
        const parsed = res.authResult ? (JSON.parse(res.authResult) as { access_token?: string }) : {};
        if (!parsed.access_token) throw new Error('运营商未返回 access_token');
        return authApi.bindIdentity('phone', { access_token: parsed.access_token });
    }
    throw new Error(`暂不支持绑定该登录方式: ${provider}`);
}

/** 已登录态：解绑某 provider。 */
export async function unbindProvider(provider: AuthProvider): Promise<void> {
    await authApi.unbindIdentity(provider);
}
