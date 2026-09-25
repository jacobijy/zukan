import type { AuthProvider, Platform } from '@/infra/platform';

/** 第三方登录结果；token 落盘在 authApi 内，这里只回传是否新建账号。 */
export interface LoginResult {
    new_user: boolean;
}

/** 绑定成功后返回的当前账号登录方式列表。 */
export interface BindResult {
    identities: string[];
}

/**
 * 平台管理对象：收口「与当前平台交互的操作」。每个平台一个实现，由
 * registry（getPlatformManager）按当前平台返回单例。新增平台操作（支付、推送、
 * 分享……）时在此接口与对应平台实现中追加，避免散成裸函数。
 */
export interface PlatformManager {
    readonly platform: Platform;
    /** 调起对应 provider 授权并登录。 */
    login(provider: AuthProvider): Promise<LoginResult>;
    /** 已登录态：绑定某 provider。 */
    bind(provider: AuthProvider): Promise<BindResult>;
    /** 已登录态：解绑某 provider。 */
    unbind(provider: AuthProvider): Promise<void>;
}
