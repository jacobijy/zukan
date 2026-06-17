<template>
  <view class="tabbar-shell fixed bottom-6 left-1/2 z-[1000] -translate-x-1/2 rounded-full border border-[#e5e7ee] bg-white px-2.5 py-2 shadow-[0_18px_48px_rgba(48,55,72,0.14)]">
    <view class="tab-bar-track relative flex w-full min-w-[280px]">
      <view
        class="tab-indicator absolute left-0 top-0 h-full rounded-full bg-[linear-gradient(135deg,#73b7ff,#357df4)] shadow-[0_10px_22px_rgba(53,125,244,0.24)] pointer-events-none"
        :class="{ 'tab-indicator--animated': enableTransition }"
        :style="indicatorStyle"
      />

      <view
        v-for="(tab, index) in tabs"
        :key="tab.label"
        class="tab-item relative z-10 flex flex-1 items-center justify-center gap-1.5 rounded-full px-2 py-1.5"
        @click="switchTab(index)"
      >
        <svg v-if="index === 0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="tab-icon h-4 w-4" :class="currentTab === index ? 'text-white' : 'text-[#8d929c]'">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
          <path d="M9 7h6"></path>
          <path d="M9 11h4"></path>
        </svg>

        <svg v-else-if="index === 1" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="tab-icon h-4 w-4" :class="currentTab === index ? 'text-white' : 'text-[#8d929c]'">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
        </svg>

        <svg v-else-if="index === 2" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="tab-icon h-4 w-4" :class="currentTab === index ? 'text-white' : 'text-[#8d929c]'">
          <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4H19a1 1 0 0 1 1 1v15a1 1 0 0 1-1 1H6.5A2.5 2.5 0 0 1 4 18.5z"></path>
          <path d="M8 8h8"></path>
          <path d="M8 12h6"></path>
        </svg>

        <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="tab-icon h-4 w-4" :class="currentTab === index ? 'text-white' : 'text-[#8d929c]'">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
          <circle cx="12" cy="7" r="4"></circle>
        </svg>

        <text
          class="tab-label whitespace-nowrap text-xs font-black"
          :class="currentTab === index ? 'text-white' : 'text-[#8d929c]'"
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
.tabbar-shell {
  overflow: hidden;
}

.tabbar-shell::before {
  display: none;
}

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
