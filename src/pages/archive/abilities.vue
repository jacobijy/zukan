<template>
    <ArchiveListShell
        :title="t('archive.abilitiesTitle')"
        fallback-url="/pages/data/data"
        :loading="loading"
        :empty="!loading && filteredIds.length === 0"
        :empty-title="t('archive.emptyTitle')"
        :empty-desc="t('archive.emptyDesc')"
        :items="filteredIds"
        :item-key="idKey"
    >
        <template #tools>
            <SearchBar v-model="keyword" :placeholder="t('archive.searchAbilities')" />
        </template>

        <template #default="{ item: id }">
            <AbilityRow :ability-id="id" :count="countOf(id)" @select="goDetail(id)" />
        </template>
    </ArchiveListShell>
</template>

<script lang="ts" setup>
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { onLoad } from '@dcloudio/uni-app';
import ArchiveListShell from '@/components/archive/ArchiveListShell.vue';
import SearchBar from '@/components/shared/SearchBar.vue';
import AbilityRow from '@/components/archive/AbilityRow.vue';
import { loadAbilityPokemonIndex } from '@/services/pokemon/archive';
import { useI18nStore } from '@/store/i18n';

const { t } = useI18n();
const i18nStore = useI18nStore();

const index = ref<Map<number, number[]> | null>(null);
const keyword = ref('');
const loading = ref(true);

onLoad(async () => {
    void i18nStore.ensureLoaded();
    try {
        index.value = await loadAbilityPokemonIndex();
    } catch (err) {
        console.warn('[archive] 特性索引加载失败', err);
    } finally {
        loading.value = false;
    }
});

// 列表范围 = 名称表中有名字的特性（名称表随英文基线齐全），按 id 升序
const allIds = computed(() =>
    i18nStore.ready ? [...(i18nStore.lookup?.abilities.keys() ?? [])].toSorted((a, b) => a - b) : [],
);

const filteredIds = computed(() => {
    const kw = keyword.value.trim().toLowerCase();
    if (!kw) return allIds.value;
    return allIds.value.filter((id) => (i18nStore.abilityName(id) ?? '').toLowerCase().includes(kw));
});

const countOf = (id: number) => index.value?.get(id)?.length ?? 0;

const idKey = (id: number) => id;

const goDetail = (id: number) => {
    uni.navigateTo({ url: `/pages/archive/ability-detail?id=${id}` });
};
</script>
