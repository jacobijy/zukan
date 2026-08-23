<template>
  <view class="archive-section mb-3 p-4">
    <view class="mb-3 flex items-center justify-between gap-3">
      <text class="text-lg font-black tracking-[-0.03em] text-[#24262b]">{{ t('evolution.title') }}</text>
      <text class="rounded-full border border-[#e1e4eb] bg-[#f5f6fa] px-3 py-1 text-[10px] font-black tracking-[0.14em] text-[#8d929c]">EVOLVE</text>
    </view>

    <view v-if="loading" class="flex items-center gap-2 py-4">
      <text class="text-sm font-semibold text-[#8d929c]">{{ t('evolution.loading') }}</text>
    </view>

    <!--
      等比缩放铺满容器：inner 按自然尺寸（不换行）渲染整棵树，
      measure() 测其自然宽高与容器可用宽，算 scale 后 transform 缩放，
      外层高度同步成「自然高 × scale」，避免 transform 不占布局导致塌陷。
    -->
    <view v-else-if="chain" ref="frameRef" class="evolution-fit">
      <view ref="innerRef" class="evolution-fit__inner" :style="innerStyle">
        <EvolutionNode :stage="chain" @select="openPokemon" />
      </view>
    </view>

    <view v-else class="py-3">
      <text class="text-sm font-semibold text-[#8d929c]">{{ t('evolution.empty') }}</text>
    </view>
  </view>
</template>

<script lang="ts" setup>
import EvolutionNode from '@/components/pokemon/EvolutionNode.vue';
import { useI18n } from 'vue-i18n';
import { nextTick, onMounted, onBeforeUnmount, ref, watch } from 'vue';

const { t } = useI18n();

const props = defineProps<{
  /** 进化链根节点；null 表示已加载但无数据；undefined 表示加载中 */
  chain?: EvolutionStage | null;
  loading?: boolean;
}>();

const frameRef = ref<unknown>(null);
const innerRef = ref<unknown>(null);
const scale = ref(1);
const frameHeight = ref('auto');

const innerStyle = ref<Record<string, string>>({});

/** uni-app 的 `view` 在 H5 下是组件包装，需取 $el */
function toEl(raw: unknown): HTMLElement | null {
  if (!raw) return null;
  if (raw instanceof HTMLElement) return raw;
  const el = (raw as { $el?: unknown }).$el;
  return el instanceof HTMLElement ? el : null;
}

function measure(): void {
  const inner = toEl(innerRef.value);
  const frame = toEl(frameRef.value);
  if (!inner || !frame) return;

  const naturalW = inner.scrollWidth;
  const naturalH = inner.scrollHeight;
  const availableW = frame.clientWidth;
  if (!naturalW || !naturalH || !availableW) return;

  const s = Math.min(1, availableW / naturalW);
  scale.value = s;
  frameHeight.value = `${Math.round(naturalH * s)}px`;
  innerStyle.value = {
    transform: `scale(${s})`,
    // 左上为锚点缩放，配合 absolute top/left 贴住容器
    transformOrigin: 'top left',
  };
}

let resizeObserver: ResizeObserver | null = null;

onMounted(async () => {
  await nextTick();
  measure();
  await nextTick();
  measure();

  const frame = toEl(frameRef.value);
  if (frame && typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => measure());
    resizeObserver.observe(frame);
  }
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  resizeObserver = null;
});

// 链数据变化（切物种）后重新测量自然尺寸
watch(
  () => props.chain,
  async () => {
    await nextTick();
    measure();
  },
);

function openPokemon(id: number) {
  uni.navigateTo({ url: `/pages/detail/detail?id=${id}` });
}
</script>

<style scoped>
.evolution-fit {
  position: relative;
  width: 100%;
  overflow: hidden;
  height: v-bind(frameHeight);
}

.evolution-fit__inner {
  position: absolute;
  top: 0;
  left: 0;
  display: inline-block;
  width: max-content;
  /* 基线缩放为 1，实际值由 innerStyle 写入 */
  transform: scale(1);
  transform-origin: top left;
  will-change: transform;
}
</style>
