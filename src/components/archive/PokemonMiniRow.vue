<template>
    <ListRow
        :title="name"
        :meta="t('archive.detail')"
        icon-class="list-row__icon--gray"
        :last="last"
        show-chevron
        @click="goDetail"
    >
        <template #icon>
            <text class="pokemon-mark__text">{{ String(speciesId).padStart(3, '0') }}</text>
        </template>
    </ListRow>
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import ListRow from '@/components/shared/ListRow.vue';
import { useI18nStore } from '@/store/i18n';

const props = defineProps<{
    speciesId: number;
    last?: boolean;
}>();

const { t } = useI18n();
const i18nStore = useI18nStore();

// 物种名按 species id 响应式查内容名称表；未就绪回落编号占位
const name = computed(() => i18nStore.speciesName(props.speciesId) ?? `pokemon-${props.speciesId}`);

const goDetail = () => {
    // 详情页按 form id 寻址；默认形态 id == speciesId（1..1025 默认形态）
    uni.navigateTo({ url: `/pages/detail/detail?id=${props.speciesId}` });
};
</script>

<style lang="scss" scoped>
.pokemon-mark__text {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 12px;
    font-weight: 900;
}
</style>
