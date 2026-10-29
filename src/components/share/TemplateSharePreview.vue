<template>
    <!--
        模板分享缩略卡：模板名 + 立绘 / 物种（形态）/ 规则 / 性格 / 道具 + 招式名。
        纯展示：名称全部走 i18n bundle 的本地 Map 解析，立绘走加密图片通道，不发额外请求。
    -->
    <view class="tpl-preview">
        <text class="tpl-preview__name">{{ name }}</text>

        <view class="tpl-preview__main">
            <EncryptedSprite
                :pokemon-id="payload.pokemon_id"
                variant="front"
                :preview="false"
                :has-sprite="speciesModel?.hasSprite"
                img-class="h-14 w-14"
                skeleton-class="h-14 w-14"
            />
            <view class="tpl-preview__info">
                <view class="tpl-preview__title-row">
                    <text class="tpl-preview__species">{{ speciesName }}</text>
                    <text v-if="formLabel" class="tpl-preview__form">{{ formLabel }}</text>
                </view>
                <view class="tpl-preview__tags">
                    <text class="tpl-preview__ruleset">
                        {{ payload.ruleset === 'champions' ? t('templates.rulesetChampions') : t('templates.rulesetStandard') }}
                    </text>
                    <text v-if="natureText" class="tpl-preview__nature">{{ natureText }}</text>
                </view>
                <text v-if="itemText" class="tpl-preview__item">{{ itemLabel }}</text>
            </view>
        </view>

        <view class="tpl-preview__moves">
            <text class="tpl-preview__moves-count">{{ t('templates.fieldMoves') }} {{ payload.moves.length }}/4</text>
            <text class="tpl-preview__moves-text">{{ movesText }}</text>
        </view>
    </view>
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import EncryptedSprite from '@/components/sprite/EncryptedSprite.vue';
import { useI18nStore } from '@/store/i18n';
import { usePokemonStore } from '@/store/pokemon';
import type { TemplatePayload } from '@/services/templates/template-model';

const props = defineProps<{
    name: string;
    payload: TemplatePayload;
}>();

const { t, locale } = useI18n();
const i18nStore = useI18nStore();
const pokemonStore = usePokemonStore();

const speciesModel = computed(() => pokemonStore.getById(props.payload.pokemon_id));

const speciesName = computed(
    () => speciesModel.value?.name ?? `#${props.payload.pokemon_id}`,
);
const formLabel = computed(() => speciesModel.value?.formLabel ?? '');

const natureText = computed(() => i18nStore.natureName(props.payload.nature) ?? '');
const itemText = computed(() =>
    props.payload.item ? i18nStore.itemName(props.payload.item) ?? '' : '',
);
const itemLabel = computed(() =>
    locale.value.toLowerCase().startsWith('zh')
        ? `${t('templates.fieldItem')}：${itemText.value}`
        : `${t('templates.fieldItem')}: ${itemText.value}`,
);

const movesText = computed(() => {
    if (props.payload.moves.length === 0) return t('templates.none');
    const sep = locale.value.toLowerCase().startsWith('zh') ? '、' : ', ';
    return props.payload.moves.map((id) => i18nStore.moveName(id) ?? `#${id}`).join(sep);
});
</script>

<style lang="scss" scoped>
.tpl-preview {
    flex-shrink: 0;
    padding: 14px 12px 12px;
    border-radius: 16px;
    background: #f6f7fa;
}

.tpl-preview__name {
    display: block;
    overflow: hidden;
    font-size: 15px;
    font-weight: 900;
    color: #24262b;
    text-align: center;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.tpl-preview__main {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 8px;
}

.tpl-preview__info {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 5px;
    min-width: 0;
}

.tpl-preview__title-row {
    display: flex;
    align-items: baseline;
    gap: 6px;
    min-width: 0;
}

.tpl-preview__species {
    overflow: hidden;
    font-size: 14px;
    font-weight: 800;
    color: #24262b;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.tpl-preview__form {
    flex-shrink: 0;
    font-size: 11px;
    font-weight: 700;
    color: #9aa0ab;
}

.tpl-preview__tags {
    display: flex;
    align-items: center;
    gap: 6px;
}

.tpl-preview__ruleset {
    flex-shrink: 0;
    padding: 2px 8px;
    border: 1px solid #dfe3ea;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 800;
    color: #5d6470;
    background: #ffffff;
}

.tpl-preview__nature {
    overflow: hidden;
    font-size: 12px;
    font-weight: 700;
    color: #6f7682;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.tpl-preview__item {
    overflow: hidden;
    font-size: 12px;
    font-weight: 600;
    color: #9aa0ab;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.tpl-preview__moves {
    margin-top: 10px;
    padding-top: 9px;
    border-top: 1px solid #e9ebf0;
}

.tpl-preview__moves-count {
    display: block;
    margin-bottom: 3px;
    font-size: 11px;
    font-weight: 800;
    color: #9aa0ab;
}

/* 限高 2 行截断（不依赖 -webkit-line-clamp，小程序 WXSS 安全） */
.tpl-preview__moves-text {
    display: block;
    overflow: hidden;
    max-height: 2.7em;
    font-size: 12px;
    font-weight: 600;
    line-height: 1.35;
    color: #6f7682;
    overflow-wrap: anywhere;
}
</style>
