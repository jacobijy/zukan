/**
 * 状态栏高度的响应式真相源。
 *
 * 微信小程序逻辑层**没有 DOM**，无法像 H5/App 那样用
 * `document.documentElement.style.setProperty` 写 CSS 变量。故 `applySafeArea`
 * 读到的高度同时写入这里，各页面根节点通过 `usePageSafeArea()` 内联绑定，
 * 经 wxml 数据驱动把 `--status-bar-height` 注入到该页渲染树。
 */
import { ref } from 'vue';

/** 归一后的顶部状态栏高度（CSS 值字符串，恒非空）。 */
export const statusBarHeight = ref('0px');

/** 更新真相源；由 applySafeArea 在启动时写入。 */
export function setStatusBarHeight(height: string): void {
    statusBarHeight.value = height;
}
