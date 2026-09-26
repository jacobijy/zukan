<template>
    <view class="archive-row" @click="emit('select')">
        <text class="rank-num" :class="{ 'rank-num--top': rank <= 3 }">{{ String(rank).padStart(2, '0') }}</text>

        <EncryptedSprite
            v-if="speciesId"
            :pokemon-id="speciesId"
            variant="front"
            :preview="false"
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

        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" class="rank-chevron h-4 w-4">
            <path d="m9 18 6-6-6-6"></path>
        </svg>
    </view>
</template>

<script lang="ts" setup>
import EncryptedSprite from '@/components/sprite/EncryptedSprite.vue';

defineProps<{
    rank: number;
    name: string;
    form?: string;
    speciesId?: number;
}>();
const emit = defineEmits<{ select: [] }>();
</script>

<style lang="scss" scoped>
.rank-num {
    width: 24px;
    flex-shrink: 0;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 13px;
    font-weight: 800;
    color: #b6bac3;
    text-align: center;
    font-variant-numeric: tabular-nums;
}

.rank-num--top {
    color: #e0a923;
    font-weight: 900;
}

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
