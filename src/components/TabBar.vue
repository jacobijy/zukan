<template>
  <view class="tabbar-shell">
    <view class="tab-bar-track">
      <view
        class="tab-indicator"
        :class="{ 'tab-indicator--animated': enableTransition }"
        :style="indicatorStyle"
      />

      <view
        v-for="(tab, index) in tabs"
        :key="tab.key"
        class="tab-item"
        :class="{ 'tab-item--active': currentTab === index }"
        @click="switchTab(index)"
      >
        <svg class="tab-icon" viewBox="0 0 24 24" aria-hidden="true">
          <g
            v-if="currentTab !== index"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path v-for="(d, i) in tab.icon" :key="i" :d="d" />
          </g>
          <path
            v-for="(d, i) in tab.iconFill"
            :key="`f-${i}`"
            :d="d"
            fill="currentColor"
          />
        </svg>
        <text class="tab-label">{{ tab.label }}</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';

const TAB_SLIDE_FROM_KEY = 'tab_indicator_from'

const props = defineProps<{
  modelValue: number
}>()

const emit = defineEmits(['update:modelValue', 'change'])

const { t } = useI18n()

interface TabDef {
  key: string
  label: string
  icon: string[]
  iconFill: string[]
}

// SF Symbols 风格：未选中线框、选中填充。
const ICONS = {
  book: {
    icon: [
      'M4 19.5A2.5 2.5 0 0 1 6.5 17H20',
      'M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z',
      'M8.5 7.5h7',
      'M8.5 11h5',
    ],
    iconFill: [
      'M6.5 2A2.5 2.5 0 0 0 4 4.5v15A2.5 2.5 0 0 0 6.5 22H20V2H6.5zm2 4.5h7a.7.7 0 0 1 0 1.4h-7a.7.7 0 1 1 0-1.4zm0 3.7h5a.7.7 0 0 1 0 1.4h-5a.7.7 0 1 1 0-1.4z',
    ],
  },
  grid: {
    icon: [
      'M4 4h6a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z',
      'M14 4h6a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-6a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z',
      'M4 12h6a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1z',
      'M14 12h6a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-6a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1z',
    ],
    iconFill: [
      'M4 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2H4zm10 0a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2h-6zM4 13a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2H4zm10 0a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-6z',
    ],
  },
  folder: {
    icon: [
      'M3 6.5A2.5 2.5 0 0 1 5.5 4h4.2a1 1 0 0 1 .78.38l1.34 1.62H18.5A2.5 2.5 0 0 1 21 8.5v9A2.5 2.5 0 0 1 18.5 20h-13A2.5 2.5 0 0 1 3 17.5v-11z',
    ],
    iconFill: [
      'M3 6.5A2.5 2.5 0 0 1 5.5 4h4.2a1 1 0 0 1 .78.38L11.82 6H18.5A2.5 2.5 0 0 1 21 8.5v9A2.5 2.5 0 0 1 18.5 20h-13A2.5 2.5 0 0 1 3 17.5v-11z',
    ],
  },
  person: {
    icon: [
      'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
      'M4.5 20c0-3.6 3.4-6 7.5-6s7.5 2.4 7.5 6',
    ],
    iconFill: [
      'M12 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9zm0 2c-4.6 0-8 2.5-8 6v.5c0 .55.45 1 1 1h14c.55 0 1-.45 1-1V20c0-3.5-3.4-6-8-6z',
    ],
  },
}

const tabs = computed<TabDef[]>(() => [
  { key: 'dex', label: t('tabs.dex'), ...ICONS.book },
  { key: 'features', label: t('tabs.features'), ...ICONS.grid },
  { key: 'data', label: t('tabs.data'), ...ICONS.folder },
  { key: 'mine', label: t('tabs.mine'), ...ICONS.person },
])

const pages = [
  '/pages/index/index',
  '/pages/features/features',
  '/pages/data/data',
  '/pages/mine/mine',
]

const currentTab = computed(() => props.modelValue)

/** 滑块当前所在格（0-3），与 currentTab 解耦以控制动画时机 */
const indicatorIndex = ref(props.modelValue)
const enableTransition = ref(false)

const indicatorStyle = computed(() => ({
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
  position: fixed;
  left: 16px;
  right: 16px;
  bottom: calc(env(safe-area-inset-bottom) + 16px);
  z-index: 1000;
  height: 64px;
  border-radius: 32px;
  background: rgba(255, 255, 255, 0.72);
  border: 0.5px solid rgba(255, 255, 255, 0.55);
  box-shadow:
    0 12px 30px rgba(0, 0, 0, 0.1),
    0 2px 8px rgba(0, 0, 0, 0.05);
  -webkit-backdrop-filter: saturate(180%) blur(20px);
  backdrop-filter: saturate(180%) blur(20px);
  overflow: hidden;
}

.tab-bar-track {
  position: relative;
  display: flex;
  align-items: stretch;
  height: 100%;
  padding: 8px;
}

.tab-indicator {
  position: absolute;
  top: 8px;
  left: 8px;
  height: calc(100% - 16px);
  /* 100% = 轨道 padding box；减去 16px 水平 padding 后四等分，与每个 tab 等宽。
     translateX(100%) 即一格步长。 */
  width: calc((100% - 16px) / 4);
  border-radius: 24px;
  background: rgba(0, 122, 255, 0.12);
  transition: none;
  will-change: transform;
}

.tab-indicator--animated {
  transition: transform 0.32s cubic-bezier(0.4, 0, 0.2, 1);
}

.tab-item {
  position: relative;
  z-index: 1;
  flex: 1 1 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  color: #8e8e93;
  -webkit-tap-highlight-color: transparent;
  transition: color 0.2s ease, transform 0.12s ease;
}

.tab-item--active {
  color: #007aff;
}

.tab-item:active {
  transform: scale(0.94);
}

.tab-icon {
  width: 25px;
  height: 25px;
  flex: 0 0 auto;
}

.tab-label {
  font-size: 11px;
  line-height: 13px;
  font-weight: 400;
  letter-spacing: 0.01em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
  padding: 0 2px;
}

.tab-item--active .tab-label {
  font-weight: 500;
}

@media (prefers-color-scheme: dark) {
  .tabbar-shell {
    background: rgba(28, 28, 30, 0.72);
    border-color: rgba(255, 255, 255, 0.08);
    box-shadow:
      0 12px 30px rgba(0, 0, 0, 0.45),
      0 2px 8px rgba(0, 0, 0, 0.3);
  }

  .tab-indicator {
    background: rgba(10, 132, 255, 0.2);
  }

  .tab-item {
    color: #98989f;
  }

  .tab-item--active {
    color: #0a84ff;
  }
}
</style>
