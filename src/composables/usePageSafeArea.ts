/**
 * 页面根安全区变量注入：供页面 / 布局壳的根节点 `:style` 绑定。
 *
 * 为什么每个页面根都要绑定，而不能只靠全局 CSS 的 `page` 选择器：
 * 1. 微信小程序逻辑层无 DOM，全局变量只能通过 wxml 内联 style 以数据驱动方式注入；
 * 2. CSS 自定义属性在 `page` 上算定后，`--navbar-total-height` 已是「按 page 的
 *    `--status-bar-height` 替换好的值」；后代即使重新声明 `--status-bar-height`，
 *    继承来的`--navbar-total-height` 也**不会重算**。故页面根必须同时重声明两者。
 *
 * 纯 computed、不挂组件生命周期，可在 node 单测中直接调用。
 */
import { computed } from 'vue';
import { statusBarHeight } from '@/infra/platform/safeAreaState';

export function usePageSafeArea() {
    return computed(() => {
        const h = statusBarHeight.value;
        return {
            '--status-bar-height': h,
            // --navbar-content-height 继承自 App.vue 的 page 定义（clamp 表达式，单一来源）
            '--navbar-total-height': `calc(${h} + var(--navbar-content-height))`,
        };
    });
}
