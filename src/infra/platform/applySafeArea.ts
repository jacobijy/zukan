/**
 * 安全区 CSS 变量注入器。
 *
 * 职责单一：在 App 启动时读一次系统信息，把顶部状态栏高度写成 CSS 变量，
 * 供全站消费（NavBar / DetailNavbar / 各页面 padding / scroll-view 高度）。
 *
 * 为什么用 `html`（H5）而不是 `page`：`<page>` 是 uni-app 的虚拟标签，
 * `document.querySelector('page')` 在 H5 拿不到；`html`/`:root` 三端都能命中，
 * 而变量会向下继承到 `page` 与所有子元素。
 *
 * 幂等：重复调用只是重写同一组变量，无副作用。
 */

import { hostPlatform } from './host';
import { resolveStatusBarHeight } from './safeArea';
import { setStatusBarHeight } from './safeAreaState';

/**
 * 把顶部状态栏高度注入 `--status-bar-height`。
 *
 * `--navbar-total-height` 由 CSS 侧的 `calc(var(--status-bar-height) + var(--navbar-content-height))`
 * 推导，故这里只需写一个原子值——单一真相源。
 *
 * 读不到系统信息时静默退化（由 `resolveStatusBarHeight` 保证），永不抛出、永不影响启动。
 * 幂等：重复调用只是重写同一值，无副作用。
 *
 * 注入有两条路径：有 DOM（H5 / App 的 vue webview）走 document；无 DOM（微信小程序）
 * 写响应式真相源、由页面根内联绑定注入——见 `safeAreaState` / `usePageSafeArea`。
 */
export function applySafeArea(): void {
    let height = '0px';
    try {
        if (typeof uni !== 'undefined' && typeof uni.getSystemInfoSync === 'function') {
            height = resolveStatusBarHeight(hostPlatform, uni.getSystemInfoSync());
        }
    } catch {
        height = '0px';
    }

    // H5 / App（vue webview 有 DOM）：写 document 根，全站继承。
    if (typeof document !== 'undefined' && document.documentElement) {
        document.documentElement.style.setProperty('--status-bar-height', height);
    }
    // 全平台写响应式真相源：微信小程序逻辑层无 DOM，上面的 document 分支不执行，
    // 改由各页面根节点经 usePageSafeArea() 内联绑定，把变量数据驱动地注入该页渲染树。
    setStatusBarHeight(height);
}
