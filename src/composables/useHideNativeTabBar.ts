import { onShow } from '@dcloudio/uni-app'

/**
 * 隐藏 pages.json 声明的原生 tabBar（界面改用自定义浮动胶囊 `components/TabBar.vue`）。
 *
 * 在 tab 页 setup 中调用：每次 onShow 都确保原生条隐藏。`hideTabBar` 是全局状态、
 * 重复调用无害；放在 onShow 尽量在首帧前隐藏，避免原生条一闪。
 *
 * 说明：保活与生命周期仍由原生 tabBar 机制提供（页面只创建一次、切走 onHide、
 * 切回 onShow），这里只是把原生条的**视觉**藏掉，并不影响该机制。
 */
export function useHideNativeTabBar(): void {
    onShow(() => {
        uni.hideTabBar({ animation: false })
    })
}
