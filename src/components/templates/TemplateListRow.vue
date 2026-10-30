<template>
    <view class="template-list-row">
        <view
            v-if="selecting"
            class="template-list-row__check"
            :class="{ 'template-list-row__check--on': selected }"
            @click.stop="emit('toggleSelect')"
        >
            <!-- #ifdef MP-WEIXIN -->
            <text v-if="selected" class="ic text-[14px]">{{ glyph('check') }}</text>
            <!-- #endif -->
            <!-- #ifndef MP-WEIXIN -->
            <svg v-if="selected" data-ic="check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" class="h-3.5 w-3.5">
                <path d="m5 12.5 4.5 4.5L19 7.5"></path>
            </svg>
            <!-- #endif -->
        </view>
        <view class="template-list-row__main" @click="emit('select')">
            <!-- 精灵图：本地草稿 / 已预取的云端摘要直接渲染；未载入时用占位图标 -->
            <EncryptedSprite
                v-if="displayPayload"
                :pokemon-id="displayPayload.pokemon_id"
                variant="front"
                :preview="false"
                :has-sprite="speciesModel?.hasSprite"
                img-class="h-10 w-10"
                skeleton-class="h-10 w-10"
            />
            <view v-else class="template-list-row__icon">
                <!-- #ifdef MP-WEIXIN -->
                <text class="ic text-[20px]">{{ glyph('bookmark') }}</text>
                <!-- #endif -->
                <!-- #ifndef MP-WEIXIN -->
                <svg data-ic="bookmark" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5">
                    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
                </svg>
                <!-- #endif -->
            </view>
            <view class="template-list-row__text">
                <view class="template-list-row__name-row">
                    <text class="template-list-row__name">{{ record.name }}</text>
                    <text v-if="isLocalDraft" class="template-list-row__badge template-list-row__badge--local">{{ t('templates.stateLocal') }}</text>
                </view>
                <view class="template-list-row__meta">
                    <text v-if="speciesName" class="template-list-row__species">{{ speciesName }}</text>
                    <text v-if="formLabel" class="template-list-row__form">{{ formLabel }}</text>
                    <text v-if="speciesName" class="template-list-row__dot">·</text>
                    <text class="template-list-row__time">{{ updatedText }}</text>
                </view>
            </view>
            <!-- #ifdef MP-WEIXIN -->
            <text v-if="!selecting" class="ic template-list-row__chevron text-[16px]">{{ glyph('chevron-right') }}</text>
            <!-- #endif -->
            <!-- #ifndef MP-WEIXIN -->
            <svg v-if="!selecting" data-ic="chevron-right" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" class="template-list-row__chevron h-4 w-4">
                <path d="m9 18 6-6-6-6"></path>
            </svg>
            <!-- #endif -->
        </view>
    </view>
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import EncryptedSprite from '@/components/sprite/EncryptedSprite.vue';
import { usePokemonStore } from '@/store/pokemon';
import { glyph } from '@/components/icon/glyphs';
import type { TemplateRecord } from '@/store/templates';
import type { TemplatePayload } from '@/services/templates/template-model';

const props = withDefaults(
    defineProps<{
        record: TemplateRecord;
        /** 云端缩略预览；本地草稿直接用 record.payload */
        preview?: TemplatePayload | null;
        /** 管理态：行前显示勾选圈 */
        selecting?: boolean;
        selected?: boolean;
    }>(),
    { preview: null, selecting: false, selected: false },
);
const emit = defineEmits<{
    select: [];
    toggleSelect: [];
}>();

const { t } = useI18n();
const pokemonStore = usePokemonStore();

const displayPayload = computed(() => props.record.payload ?? props.preview ?? null);

const speciesModel = computed(() =>
    displayPayload.value ? pokemonStore.getById(displayPayload.value.pokemon_id) : undefined,
);

const speciesName = computed(() => {
    const payload = displayPayload.value;
    if (!payload) return '';
    return speciesModel.value?.name ?? `#${payload.pokemon_id}`;
});

const formLabel = computed(() => speciesModel.value?.formLabel ?? '');

/** 仅本地草稿显示「草稿」徽章；云端记录不显示同步状态。 */
const isLocalDraft = computed(() => props.record.sync === 'local');

// RFC3339/UTC → 紧凑展示（YYYY-MM-DD HH:mm，UTC）
const updatedText = computed(() => props.record.updatedAt.replace('T', ' ').slice(0, 16) + ' UTC');
</script>

<style lang="scss" scoped>
.template-list-row {
    display: flex;
    align-items: stretch;
    box-sizing: border-box;
    height: 68px;
    padding: 0 6px 0 14px;
}

.template-list-row__main {
    display: flex;
    flex: 1;
    align-items: center;
    gap: 12px;
    min-width: 0;
}

.template-list-row__icon {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border-radius: 12px;
    background: linear-gradient(135deg, #ffb45e, #e07b2f);
    color: #ffffff;
}

.template-list-row__text {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 3px;
    min-width: 0;
}

.template-list-row__name-row {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
}

.template-list-row__name {
    overflow: hidden;
    font-size: 15px;
    font-weight: 800;
    color: #24262b;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.template-list-row__badge {
    flex-shrink: 0;
    padding: 2px 7px;
    border-radius: 999px;
    font-size: 10px;
    font-weight: 800;
}

.template-list-row__badge--local {
    background: #f0f1f4;
    color: #9aa0ab;
}

.template-list-row__meta {
    display: flex;
    align-items: baseline;
    gap: 4px;
    min-width: 0;
}

.template-list-row__species {
    overflow: hidden;
    flex-shrink: 1;
    min-width: 0;
    font-size: 12px;
    font-weight: 700;
    color: #6f7682;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.template-list-row__form {
    flex-shrink: 0;
    font-size: 11px;
    font-weight: 700;
    color: #9aa0ab;
    white-space: nowrap;
}

.template-list-row__dot {
    flex-shrink: 0;
    font-size: 11px;
    color: #c4c7cf;
}

.template-list-row__time {
    flex-shrink: 0;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 11px;
    font-weight: 700;
    color: #9aa0ab;
}

.template-list-row__chevron {
    flex-shrink: 0;
    color: #c4c7cf;
}

.template-list-row__check {
    display: flex;
    flex-shrink: 0;
    align-self: center;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    margin-right: 10px;
    border-radius: 999px;
    border: 1.8px solid #c9ced8;
    color: #ffffff;
    background: #ffffff;

    &:active {
        transform: scale(0.88);
    }
}

.template-list-row__check--on {
    border-color: transparent;
    background: linear-gradient(135deg, #ff8a7e, #e04f47);
}
</style>
