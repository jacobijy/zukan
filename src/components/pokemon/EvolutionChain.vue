<template>
  <view class="archive-section mb-3 p-4">
    <view class="mb-3 flex items-center justify-between gap-3">
      <text class="text-lg font-black tracking-[-0.03em] text-[#24262b]">进化链</text>
      <text class="rounded-full border border-[#e1e4eb] bg-[#f5f6fa] px-3 py-1 text-[10px] font-black tracking-[0.14em] text-[#8d929c]">EVOLVE</text>
    </view>
    <view class="flex items-center gap-2 overflow-x-auto pb-1">
      <template v-for="(stage, index) in normalizedChain" :key="index">
        <view class="evolution-node">
          <view class="evolution-node__image">
            <EncryptedSprite
              v-if="stage.id"
              :pokemon-id="stage.id"
              variant="default"
              img-class="h-14 w-14"
              skeleton-class="h-14 w-14"
            />
            <image v-else :src="stage.imageUrl" mode="aspectFit" class="h-14 w-14"></image>
          </view>
          <text class="mt-2 block text-sm font-black text-[#24262b]">{{ stage.name }}</text>
          <text v-if="stage.level" class="mt-0.5 block text-xs font-semibold text-[#8d929c]">Lv.{{ stage.level }}</text>
        </view>
        <svg v-if="index < normalizedChain.length - 1" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5 shrink-0 text-[#9da2ad]">
          <path d="m9 18 6-6-6-6"></path>
        </svg>
      </template>
    </view>
  </view>
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import EncryptedSprite from '@/components/sprite/EncryptedSprite.vue';

type EvolutionStage = {
  name: string;
  imageUrl?: string;
  level?: number;
  id?: number;
};

const props = defineProps<{
  chain?: Array<number | EvolutionStage>;
  evolutionChain?: Array<number | EvolutionStage>;
}>();

const normalizedChain = computed<EvolutionStage[]>(() => {
  const chain = props.chain ?? props.evolutionChain ?? [];
  if (!chain.length) {
    return [{ name: '暂无记录', imageUrl: '/static/default.png' }];
  }

  return chain.map((stage) => {
    if (typeof stage === 'number') {
      return {
        id: stage,
        name: `NO.${String(stage).padStart(3, '0')}`,
      };
    }
    return stage;
  });
});
</script>

<style scoped>
.archive-section {
  border: 1px solid #e5e7ee;
  border-radius: 28px;
  background: #ffffff;
  box-shadow: 0 14px 34px rgba(48, 55, 72, 0.08);
}

.evolution-node {
  flex: 1 0 92px;
  min-width: 92px;
  padding: 12px;
  text-align: center;
  border: 1px solid #e5e7ee;
  border-radius: 22px;
  background: #f5f6fa;
}

.evolution-node__image {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 70px;
  height: 70px;
  margin: 0 auto;
  border: 1px solid #e5e7ee;
  border-radius: 22px;
  background: #ffffff;
  box-shadow: inset 0 1px 0 #ffffff, 0 10px 18px rgba(48, 55, 72, 0.08);
}
</style>
