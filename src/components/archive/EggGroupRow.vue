<template>
    <view class="archive-row" @click="emit('select')">
        <!-- 蛋组无配色体系，统一用中性紫胶囊（尺寸对齐 TypeBadge xl pill） -->
        <view class="egg-pill">
            <text class="egg-pill__text">{{ name }}</text>
        </view>
        <view class="archive-row__main"></view>
        <text class="archive-row__meta">{{ interp('archive.pokemonCount', { n: count }) }}</text>
        <!-- #ifdef MP-WEIXIN -->
        <text class="ic archive-row__chevron text-[16px]">{{ glyph('chevron-right') }}</text>
        <!-- #endif -->
        <!-- #ifndef MP-WEIXIN -->
        <svg data-ic="chevron-right" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" class="archive-row__chevron">
            <path d="m9 18 6-6-6-6"></path>
        </svg>
        <!-- #endif -->
    </view>
</template>

<script lang="ts" setup>
import { glyph } from '@/components/icon/glyphs';
import { interp } from '@/services/i18n/ui-i18n';
import { getEggGroupMeta } from '@/constants/eggGroups';
import { useI18nStore } from '@/store/i18n';
import { computed } from 'vue';

const props = defineProps<{
    /** PokeAPI 蛋组 id（1..15） */
    id: number;
    count: number;
}>();

const emit = defineEmits<{ select: [] }>();

const i18nStore = useI18nStore();

// 内容名走 PKNM 蛋组表（随内容语言切换）；未就绪回落常量中文名
const name = computed(() => i18nStore.eggGroupName(props.id) ?? getEggGroupMeta(props.id)?.name ?? String(props.id));
</script>

<style scoped>
.egg-pill {
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 76px;
    padding: 10px 20px;
    border-radius: 999px;
    background: linear-gradient(135deg, #f0eaff 0%, #ddd1fe 60%, #c9b8f8 100%);
    box-shadow: 0 8px 16px rgba(90, 62, 192, 0.16);
}

.egg-pill__text {
    font-size: 16px;
    font-weight: 900;
    letter-spacing: 0.04em;
    color: #4a32a0;
    white-space: nowrap;
}
</style>
