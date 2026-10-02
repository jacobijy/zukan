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
        <!-- #ifdef MP-WEIXIN -->
        <!-- MP 用字体字形（H5 用内联 svg）；两者都由 .tab-item 的 flex 居中，
             选中弹跳共用 tab-icon--pop（纯 scale）。历史曾加 translateY 校正字形
             基线偏下，但那偏下实为 box-sizing content-box 撑高被裁的假象，补
             border-box 后即消失，故不再需要 MP 专属偏移。 -->
        <text
          class="ic tab-icon text-[25px]"
          :class="{ 'tab-icon--pop': currentTab === index }"
        >{{ glyph(tab.fontName) }}</text>
        <!-- #endif -->
        <!-- #ifndef MP-WEIXIN -->
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
        <!-- #endif -->
        <text class="tab-label">{{ tab.label }}</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { useI18n } from 'vue-i18n';
import { raf } from '@/utils/raf';
import { glyph } from '@/components/icon/glyphs';

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
  fontName: string
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
  { key: 'dex', label: t('tabs.dex'), ...ICONS.book, fontName: 'tab-book' },
  { key: 'features', label: t('tabs.features'), ...ICONS.grid, fontName: 'tab-grid' },
  { key: 'data', label: t('tabs.data'), ...ICONS.folder, fontName: 'tab-folder' },
  { key: 'mine', label: t('tabs.mine'), ...ICONS.person, fontName: 'tab-person' },
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
/** 是否已完成首次挂载（用于区分首次 onShow 与保活后的 onShow） */
let hasMounted = false

const indicatorStyle = computed(() => ({
  transform: `translateX(${indicatorIndex.value * 100}%)`,
}))

const switchTab = (index: number) => {
  if (currentTab.value === index) return

  // 记录来源 tab，供目标页播放指示器滑动动画（首次挂载或保活后 onShow）
  uni.setStorageSync(TAB_SLIDE_FROM_KEY, currentTab.value)
  emit('change', index)
  // switchTab：tab 页由原生 tabBar 机制保活（只创建一次），切回走 onShow、不重建，
  // 页面状态与滚动位置由平台保留。原为 reLaunch（每次销毁重建 → 回顶、卡顿）。
  uni.switchTab({ url: pages[index] })
}

/** 读 storage 里记录的来源格；无有效记录返回 null */
function readFromIndex(): number | null {
  const stored = uni.getStorageSync(TAB_SLIDE_FROM_KEY)
  if (stored === '' || stored === undefined || Number.isNaN(Number(stored))) return null
  return Number(stored)
}

/**
 * 进入本页时播放指示器滑动：先无动画定位到来源格，下一帧滑到本页格。
 * 首次挂载与保活后 onShow 共用；storage 读完即删，避免重复播放。
 */
function playEnterAnimation(): void {
  const targetIndex = props.modelValue
  const fromIndex = readFromIndex()
  uni.removeStorageSync(TAB_SLIDE_FROM_KEY)

  if (fromIndex !== null && fromIndex !== targetIndex) {
    enableTransition.value = false
    indicatorIndex.value = fromIndex
    nextTick(() => {
      raf(() => {
        enableTransition.value = true
        indicatorIndex.value = targetIndex
      })
    })
  } else {
    // 无有效来源（刷新/直开）：直接落位，仅打开过渡开关
    indicatorIndex.value = targetIndex
    nextTick(() => {
      raf(() => {
        enableTransition.value = true
      })
    })
  }
}

onMounted(() => {
  playEnterAnimation()
  hasMounted = true
})

// 保活后再次切回本页（onMounted 不再触发）：重播来源 → 本页滑动。
// 首次 onShow 早于 onMounted，此时 hasMounted 为 false、跳过（交给 onMounted）避免重复。
onShow(() => {
  if (hasMounted) playEnterAnimation()
})
</script>

<style scoped>
/* 小程序端 Tailwind 关 preflight（无全局 box-sizing:border-box），默认 content-box：
   track 的 height:100% + padding:8px 会把实际总高撑到 80px，溢出被 shell 的
   overflow:hidden 从底部裁掉 → 条内整体偏下。显式 border-box 让 height 含 padding，
   与 H5（有 preflight）对齐。 */
.tabbar-shell,
.tab-bar-track {
  box-sizing: border-box;
}

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
