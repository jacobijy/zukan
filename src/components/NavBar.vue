<template>
  <view
    class="navbar-root fixed top-0 left-0 right-0 z-[1000] bg-gradient-to-br from-[#FF6B6B] to-[#EE5A6F] shadow-[0_4px_20px_rgba(238,90,111,0.3)] backdrop-blur-lg"
    :style="{ paddingTop: 'var(--status-bar-height)' }"
  >
    <view class="navbar-inner flex items-center justify-center px-4 relative">
      <view class="absolute left-4 flex items-center gap-2 cursor-pointer" @click="goHome">
        <view class="navbar-logo rounded-full bg-white flex items-center justify-center shadow-[0_2px_8px_rgba(0,0,0,0.15)] relative overflow-hidden transition-transform duration-300 hover:scale-110 active:scale-95">
          <view class="absolute top-0 left-0 right-0 h-1/2 bg-gradient-to-b from-[#FF6B6B] to-[#FF8787]"></view>
          <view class="absolute bottom-0 left-0 right-0 h-1/2 bg-white"></view>
          <view class="absolute top-1/2 left-0 right-0 h-[2px] bg-[#333] -translate-y-1/2"></view>
          <view class="navbar-logo-dot absolute top-1/2 left-1/2 bg-white border-[2px] border-[#333] rounded-full -translate-x-1/2 -translate-y-1/2 z-10"></view>
        </view>
      </view>
      <text class="text-xl font-bold text-white whitespace-nowrap drop-shadow-[0_2px_4px_rgba(0,0,0,0.12)]">{{ title }}</text>
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

const goHome = () => {
  uni.switchTab({
    url: '/pages/index/index'
  })
}
</script>

<style lang="scss" scoped>
.navbar-inner {
  height: var(--navbar-content-height);
}

.navbar-logo {
  width: calc(var(--navbar-content-height) * 0.55);
  height: calc(var(--navbar-content-height) * 0.55);
}

.navbar-logo-dot {
  width: calc(var(--navbar-content-height) * 0.18);
  height: calc(var(--navbar-content-height) * 0.18);
}
</style>
