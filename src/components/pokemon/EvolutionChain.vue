<template>
  <view class="archive-section mb-3 p-4">
    <view class="mb-3 flex items-center justify-between gap-3">
      <text class="text-lg font-black tracking-[-0.03em] text-[#24262b]">{{ t('evolution.title') }}</text>
      <text class="rounded-full border border-[#e1e4eb] bg-[#f5f6fa] px-3 py-1 text-[10px] font-black tracking-[0.14em] text-[#8d929c]">EVOLVE</text>
    </view>

    <view v-if="loading" class="flex items-center gap-2 py-4">
      <text class="text-sm font-semibold text-[#8d929c]">{{ t('evolution.loading') }}</text>
    </view>

    <scroll-view v-else-if="chain" scroll-x class="pb-1">
      <EvolutionNode :stage="chain" @select="openPokemon" class="min-w-max" />
    </scroll-view>

    <view v-else class="py-3">
      <text class="text-sm font-semibold text-[#8d929c]">{{ t('evolution.empty') }}</text>
    </view>
  </view>
</template>

<script lang="ts" setup>
import EvolutionNode from '@/components/pokemon/EvolutionNode.vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

defineProps<{
  /** 进化链根节点；null 表示已加载但无数据；undefined 表示加载中 */
  chain?: EvolutionStage | null;
  loading?: boolean;
}>();

function openPokemon(id: number) {
  uni.navigateTo({ url: `/pages/detail/detail?id=${id}` });
}
</script>
