<script setup lang="ts">
import { onError, onLaunch, onUnhandledRejection } from "@dcloudio/uni-app";
import { bootPrefetch } from "@/services/boot";
onLaunch(() => {
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
page {
  /* 顶部红条内容区高度；输入框/按钮恒为红条的 72% */
  --navbar-content-height: clamp(52px, 10vmin, 60px);
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
