<template>
  <view class="archive-section mb-3 px-2 py-4">
    <view class="mb-3 flex items-center justify-between gap-3">
      <text class="text-lg font-black tracking-[-0.03em] text-[#24262b]">{{ t('stats.title') }}</text>
      <text class="rounded-full border border-[#e1e4eb] bg-[#f5f6fa] px-3 py-1 text-[10px] font-black tracking-[0.14em] text-[#8d929c]">STATS</text>
    </view>
    <view class="grid gap-2.5">
      <view v-for="stat in normalizedStats" :key="stat.name" class="stat-row">
        <text class="stat-row__name">{{ stat.name }}</text>
        <view class="stat-row__bar">
          <view class="stat-row__fill" :style="{ width: `${Math.min(stat.value, 160) / 160 * 100}%`, background: stat.color }"></view>
        </view>
        <text class="stat-row__value">{{ stat.value }}</text>
      </view>
    </view>
  </view>
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

const props = defineProps<{
  stats?: Array<{ name: string; value: number }>;
}>();

// 与 pokemon.ts 输出顺序固定对应：HP / 攻击 / 防御 / 特攻 / 特防 / 速度
// 配色沿用官方种族值雷达色谱：HP 红、攻击橙、防御金、特攻蓝、特防绿、速度粉。
const STAT_COLORS = [
  'linear-gradient(90deg, #ff7a7a, #ef4444)',
  'linear-gradient(90deg, #fbbf7a, #f08a2b)',
  'linear-gradient(90deg, #f6d365, #e0a923)',
  'linear-gradient(90deg, #8ab4f8, #3b7df4)',
  'linear-gradient(90deg, #86de7a, #4cb44a)',
  'linear-gradient(90deg, #f58ec2, #e84f9a)',
] as const;

const normalizedStats = computed(() => {
  const base = props.stats?.length ? props.stats : [
    { name: t('stats.hp'), value: 0 },
    { name: t('stats.attack'), value: 0 },
    { name: t('stats.defense'), value: 0 },
    { name: t('stats.spAttack'), value: 0 },
    { name: t('stats.spDefense'), value: 0 },
    { name: t('stats.speed'), value: 0 }
  ];
  return base.map((s, i) => ({ ...s, color: STAT_COLORS[i] ?? STAT_COLORS[0] }));
});
</script>

<style scoped>
.stat-row {
  display: grid;
  grid-template-columns: 2.4em 1fr 2.4em;
  align-items: center;
  column-gap: 12px;
}

.stat-row__name {
  font-size: 16px;
  font-weight: 900;
  letter-spacing: 0.02em;
  text-align: left;
  white-space: nowrap;
  color: #6f7682;
}

.stat-row__bar {
  height: 10px;
  overflow: hidden;
  border-radius: 999px;
  background: #e5e7ee;
}

.stat-row__fill {
  height: 100%;
  border-radius: inherit;
  transition: width 0.4s ease;
}

.stat-row__value {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 16px;
  font-weight: 900;
  font-variant-numeric: tabular-nums;
  text-align: right;
  color: #24262b;
}
</style>
