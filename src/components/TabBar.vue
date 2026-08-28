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
        <svg
          class="tab-icon"
          :class="{ 'tab-icon--pop': currentTab === index }"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
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
            fill-rule="evenodd"
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

// SF Symbols 风格：未选中线框、选中填充。线框与填充外轮廓同构，切换不跳动。
// 填充态用 fill-rule="evenodd" 镂空内部细节（书的丝带），透出底色而非画白线。
const roundedSquare = (x: number, y: number, size: number, r: number) =>
  `M${x + r} ${y}h${size - 2 * r}a${r} ${r} 0 0 1 ${r} ${r}v${size - 2 * r}a${r} ${r} 0 0 1 -${r} ${r}H${x + r}a${r} ${r} 0 0 1 -${r} -${r}V${y + r}a${r} ${r} 0 0 1 ${r} -${r}z`

const ICONS = {
  book: {
    // 手册：封面 + 右上角丝带书签
    icon: [
      'M6.5 2.5H20v19H6.5A2.5 2.5 0 0 1 4 19V5A2.5 2.5 0 0 1 6.5 2.5z',
      'M15.4 2.5v5.1l1.6-1.2 1.6 1.2V2.5',
    ],
    iconFill: [
      'M6.5 2.5H20v19H6.5A2.5 2.5 0 0 1 4 19V5A2.5 2.5 0 0 1 6.5 2.5z' +
        'M16.1 2.5v3.5l0.9-0.68 0.9 0.68V2.5z',
    ],
  },
  grid: {
    // 四个独立圆角方块：线框是方格、填充是圆点感方块，读作"功能矩阵"
    icon: [
      roundedSquare(4, 4, 6.2, 1.9),
      roundedSquare(13.8, 4, 6.2, 1.9),
      roundedSquare(4, 13.8, 6.2, 1.9),
      roundedSquare(13.8, 13.8, 6.2, 1.9),
    ],
    iconFill: [
      roundedSquare(4, 4, 6.2, 1.9),
      roundedSquare(13.8, 4, 6.2, 1.9),
      roundedSquare(4, 13.8, 6.2, 1.9),
      roundedSquare(13.8, 13.8, 6.2, 1.9),
    ],
  },
  folder: {
    // 纯净文件夹，内部不加线（25px 下短线会读作减号）
    icon: [
      'M3.5 6.8A2.3 2.3 0 0 1 5.8 4.5h4a1 1 0 0 1 .78.37l1.36 1.63h6.66A2.3 2.3 0 0 1 20.9 8.8v8.9a2.3 2.3 0 0 1-2.3 2.3H5.8a2.3 2.3 0 0 1-2.3-2.3V6.8z',
    ],
    iconFill: [
      'M3.5 6.8A2.3 2.3 0 0 1 5.8 4.5h4a1 1 0 0 1 .78.37l1.36 1.63h6.66A2.3 2.3 0 0 1 20.9 8.8v8.9a2.3 2.3 0 0 1-2.3 2.3H5.8a2.3 2.3 0 0 1-2.3-2.3V6.8z',
    ],
  },
  person: {
    // 头环 + 宽肩弧，填充态头肩连成一个整体人像
    icon: [
      'M12 12.2a4.2 4.2 0 1 0 0-8.4 4.2 4.2 0 0 0 0 8.4z',
      'M5 20.4c0-3.7 3.1-6.3 7-6.3s7 2.6 7 6.3',
    ],
    iconFill: [
      'M12 3.8a4.2 4.2 0 1 0 0 8.4 4.2 4.2 0 0 0 0-8.4z' +
        'M12 14.1c-3.9 0-7 2.6-7 6.3v.3c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-.3c0-3.7-3.1-6.3-7-6.3z',
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

/* 选中落位时图标轻弹一下，与指示器滑动同期 */
.tab-icon--pop {
  animation: tab-icon-pop 0.38s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes tab-icon-pop {
  0% {
    transform: scale(0.72);
  }
  100% {
    transform: scale(1);
  }
}

@media (prefers-reduced-motion: reduce) {
  .tab-icon--pop {
    animation: none;
  }
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
