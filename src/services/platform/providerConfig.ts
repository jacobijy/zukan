/**
 * Provider 启用闸门。
 *
 * 与「平台能力」（infra/platform/capabilities.ts，静态矩阵）正交：这里决定
 * 「后端是否已上线该登录方式」。默认全部关闭，只有在环境变量
 * `VITE_AUTH_PROVIDERS`（逗号分隔）中列出的 provider 才视为启用。
 *
 * 例外是平台**内建**入口（`BUILTIN_PROVIDERS`）：微信小程序本身即微信渠道，
 * 微信一键登录是其原生主入口、不参与 china/overseas 分渠道构建，发行节奏由
 * 小程序版本本身把关，故 mp-weixin 上 weixin 恒为启用（env 无法关闭；
 * 后端临时下线时由 /auth/weixin 返回 503、UI 走错误提示）。
 *
 * 后端某阶段就绪后，只需配置该变量（如 P0：`VITE_AUTH_PROVIDERS=weixin`）即可
 * 放开其余平台按钮，无需改代码。
 */

import { PROVIDER_ORDER, supportedProviders, type AuthProvider, type Platform } from '@/infra/platform';

/**
 * 平台内建、无需 env 开关的登录方式（仍须出现在该平台的能力矩阵内）。
 * 与 env 启用集是**并集**：env 只能加、不能在这里减。
 */
const BUILTIN_PROVIDERS: Partial<Record<Platform, readonly AuthProvider[]>> = {
    'mp-weixin': ['weixin'],
};

/** 把任意输入解析为合法 provider 集合（去重、忽略未知/空白）。纯函数。 */
export function parseEnabledProviders(raw: string | undefined | null): AuthProvider[] {
    if (!raw) return [];
    const known = new Set<AuthProvider>(PROVIDER_ORDER);
    const picked = new Set<AuthProvider>();
    for (const item of raw.split(',')) {
        const v = item.trim().toLowerCase();
        if (v && known.has(v as AuthProvider)) picked.add(v as AuthProvider);
    }
    return PROVIDER_ORDER.filter((p) => picked.has(p));
}

/** 当前已启用的 provider（构建期由环境变量决定）。 */
export const enabledProviders: AuthProvider[] = parseEnabledProviders(
    import.meta.env.VITE_AUTH_PROVIDERS as string | undefined,
);

/**
 * 实际应渲染的登录方式 = 平台支持 ∩（后端启用 ∪ 平台内建）（按 PROVIDER_ORDER 排序）。
 * 这是 UI 是否渲染某入口的**唯一依据**；结果为空则不渲染任何第三方按钮。
 */
export function selectVisibleProviders(platform: Platform): AuthProvider[] {
    const enabled = new Set(enabledProviders);
    for (const p of BUILTIN_PROVIDERS[platform] ?? []) enabled.add(p);
    return supportedProviders(platform).filter((p) => enabled.has(p));
}
