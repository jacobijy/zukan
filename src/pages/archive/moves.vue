<template>
    <ArchiveListShell
        :title="t('archive.movesTitle')"
        fallback-url="/pages/data/data"
        :loading="loading"
        :empty="!loading && filtered.length === 0"
        :empty-title="t('archive.emptyTitle')"
        :empty-desc="t('archive.emptyDesc')"
        :items="filtered"
        :item-key="moveKey"
    >
        <template #tools>
            <SearchBar v-model="keyword" :placeholder="t('archive.searchMoves')" />
        </template>

        <template #default="{ item }">
            <MoveRow :move="item" @select="goDetail(item.id)" />
        </template>
    </ArchiveListShell>
</template>

<script lang="ts" setup>
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { onLoad } from '@dcloudio/uni-app';
import ArchiveListShell from '@/components/archive/ArchiveListShell.vue';
import SearchBar from '@/components/shared/SearchBar.vue';
import MoveRow from '@/components/archive/MoveRow.vue';
import { loadMoveList, type MoveListRow } from '@/services/pokemon/archive';
import { useI18nStore } from '@/store/i18n';

const { t } = useI18n();
const i18nStore = useI18nStore();

const allMoves = ref<MoveListRow[]>([]);
const keyword = ref('');
const loading = ref(true);

onLoad(async () => {
    // 名称表先行（行内名称响应式查表，未就绪也能先渲染占位名）
    void i18nStore.ensureLoaded();
    try {
        allMoves.value = await loadMoveList();
    } catch (err) {
        console.warn('[archive] 招式列表加载失败', err);
    } finally {
        loading.value = false;
    }
});

const filtered = computed(() => {
    const kw = keyword.value.trim().toLowerCase();
    if (!kw) return allMoves.value;
    return allMoves.value.filter((m) => {
        const name = i18nStore.moveName(m.id) ?? '';
        return name.toLowerCase().includes(kw);
    });
});

const moveKey = (m: MoveListRow) => m.id;

const goDetail = (id: number) => {
    uni.navigateTo({ url: `/pages/archive/move-detail?id=${id}` });
};
</script>
