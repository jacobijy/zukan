<template>
  <view class="fixed bottom-6 left-1/2 -translate-x-1/2 z-[1000] bg-white/95 backdrop-blur-lg rounded-full shadow-[0_8px_32px_rgba(0,0,0,0.12)] border border-white/50 px-3 py-2">
    <view class="flex items-center gap-3">
      <!-- 图鉴 Tab -->
      <view 
        class="flex items-center gap-1.5 cursor-pointer transition-all duration-300 px-2.5 py-1.5 rounded-full"
        :class="currentTab === 0 ? 'bg-gradient-to-r from-[#FF6B6B] to-[#EE5A6F] shadow-[0_4px_12px_rgba(238,90,111,0.3)] scale-105' : 'hover:bg-gray-100'"
        @click="switchTab(0)"
      >
        <!-- 宝可梦球图标 SVG -->
        <svg v-if="currentTab !== 0" width="16" height="16" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" class="transition-colors duration-300">
          <circle cx="24" cy="24" r="18" stroke="#9CA3AF" stroke-width="2.5" fill="none"/>
          <path d="M6 24 C6 14.06 14.06 6 24 6 C33.94 6 42 14.06 42 24" stroke="#9CA3AF" stroke-width="2.5" fill="none"/>
          <line x1="6" y1="24" x2="42" y2="24" stroke="#9CA3AF" stroke-width="2.5"/>
          <circle cx="24" cy="24" r="5" stroke="#9CA3AF" stroke-width="2.5" fill="white"/>
          <circle cx="24" cy="24" r="3" fill="#9CA3AF"/>
        </svg>
        <svg v-else width="16" height="16" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" class="transition-colors duration-300">
          <circle cx="24" cy="24" r="18" stroke="white" stroke-width="2.5" fill="none"/>
          <path d="M6 24 C6 14.06 14.06 6 24 6 C33.94 6 42 14.06 42 24" fill="white"/>
          <line x1="6" y1="24" x2="42" y2="24" stroke="white" stroke-width="2.5"/>
          <circle cx="24" cy="24" r="5" stroke="white" stroke-width="2.5" fill="white"/>
          <circle cx="24" cy="24" r="3" fill="white"/>
        </svg>
        <text 
          class="text-xs font-semibold whitespace-nowrap transition-colors duration-300"
          :class="currentTab === 0 ? 'text-white' : 'text-[#9CA3AF]'"
        >
          图鉴
        </text>
      </view>

      <!-- 功能 Tab -->
      <view 
        class="flex items-center gap-1.5 cursor-pointer transition-all duration-300 px-2.5 py-1.5 rounded-full"
        :class="currentTab === 1 ? 'bg-gradient-to-r from-[#FF6B6B] to-[#EE5A6F] shadow-[0_4px_12px_rgba(238,90,111,0.3)] scale-105' : 'hover:bg-gray-100'"
        @click="switchTab(1)"
      >
        <!-- 功能图标 SVG (闪电) -->
        <svg v-if="currentTab !== 1" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="transition-colors duration-300">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
        </svg>
        <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="white" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="transition-colors duration-300">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
        </svg>
        <text 
          class="text-xs font-semibold whitespace-nowrap transition-colors duration-300"
          :class="currentTab === 1 ? 'text-white' : 'text-[#9CA3AF]'"
        >
          功能
        </text>
      </view>

      <!-- 资料 Tab -->
      <view 
        class="flex items-center gap-1.5 cursor-pointer transition-all duration-300 px-2.5 py-1.5 rounded-full"
        :class="currentTab === 2 ? 'bg-gradient-to-r from-[#FF6B6B] to-[#EE5A6F] shadow-[0_4px_12px_rgba(238,90,111,0.3)] scale-105' : 'hover:bg-gray-100'"
        @click="switchTab(2)"
      >
        <!-- 资料图标 SVG (书本) -->
        <svg v-if="currentTab !== 2" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="transition-colors duration-300">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
        </svg>
        <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="white" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="transition-colors duration-300">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
        </svg>
        <text 
          class="text-xs font-semibold whitespace-nowrap transition-colors duration-300"
          :class="currentTab === 2 ? 'text-white' : 'text-[#9CA3AF]'"
        >
          资料
        </text>
      </view>

      <!-- 我的 Tab -->
      <view 
        class="flex items-center gap-1.5 cursor-pointer transition-all duration-300 px-2.5 py-1.5 rounded-full"
        :class="currentTab === 3 ? 'bg-gradient-to-r from-[#FF6B6B] to-[#EE5A6F] shadow-[0_4px_12px_rgba(238,90,111,0.3)] scale-105' : 'hover:bg-gray-100'"
        @click="switchTab(3)"
      >
        <!-- 用户图标 SVG -->
        <svg v-if="currentTab !== 3" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="transition-colors duration-300">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
          <circle cx="12" cy="7" r="4"></circle>
        </svg>
        <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="white" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="transition-colors duration-300">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
          <circle cx="12" cy="7" r="4"></circle>
        </svg>
        <text 
          class="text-xs font-semibold whitespace-nowrap transition-colors duration-300"
          :class="currentTab === 3 ? 'text-white' : 'text-[#9CA3AF]'"
        >
          我的
        </text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  modelValue: number
}>()

const emit = defineEmits(['update:modelValue', 'change'])

// 当前选中的 tab
const currentTab = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

// 切换 tab
const switchTab = (index: number) => {
  if (currentTab.value === index) return
  
  // 添加一个轻微的缩放效果反馈
  const tabElement = event?.target as HTMLElement;
  if (tabElement) {
    tabElement.style.transform = 'scale(0.95)';
    setTimeout(() => {
      tabElement.style.transform = '';
    }, 150);
  }
  
  currentTab.value = index
  emit('change', index)
  
  // 根据索引跳转到对应页面
  const pages = [
    '/pages/index/index',
    '/pages/features/features',
    '/pages/data/data',
    '/pages/mine/mine'
  ]
  
  uni.switchTab({
    url: pages[index]
  })
}
</script>

<style scoped>
/* 安全区域适配 */
.pb-safe {
  padding-bottom: env(safe-area-inset-bottom);
}

/* 添加更平滑的过渡动画 */
.transition-all {
  transition-property: all;
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  transition-duration: 300ms;
}
</style>