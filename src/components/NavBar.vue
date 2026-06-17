<template>
  <view
    class="navbar-root fixed top-0 left-0 right-0 z-[1000] border-b border-[#e5e7ee] bg-white shadow-[0_4px_18px_rgba(48,55,72,0.06)]"
    :style="{ paddingTop: 'var(--status-bar-height)' }"
  >
    <view class="navbar-inner relative flex items-center justify-center px-4">
      <text class="whitespace-nowrap text-xl font-black tracking-[-0.04em] text-[#24262b]">{{ title }}</text>
    </view>
  </view>
</template>

<script setup>
defineProps({
  title: {
    type: String,
    default: '宝可梦图鉴'
  }
})
</script>

<style lang="scss" scoped>
.navbar-inner {
  height: var(--navbar-content-height);
}
</style>
