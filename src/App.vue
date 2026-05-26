<script setup lang="ts">
import { onLaunch, onShow, onHide } from "@dcloudio/uni-app";
onLaunch(() => {
  console.log("App Launch");
});
onShow(() => {
  console.log("App Show");
});
onHide(() => {
  console.log("App Hide");
});
</script>
<style>
page {
  /* 顶部红条内容区高度；输入框/按钮恒为红条的 72% */
  --navbar-content-height: clamp(52px, 10vmin, 60px);
  --navbar-control-height: calc(var(--navbar-content-height) * 0.72);
}
</style>
