import { weixinAppType, type AuthProvider, type Platform, type WeixinAppType } from '@/infra/platform';
import { authApi } from '@/services/api';
import type { BindResult, LoginResult, PlatformManager } from './types';

/** uni.login 的授权参数；nonce 运行时 Apple 需要但 @dcloudio 类型未声明。 */
type LoginOptionsExt = UniNamespace.LoginOptions & { nonce?: string };

/** uni.login 的返回；Apple identityToken / univerify authResult 未在 @dcloudio 类型中。 */
type LoginResExt = UniNamespace.LoginRes & { identityToken?: string; authResult?: string };

/**
 * 平台管理对象基类，承载跨平台共性：Promise 化 uni.login、一次性 nonce，以及
 * 登录/绑定/解绑的编排。微信 app_type 等平台差异全部由 infra 的纯函数
 * （weixinAppType）+ 构造传入的 platform 消化，故具体 provider 逻辑在此只写一遍、
 * 各平台子类只需声明 platform。平台「支持哪些 provider」由能力闸门
 * （providerConfig，UI 唯一依据）负责，这里不重复强制矩阵。
 */
export abstract class BasePlatformManager implements PlatformManager {
    constructor(readonly platform: Platform) {}

    /** 包装回调式 uni.login 为 Promise。 */
    protected uniLogin(options: LoginOptionsExt): Promise<LoginResExt> {
        return new Promise((resolve, reject) => {
            uni.login({
                ...options,
                success: (res) => resolve(res as LoginResExt),
                fail: (err) => reject(new Error(err?.errMsg ?? '登录失败')),
            } as UniNamespace.LoginOptions);
        });
    }

    /** 生成一次性随机 nonce（base64url，约 128 bit）。优先 CSPRNG。 */
    protected newNonce(): string {
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

    /** 微信授权凭据；缺 code 抛错。 */
    protected async weixinPayload(): Promise<{ code: string; app_type: WeixinAppType }> {
        const res = await this.uniLogin({ provider: 'weixin' });
        if (!res.code) throw new Error('微信未返回 code');
        return { code: res.code, app_type: weixinAppType(this.platform) };
    }

    /** Apple 授权凭据；缺 identityToken 抛错。 */
    protected async applePayload(): Promise<{
        identity_token: string;
        nonce: string;
        authorization_code?: string;
    }> {
        const nonce = this.newNonce();
        const res = await this.uniLogin({ provider: 'apple', nonce });
        if (!res.identityToken) throw new Error('Apple 未返回 identity_token');
        return { identity_token: res.identityToken, nonce, authorization_code: res.code };
    }

    /** 运营商本机号授权凭据；解析 authResult，缺 access_token 抛错。 */
    protected async phonePayload(): Promise<{ access_token: string }> {
        const res = await this.uniLogin({ provider: 'univerify' });
        let accessToken = '';
        if (res.authResult) {
            try {
                accessToken = (JSON.parse(res.authResult) as { access_token?: string }).access_token ?? '';
            } catch {
                accessToken = '';
            }
        }
        if (!accessToken) throw new Error('运营商未返回 access_token');
        return { access_token: accessToken };
    }

    async login(provider: AuthProvider): Promise<LoginResult> {
        if (provider === 'weixin') return authApi.loginWithWeixin(await this.weixinPayload());
        if (provider === 'apple') return authApi.loginWithApple(await this.applePayload());
        if (provider === 'phone') return authApi.loginWithPhone(await this.phonePayload());
        throw new Error(`暂不支持该登录方式: ${provider}`);
    }

    async bind(provider: AuthProvider): Promise<BindResult> {
        if (provider === 'weixin') return authApi.bindIdentity('weixin', await this.weixinPayload());
        if (provider === 'apple') return authApi.bindIdentity('apple', await this.applePayload());
        if (provider === 'phone') return authApi.bindIdentity('phone', await this.phonePayload());
        throw new Error(`暂不支持绑定该登录方式: ${provider}`);
    }

    unbind(provider: AuthProvider): Promise<void> {
        return authApi.unbindIdentity(provider);
    }
}
