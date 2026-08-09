/**
 * 登录闸门：全局登录弹层的显示状态 + 等待登录完成的 promise
 *
 * 为什么是模块级单例而不是 Pinia store：本模块被 `session/key.ts` 使用，
 * 而 store 层反过来依赖 session（`store/pokemon.ts` → `services/session`）。
 * 走 Pinia 会形成循环依赖。
 *
 * ## 用法
 * 需要登录的底层代码（如 `getKey()`）：
 * ```ts
 * await authGate.requireLogin();   // 弹层出现，登录成功后 resolve
 * ```
 * 页面挂载弹层：
 * ```vue
 * <LoginModal v-model:visible="authGate.visible" @success="authGate.notifySuccess()" />
 * ```
 *
 * 页面**必须**同时把关闭事件接到 `notifyDismiss()`，否则用户关掉弹层后
 * `requireLogin()` 的等待者会永久悬着 —— 这正是我们要修的"卡住"。
 */
import { ref, watch } from 'vue';

/** 用户主动关闭登录弹层（未完成登录）时，`requireLogin()` 抛出此错误。 */
export class LoginDismissedError extends Error {
    constructor() {
        super('用户取消了登录');
        this.name = 'LoginDismissedError';
    }
}

const visible = ref(false);

/** 等待本次登录结果的所有调用方。登录成功全部 resolve，关闭弹层全部 reject。 */
let waiters: Array<{ resolve: () => void; reject: (e: Error) => void }> = [];

function settleAll(ok: boolean): void {
    const pending = waiters;
    waiters = [];
    for (const w of pending) {
        if (ok) w.resolve();
        else w.reject(new LoginDismissedError());
    }
}

// 兜底：弹层被任何方式关掉（点遮罩、点 ×、父组件置 false）而没走
// notifySuccess 时，唤醒等待者并让它们 reject。
// 没有这一层，只要页面漏接 notifyDismiss，await 就永久悬住。
watch(visible, (v) => {
    if (!v && waiters.length > 0) settleAll(false);
});

export const authGate = {
    /** 登录弹层是否可见。页面用 `v-model:visible` 绑定。 */
    visible,

    /**
     * 要求用户登录。弹出登录层并返回 promise：
     * - 登录成功 → resolve（此时 token 已由 `authApi.login` 写入存储）
     * - 用户关闭弹层 → reject(`LoginDismissedError`)
     *
     * 并发调用共享同一次弹层，不会叠出多个。
     */
    requireLogin(): Promise<void> {
        visible.value = true;
        return new Promise<void>((resolve, reject) => {
            waiters.push({ resolve, reject });
        });
    },

    /**
     * 打开登录弹层（用户主动触发，如"我的"页的"点击登录"）。
     * 与 `requireLogin` 的区别：不创建等待 promise —— 调用方无需 await。
     */
    open(): void {
        visible.value = true;
    },

    /** 登录成功。由 `<LoginModal @success>` 调用。 */
    notifySuccess(): void {
        visible.value = false;
        settleAll(true);
    },

    /** 用户放弃登录。由弹层关闭路径调用。 */
    notifyDismiss(): void {
        visible.value = false;
        settleAll(false);
    },
};
