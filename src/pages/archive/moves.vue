<template>
    <view>
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
                <view class="mt-2 flex gap-2">
                    <FilterChipButton
                        :label="categoryLabel"
                        :active="categoryId !== 0"
                        @click="categorySheetOpen = true"
                    />
                    <FilterChipButton
                        :label="typeLabel"
                        :active="typeSlug !== ''"
                        :dot-color="typeSlug ? getTypeColor(typeSlug) : undefined"
                        @click="typeSheetOpen = true"
                    />
                </view>
            </template>

            <template #default="{ item }">
                <MoveRow :move="item" @select="goDetail(item.id)" />
            </template>
        </ArchiveListShell>

        <OptionSheet
            v-model:visible="categorySheetOpen"
            :title="t('archive.filterCategory')"
            :options="categoryOptions"
            :model-value="String(categoryId)"
            @update:model-value="onCategoryChange"
        />
        <OptionSheet
            v-model:visible="typeSheetOpen"
            :title="t('archive.filterType')"
            :options="typeOptions"
            :model-value="typeSlug || 'all'"
            @update:model-value="onTypeChange"
        />
    </view>
</template>

<script lang="ts" setup>
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { onLoad } from '@dcloudio/uni-app';
import ArchiveListShell from '@/components/archive/ArchiveListShell.vue';
import SearchBar from '@/components/shared/SearchBar.vue';
import FilterChipButton from '@/components/archive/FilterChipButton.vue';
import MoveRow from '@/components/archive/MoveRow.vue';
import OptionSheet, { type SheetOption } from '@/components/shared/OptionSheet.vue';
import { loadMoveList, type MoveListRow } from '@/services/pokemon/archive';
import { useI18nStore } from '@/store/i18n';
import { ALL_TYPE_SLUGS, getTypeColor, getTypeMeta } from '@/constants/pokemonTypes';
import { typeStrs } from '@/utils/helpers';

const { t } = useI18n();
const i18nStore = useI18nStore();

const allMoves = ref<MoveListRow[]>([]);
const keyword = ref('');
const loading = ref(true);

// 筛选状态：分类 0 = 全部；属性 '' = 全部
const categoryId = ref(0);
const typeSlug = ref('');
const categorySheetOpen = ref(false);
const typeSheetOpen = ref(false);

onLoad(async () => {
    // 名称表先行（行内名称/筛选名响应式查表，未就绪也能先渲染）
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
    return allMoves.value.filter((m) => {
        if (categoryId.value !== 0 && m.damageClassId !== categoryId.value) return false;
        if (typeSlug.value && typeStrs[m.typeId] !== typeSlug.value) return false;
        if (kw) {
            const name = i18nStore.moveName(m.id) ?? '';
            if (!name.toLowerCase().includes(kw)) return false;
        }
        return true;
    });
});

const moveKey = (m: MoveListRow) => m.id;

// ── 分类筛选（物理 2 / 特殊 3 / 变化 1）──
const DAMAGE_CLASS_IDS = [2, 3, 1];
const categoryOptions = computed<SheetOption[]>(() => [
    { id: '0', label: t('archive.all') },
    ...DAMAGE_CLASS_IDS.map((id) => ({
        id: String(id),
        label: i18nStore.moveDamageClassName(id) ?? `class-${id}`,
    })),
]);
const categoryLabel = computed(() =>
    categoryId.value
        ? (i18nStore.moveDamageClassName(categoryId.value) ?? t('archive.filterCategory'))
        : t('archive.filterCategory'),
);
const onCategoryChange = (value: string | string[]) => {
    categoryId.value = Number(value);
};

// ── 属性筛选（18 个标准属性）──
const typeOptions = computed<SheetOption[]>(() => [
    { id: 'all', label: t('archive.all') },
    ...ALL_TYPE_SLUGS.map((slug) => ({
        id: slug,
        label: i18nStore.typeName(slug) ?? getTypeMeta(slug).name,
    })),
]);
const typeLabel = computed(() =>
    typeSlug.value
        ? (i18nStore.typeName(typeSlug.value) ?? getTypeMeta(typeSlug.value).name)
        : t('archive.filterType'),
);
const onTypeChange = (value: string | string[]) => {
    typeSlug.value = value === 'all' ? '' : String(value);
};

const goDetail = (id: number) => {
    uni.navigateTo({ url: `/pages/archive/move-detail?id=${id}` });
};
</script>
