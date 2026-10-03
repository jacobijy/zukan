<script setup lang="ts">
import { onError, onLaunch, onUnhandledRejection } from "@dcloudio/uni-app";
import { applySafeArea } from "@/infra/platform/applySafeArea";
import { bootPrefetch } from "@/services/boot";
onLaunch(() => {
  // 安全区注入：读系统状态栏高度写成 CSS 变量，供全站 padding/导航栏消费。
  // 必须在 bootPrefetch 之前，避免首帧标题压进刘海/挖孔。
  applySafeArea();
  // 后台预热：拉 /api/v1/zukan/key + 版本对比 + 预取最新一代 bundle。
  // 不 await，网络失败也不阻塞 UI。
  bootPrefetch();
});
// 框架内部错误（如组件渲染、生命周期回调里抛出的错误）会带完整堆栈走到这里；
// 微信开发者工具控制台有时只打印一句 message，拿这个堆栈才能定位。
onError((err) => {
  console.error("[app:onError]", err);
});
onUnhandledRejection((res) => {
  console.error("[app:unhandledRejection]", res.reason);
});
</script>
<style>
/*
 * 顶部安全区 / 导航栏高度 —— 两层：env 基线 + JS 兜底。
 *
 * 第一层（全局基线，本文件 page）：--status-bar-height 取 env(safe-area-inset-top)，现代浏览器 /
 * 新 webview 正确返回刘海、状态栏高度，一处对全站生效。
 *
 * 第二层（JS 权威值，逐页根绑定）：applySafeArea 把 uni.getSystemInfoSync().statusBarHeight 写入
 * 响应式真相源，各页面根经 usePageSafeArea() 内联覆盖本页变量——env 返 0 的老基础库 / 部分安卓
 * XWeb 靠它修正；env 正确时两者相等、覆盖无害。H5 / App 另由 applySafeArea 写 :root。
 *
 * :root 的 0px 只是 env 之前的首帧默认。
 */
:root {
  --status-bar-height: 0px;
}

page {
  /* 第一层基线：设备安全区 env；env 缺失 / 返 0 时由页面根 JS 权威值兜底（usePageSafeArea）。 */
  --status-bar-height: env(safe-area-inset-top, 0px);
  /* 顶部红条内容区高度；输入框/按钮恒为红条的 72%。
     各页面曾用硬编码 52px 当此值，现统一走 --navbar-total-height，clamp 变高时留白自动跟随。 */
  --navbar-content-height: clamp(52px, 10vmin, 60px);
  --navbar-total-height: calc(var(--status-bar-height) + var(--navbar-content-height));
  --navbar-control-height: calc(var(--navbar-content-height) * 0.72);
}

.page-switch-panel {
  --page-panel-x: 0px;
  --page-panel-scale: 1;
  transform: translate3d(var(--page-panel-x), 0, 0) scale(var(--page-panel-scale));
}

/* 页面共享背景 */
.page-bg {
  position: relative;
  overflow: hidden;
  color: #24262b;
  background:
    radial-gradient(circle at 18% -10%, rgba(255, 255, 255, 0.95), transparent 34%),
    linear-gradient(180deg, #f7f8fb 0%, #f1f2f6 46%, #eef0f5 100%);
}

.page-bg::before {
  position: absolute;
  inset: 0;
  pointer-events: none;
  content: '';
  background-image:
    linear-gradient(rgba(45, 49, 58, 0.025) 1px, transparent 1px),
    linear-gradient(90deg, rgba(45, 49, 58, 0.022) 1px, transparent 1px);
  background-size: 32px 32px;
  mask-image: linear-gradient(to bottom, rgba(0, 0, 0, 0.5), transparent 58%);
}
</style>
