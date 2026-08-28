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
            class="tab-icon__paths"
            fill="none"
            stroke="currentColor"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path v-for="(d, i) in tab.icon" :key="i" :d="d" />
          </g>
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
}

// 线条型（仿 SF Symbols outline）：两态都用线框，选中只改颜色并略微加粗
// （SF regular → medium 的字重变化），不做填充切换。
const roundedRect = (x: number, y: number, w: number, h: number, r: number) =>
  `M${x + r} ${y}h${w - 2 * r}a${r} ${r} 0 0 1 ${r} ${r}v${h - 2 * r}a${r} ${r} 0 0 1 -${r} ${r}H${x + r}a${r} ${r} 0 0 1 -${r} -${r}V${y + r}a${r} ${r} 0 0 1 ${r} -${r}z`

// book.closed：封面闭合轮廓（左侧上下弧接书脊竖边）
const bookOutline = 'M6.5 2.5H20v19H6.5A2.5 2.5 0 0 1 4 19V5A2.5 2.5 0 0 1 6.5 2.5z'

const ICONS = {
  book: {
    icon: [
      // 书页底沿：书脊竖边底端弧接到封面，再横到翻口
      'M4 19A2.5 2.5 0 0 1 6.5 16.5H20',
      bookOutline,
      // 书页线靠左、长度递减、位置偏上 —— 读作书页而非等号
      'M8.8 8h5.4',
      'M8.8 10.8h4',
    ],
  },
  grid: {
    // square.grid.2x2：饱满方块，圆角约为方块边长的 0.27（SF 比例）
    icon: [
      roundedRect(4, 4, 6.5, 6.5, 1.8),
      roundedRect(13.5, 4, 6.5, 6.5, 1.8),
      roundedRect(4, 13.5, 6.5, 6.5, 1.8),
      roundedRect(13.5, 13.5, 6.5, 6.5, 1.8),
    ],
  },
  folder: {
    // folder：扁宽比例，tab 更矮，圆角柔和
    icon: [
      'M3.5 7.2A2.2 2.2 0 0 1 5.7 5h4a1 1 0 0 1 .78.37l1.36 1.63h6.76A2.2 2.2 0 0 1 20.8 9.2v8.1a2.2 2.2 0 0 1-2.2 2.2H5.7a2.2 2.2 0 0 1-2.2-2.2V7.2z',
    ],
  },
  person: {
    // person：头环 + 饱满宽肩弧（两端接近画布边缘）
    icon: [
      'M12 12.3a4.3 4.3 0 1 0 0-8.6 4.3 4.3 0 0 0 0 8.6z',
      'M4.2 20.5c0-3.9 3.4-6.5 7.8-6.5s7.8 2.6 7.8 6.5',
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

.tab-icon__paths {
  stroke-width: 1.8;
  transition: stroke-width 0.18s ease;
}

/* 线条型选中态：SF regular → medium 的字重变化 */
.tab-item--active .tab-icon__paths {
  stroke-width: 2.2;
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
