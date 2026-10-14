<template>
    <view class="mini-row" :class="{ 'mini-row--last': last }" @click="goDetail">
        <text class="mini-row__id">{{ padId(speciesId) }}</text>
        <view class="mini-row__main">
            <EncryptedSprite
                :pokemon-id="speciesId"
                variant="front"
                :preview="false"
                img-class="h-10 w-10"
                skeleton-class="h-10 w-10"
            />
            <text class="mini-row__name">{{ name }}</text>
            <!-- #ifdef MP-WEIXIN -->
            <text class="ic mini-row__chevron">{{ glyph('chevron-right') }}</text>
            <!-- #endif -->
            <!-- #ifndef MP-WEIXIN -->
            <svg
                data-ic="chevron-right"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2.6"
                stroke-linecap="round"
                stroke-linejoin="round"
                class="mini-row__chevron h-4 w-4"
            >
                <path d="m9 18 6-6-6-6"></path>
            </svg>
            <!-- #endif -->
        </view>
    </view>
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import EncryptedSprite from '@/components/sprite/EncryptedSprite.vue';
import { glyph } from '@/components/icon/glyphs';
import { useI18nStore } from '@/store/i18n';
import { padId } from '@/utils/helpers';

const props = defineProps<{
    speciesId: number;
    last?: boolean;
}>();

const i18nStore = useI18nStore();

// 物种名按 species id 响应式查内容名称表；未就绪回落编号占位
const name = computed(() => i18nStore.speciesName(props.speciesId) ?? `pokemon-${props.speciesId}`);

const goDetail = () => {
    // 详情页按 form id 寻址；默认形态 id == speciesId（1..1025 默认形态）
    uni.navigateTo({ url: `/pages/detail/detail?id=${props.speciesId}` });
};
</script>

<style lang="scss" scoped>
.mini-row {
    position: relative;
    display: flex;
    align-items: center;
    min-height: 64px;
    padding-left: 14px;
    transition:
        background-color 0.18s ease,
        transform 0.18s ease;
}

.mini-row:active {
    background: rgba(241, 243, 248, 0.82);
    transform: scale(0.992);
}

/* 分隔线画在整行上：编号不再悬在线外，线界定的是整行而非 icon 槽 */
.mini-row::after {
    position: absolute;
    right: 12px;
    bottom: 0;
    left: 14px;
    height: 1px;
    content: '';
    background: rgba(222, 225, 232, 0.86);
}

.mini-row--last::after {
    display: none;
}

.mini-row__id {
    flex-shrink: 0;
    width: 36px;
    font-family:
        ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 12px;
    font-weight: 800;
    color: #9da2ad;
}

.mini-row__main {
    display: flex;
    flex: 1;
    align-items: center;
    min-width: 0;
    min-height: 64px;
    margin-left: 10px;
    padding-right: 12px;
}

.mini-row__name {
    flex: 1;
    min-width: 0;
    margin-left: 12px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 16px;
    font-weight: 600;
    letter-spacing: -0.01em;
    color: #24262b;
}

.mini-row__chevron {
    flex-shrink: 0;
    margin-left: 10px;
    color: #c4c7cf;
    font-size: 16px;
}
</style>
