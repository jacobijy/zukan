<template>
    <view class="template-list-row">
        <view class="template-list-row__main" @click="emit('select')">
            <!-- 精灵图：本地草稿直接渲染；云端未载入时用占位图标 -->
            <EncryptedSprite
                v-if="record.payload"
                :pokemon-id="record.payload.pokemon_id"
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
                    <text class="template-list-row__badge" :class="badgeClass">{{ badgeText }}</text>
                </view>
                <text class="template-list-row__time">{{ updatedText }}</text>
            </view>
            <!-- #ifdef MP-WEIXIN -->
            <text class="ic template-list-row__chevron text-[16px]">{{ glyph('chevron-right') }}</text>
            <!-- #endif -->
            <!-- #ifndef MP-WEIXIN -->
            <svg data-ic="chevron-right" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" class="template-list-row__chevron h-4 w-4">
                <path d="m9 18 6-6-6-6"></path>
            </svg>
            <!-- #endif -->
        </view>
        <view class="template-list-row__menu" @click.stop="emit('menu')">
            <!-- #ifdef MP-WEIXIN -->
            <text class="ic text-[20px]">{{ glyph('more-vertical') }}</text>
            <!-- #endif -->
            <!-- #ifndef MP-WEIXIN -->
            <svg data-ic="more-vertical" viewBox="0 0 24 24" fill="currentColor" class="h-5 w-5">
                <circle cx="12" cy="5" r="1.8"></circle>
                <circle cx="12" cy="12" r="1.8"></circle>
                <circle cx="12" cy="19" r="1.8"></circle>
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

const props = defineProps<{ record: TemplateRecord }>();
const emit = defineEmits<{
    select: [];
    menu: [];
}>();

const { t } = useI18n();
const pokemonStore = usePokemonStore();

const speciesModel = computed(() =>
    props.record.payload ? pokemonStore.getById(props.record.payload.pokemon_id) : undefined,
);

const BADGE: Record<TemplateRecord['sync'], { text: string; cls: string }> = {
    local: { text: '', cls: 'template-list-row__badge--local' },
    dirty: { text: '', cls: 'template-list-row__badge--dirty' },
    synced: { text: '', cls: 'template-list-row__badge--synced' },
    deleted: { text: '', cls: 'template-list-row__badge--local' },
};

const badgeText = computed(() => {
    if (props.record.sync === 'local') return t('templates.stateLocal');
    if (props.record.sync === 'dirty') return t('templates.stateDirty');
    if (props.record.sync === 'synced') return t('templates.stateSynced');
    return t('templates.stateDeleted');
});
const badgeClass = computed(() => BADGE[props.record.sync]?.cls ?? BADGE.local.cls);

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

.template-list-row__badge--dirty {
    background: #fdf3e0;
    color: #d89a1e;
}

.template-list-row__badge--synced {
    background: #e6f5eb;
    color: #3ba55d;
}

.template-list-row__time {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 11px;
    font-weight: 700;
    color: #9aa0ab;
}

.template-list-row__chevron {
    flex-shrink: 0;
    color: #c4c7cf;
}

.template-list-row__menu {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    color: #b0b5bf;

    &:active {
        color: #6f7682;
    }
}
</style>
