<template>
  <view class="fixed bottom-6 left-1/2 -translate-x-1/2 z-[1000] bg-white/95 backdrop-blur-lg rounded-full shadow-[0_8px_32px_rgba(0,0,0,0.12)] border border-white/50 px-3 py-2">
    <view class="tab-bar-track relative flex w-full min-w-[280px]">
      <!-- 滑动选中底框：等宽四格，仅用 translateX 位移 -->
      <view
        class="tab-indicator absolute top-0 left-0 h-full rounded-full bg-gradient-to-r from-[#FF6B6B] to-[#EE5A6F] shadow-[0_4px_12px_rgba(238,90,111,0.3)] pointer-events-none"
        :class="{ 'tab-indicator--animated': enableTransition }"
        :style="indicatorStyle"
      />

      <view
        v-for="(tab, index) in tabs"
        :key="tab.label"
        class="tab-item relative z-10 flex flex-1 items-center justify-center gap-1.5 px-2 py-1.5 rounded-full"
        @click="switchTab(index)"
      >
        <!-- 图鉴 -->
        <template v-if="index === 0">
          <svg v-if="currentTab !== 0" width="16" height="16" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" class="tab-icon">
            <circle cx="24" cy="24" r="18" stroke="#9CA3AF" stroke-width="2.5" fill="none"/>
            <path d="M6 24 C6 14.06 14.06 6 24 6 C33.94 6 42 14.06 42 24" stroke="#9CA3AF" stroke-width="2.5" fill="none"/>
            <line x1="6" y1="24" x2="42" y2="24" stroke="#9CA3AF" stroke-width="2.5"/>
            <circle cx="24" cy="24" r="5" stroke="#9CA3AF" stroke-width="2.5" fill="white"/>
            <circle cx="24" cy="24" r="3" fill="#9CA3AF"/>
          </svg>
          <svg v-else width="16" height="16" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" class="tab-icon">
            <circle cx="24" cy="24" r="18" stroke="white" stroke-width="2.5" fill="none"/>
            <path d="M6 24 C6 14.06 14.06 6 24 6 C33.94 6 42 14.06 42 24" fill="white"/>
            <line x1="6" y1="24" x2="42" y2="24" stroke="white" stroke-width="2.5"/>
            <circle cx="24" cy="24" r="5" stroke="white" stroke-width="2.5" fill="white"/>
            <circle cx="24" cy="24" r="3" fill="white"/>
          </svg>
        </template>
        <!-- 功能 -->
        <template v-else-if="index === 1">
          <svg v-if="currentTab !== 1" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="tab-icon">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
          </svg>
          <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="white" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="tab-icon">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
          </svg>
        </template>
        <!-- 资料 -->
        <template v-else-if="index === 2">
          <svg v-if="currentTab !== 2" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="tab-icon">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
          </svg>
          <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="white" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="tab-icon">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
          </svg>
        </template>
        <!-- 我的 -->
        <template v-else>
          <svg v-if="currentTab !== 3" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="tab-icon">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
            <circle cx="12" cy="7" r="4"></circle>
          </svg>
          <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="white" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="tab-icon">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
            <circle cx="12" cy="7" r="4"></circle>
          </svg>
        </template>

        <text
          class="text-xs font-semibold whitespace-nowrap tab-label"
          :class="currentTab === index ? 'text-white' : 'text-[#9CA3AF]'"
        >
          {{ tab.label }}
        </text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue';

const TAB_SLIDE_FROM_KEY = 'tab_indicator_from'

const props = defineProps<{
  modelValue: number
}>()

const emit = defineEmits(['update:modelValue', 'change'])

const tabs = [
  { label: '图鉴' },
  { label: '功能' },
  { label: '资料' },
  { label: '我的' },
]

const pages = [
  '/pages/index/index',
  '/pages/features/features',
  '/pages/data/data',
  '/pages/mine/mine',
]

const currentTab = computed(() => props.modelValue)

/** 底框当前所在格（0-3），与 currentTab 解耦以控制动画时机 */
const indicatorIndex = ref(props.modelValue)
const enableTransition = ref(false)

const indicatorStyle = computed(() => ({
  width: `${100 / tabs.length}%`,
  transform: `translateX(${indicatorIndex.value * 100}%)`,
}))

const switchTab = (index: number) => {
  if (currentTab.value === index) return

  // 记录来源 tab，供新页面挂载后播放一次滑动动画
  uni.setStorageSync(TAB_SLIDE_FROM_KEY, currentTab.value)
  emit('change', index)
  uni.reLaunch({ url: pages[index] })
}

onMounted(() => {
  const stored = uni.getStorageSync(TAB_SLIDE_FROM_KEY)
  const fromIndex =
    stored !== '' && stored !== undefined && !Number.isNaN(Number(stored))
      ? Number(stored)
      : null

  uni.removeStorageSync(TAB_SLIDE_FROM_KEY)

  const targetIndex = props.modelValue

  if (fromIndex !== null && fromIndex !== targetIndex) {
    // 先无动画定位到来源格，再滑到目标格（仅一次）
    indicatorIndex.value = fromIndex
    nextTick(() => {
      requestAnimationFrame(() => {
        enableTransition.value = true
        indicatorIndex.value = targetIndex
      })
    })
  } else {
    // 刷新或直接打开：无动画，直接落位
    indicatorIndex.value = targetIndex
    nextTick(() => {
      requestAnimationFrame(() => {
        enableTransition.value = true
      })
    })
  }
})
</script>

<style scoped>
.tab-indicator {
  transition: none;
  will-change: transform;
}

.tab-indicator--animated {
  transition: transform 0.35s cubic-bezier(0.4, 0, 0.2, 1);
}

.tab-icon,
.tab-label {
  transition: color 0.28s ease, stroke 0.28s ease, fill 0.28s ease;
}

.tab-item:active {
  opacity: 0.85;
}
</style>
