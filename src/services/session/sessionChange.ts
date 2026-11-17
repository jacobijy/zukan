/**
 * 会话变化广播：登录 / 登出时通知订阅方刷新自己的登录态快照。
 *
 * 背景：页面由 switchTab 保活、setup 不重跑，登录 / 登出发生在别的页面时，
 * 已保活页面里 `isAuthenticated()` 的 ref 快照不会自动更新。token.ts 的
 * `onSessionClear` 只覆盖「清会话」一个方向，这里提供一个双向通知点，
 * 供 NavBar 之类的常驻组件同步登录态。
 *
 * 与 authGate 同理走模块级单例而非 Pinia：session 层不能反向依赖 store。
 *
 * 触发点：
 * - `clearSession()`（登出 / refresh 失败）→ 清除侧自动通知（token.ts 内）；
 * - 登录成功侧没有单一汇聚点（authApi.login / 微信 / 第三方多个入口），
 *   由挂了 LoginModal 的页面在 `@success` 里调 `notifySessionChange()`。
 */
type Listener = () => void;

const listeners: Listener[] = [];

/** 订阅会话变化；返回取消订阅函数（组件 onUnmounted 时调用）。 */
export function onSessionChange(fn: Listener): () => void {
    listeners.push(fn);
    return () => {
        const i = listeners.indexOf(fn);
        if (i >= 0) listeners.splice(i, 1);
    };
}

/** 登录 / 登出后广播；同步遍历，监听器里的异常不中断其他监听器。 */
export function notifySessionChange(): void {
    for (const fn of listeners) {
        try {
            fn();
        } catch (err) {
            console.warn('[sessionChange] 监听器执行失败', err);
        }
    }
}
