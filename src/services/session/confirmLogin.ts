/**
 * 写操作的统一登录闸门：确认框 → 登录框 →（登录成功后）续跑原操作。
 *
 * 与 `authGate.requireLogin()` 的区别：`requireLogin()` 会**立即**弹出登录框；
 * 本函数在未登录时先用原生 `uni.showModal` 问一次「是否去登录」，用户确认后
 * 才打开全局登录框。用于收藏 / 保存队伍 / 保存模板等用户主动触发的写操作，
 * 避免一点击就被登录框打断。三端（H5 / 微信小程序 / App）均可用。
 *
 * 返回：
 * - `true`  —— 已登录，或未登录但走完了登录（token 已落盘），调用方继续原操作。
 * - `false` —— 用户在确认框点取消，或打开登录框后放弃；调用方应静默中止。
 *
 * 意外错误（非 LoginDismissedError）向上抛，由调用方按其错误分支处理。
 *
 * 依赖方向：本模块属 session 层，只依赖同层 `authGate`/`token` 与 i18n 单例；
 * `services/i18n` 不反向依赖 session，无循环依赖。
 */
import { i18n } from '@/services/i18n/ui-i18n';
import { isAuthenticated } from './token';
import { authGate, LoginDismissedError } from './authGate';

/** 未登录时弹「是否去登录」确认框；确认 true / 取消或失败 false。 */
function askConfirmLogin(): Promise<boolean> {
    return new Promise((resolve) => {
        uni.showModal({
            title: i18n.global.t('auth.loginRequiredTitle'),
            content: i18n.global.t('auth.loginRequiredContent'),
            confirmText: i18n.global.t('auth.goLogin'),
            cancelText: i18n.global.t('common.cancel'),
            success: (res) => resolve(!!res.confirm),
            fail: () => resolve(false),
        });
    });
}

/**
 * 写操作登录闸门。已登录直接放行；未登录先确认，确认后弹登录框并等待登录完成。
 * 取消确认或放弃登录 → false（调用方静默中止）。
 */
export async function confirmLogin(): Promise<boolean> {
    if (isAuthenticated()) return true;
    if (!(await askConfirmLogin())) return false;
    try {
        await authGate.requireLogin();
        return true;
    } catch (err) {
        if (err instanceof LoginDismissedError) return false;
        throw err;
    }
}
