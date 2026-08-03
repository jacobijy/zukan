<template>
  <view class="archive-section mb-3 p-4">
    <view class="mb-3 flex items-center justify-between gap-3">
      <text class="text-lg font-black tracking-[-0.03em] text-[#24262b]">能力值</text>
      <text class="rounded-full border border-[#e1e4eb] bg-[#f5f6fa] px-3 py-1 text-[10px] font-black tracking-[0.14em] text-[#8d929c]">STATS</text>
    </view>
    <view class="grid gap-2">
      <view v-for="stat in normalizedStats" :key="stat.name" class="stat-row">
        <view class="flex items-center justify-between gap-3">
          <text class="text-xs font-black tracking-[0.1em] text-[#6f7682]">{{ stat.name }}</text>
          <text class="font-mono text-sm font-black text-[#24262b]">{{ stat.value }}</text>
        </view>
        <view class="stat-row__bar">
          <view class="stat-row__fill" :style="{ width: `${Math.min(stat.value, 160) / 160 * 100}%` }"></view>
        </view>
      </view>
    </view>
  </view>
</template>

<script lang="ts" setup>
import { computed } from 'vue';

const props = defineProps<{
  stats?: Array<{ name: string; value: number }>;
}>();

const normalizedStats = computed(() => props.stats?.length ? props.stats : [
  { name: 'HP', value: 0 },
  { name: '攻击', value: 0 },
  { name: '防御', value: 0 },
  { name: '特攻', value: 0 },
  { name: '特防', value: 0 },
  { name: '速度', value: 0 }
]);
</script>

<style scoped>
.stat-row {
  padding: 10px;
  border: 1px solid #e5e7ee;
  border-radius: 18px;
  background: #f5f6fa;
}

.stat-row__bar {
  height: 8px;
  margin-top: 8px;
  overflow: hidden;
  border-radius: 999px;
  background: #e5e7ee;
}

.stat-row__fill {
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #73b7ff, #357df4);
  box-shadow: 0 0 14px rgba(53, 125, 244, 0.22);
}
</style>
