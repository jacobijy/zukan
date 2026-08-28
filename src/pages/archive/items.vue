<template>
    <ArchiveListShell
        :title="t('archive.itemsTitle')"
        fallback-url="/pages/data/data"
        :loading="loading"
        :empty="!loading && filteredIds.length === 0"
        :empty-title="t('archive.emptyTitle')"
        :empty-desc="t('archive.emptyDesc')"
        :items="filteredIds"
        :item-key="idKey"
    >
        <template #tools>
            <SearchBar v-model="keyword" :placeholder="t('archive.searchItems')" />
        </template>

        <template #default="{ item: id }">
            <ItemRow :item-id="id" @select="goDetail(id)" />
        </template>
    </ArchiveListShell>
</template>

<script lang="ts" setup>
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { onLoad } from '@dcloudio/uni-app';
import ArchiveListShell from '@/components/archive/ArchiveListShell.vue';
import SearchBar from '@/components/shared/SearchBar.vue';
import ItemRow from '@/components/archive/ItemRow.vue';
import { useI18nStore } from '@/store/i18n';

const { t } = useI18n();
const i18nStore = useI18nStore();

const keyword = ref('');
// 道具无独立数值 bundle：列表范围 = 名称表中有名字的道具 id（全量收录）
const loading = ref(true);

onLoad(async () => {
    try {
        await i18nStore.ensureLoaded();
    } catch (err) {
        console.warn('[archive] 名称组加载失败', err);
    } finally {
        loading.value = false;
    }
});

const allIds = computed(() =>
    i18nStore.ready ? [...(i18nStore.lookup?.items.keys() ?? [])].toSorted((a, b) => a - b) : [],
);

const filteredIds = computed(() => {
    const kw = keyword.value.trim().toLowerCase();
    if (!kw) return allIds.value;
    return allIds.value.filter((id) => (i18nStore.itemName(id) ?? '').toLowerCase().includes(kw));
});

const idKey = (id: number) => id;

const goDetail = (id: number) => {
    uni.navigateTo({ url: `/pages/archive/item-detail?id=${id}` });
};
</script>
