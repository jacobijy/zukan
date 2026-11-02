<template>
    <view class="archive-row" @click="emit('select')">
        <RankBadge :rank="rank" />

        <EncryptedSprite
            v-if="speciesId"
            :pokemon-id="speciesId"
            variant="front"
            :preview="false"
            eager
            img-class="h-10 w-10"
            skeleton-class="h-10 w-10"
        />
        <view v-else class="rank-neutral h-10 w-10"></view>

        <view class="archive-row__main">
            <view class="flex items-baseline gap-1.5 overflow-hidden">
                <text class="archive-row__title">{{ name }}</text>
                <text v-if="form" class="rank-form flex-shrink-0">{{ form }}</text>
            </view>
        </view>

        <!-- #ifdef MP-WEIXIN -->
        <text class="ic rank-chevron text-[16px]">{{ glyph('chevron-right') }}</text>
        <!-- #endif -->
        <!-- #ifndef MP-WEIXIN -->
        <svg data-ic="chevron-right" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" class="rank-chevron h-4 w-4">
            <path d="m9 18 6-6-6-6"></path>
        </svg>
        <!-- #endif -->
    </view>
</template>

<script lang="ts" setup>
import { glyph } from '@/components/icon/glyphs';
import EncryptedSprite from '@/components/sprite/EncryptedSprite.vue';
import RankBadge from './RankBadge.vue';

defineProps<{
    rank: number;
    name: string;
    form?: string;
    speciesId?: number;
}>();
const emit = defineEmits<{ select: [] }>();
</script>

<style lang="scss" scoped>
.rank-neutral {
    flex-shrink: 0;
    border-radius: 10px;
    background: linear-gradient(180deg, #f2f4f8, #e7ebf2);
}

.rank-form {
    overflow: hidden;
    font-size: 11px;
    font-weight: 700;
    color: #9aa0ab;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.rank-chevron {
    flex-shrink:0;
    color: #c4c7cf;
}
</style>
