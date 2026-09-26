<template>
    <ArchiveListShell
        :title="t('meta.title')"
        fallback-url="/pages/data/data"
        :loading="loading"
        :empty="!loading && rows.length === 0"
        :empty-title="t('meta.emptyTitle')"
        :empty-desc="t('meta.emptyDesc')"
        :items="rows"
        :item-key="rowKey"
    >
        <template #tools>
            <FormatSwitch :model-value="format" @update:model-value="onFormatChange" />
            <view class="mt-2">
                <FilterChipButton :label="seasonLabel" :active="false" @click="seasonSheetOpen = true" />
            </view>
        </template>

        <template #default="{ item, index }">
            <UsageRankingRow :item="item" :rank="index + 1" @select="goPokemonMeta(item.speciesId)" />
        </template>
    </ArchiveListShell>

    <OptionSheet
        v-model:visible="seasonSheetOpen"
        :title="t('meta.seasonTitle')"
        :options="seasonOptions"
        :model-value="seasonId"
        @update:model-value="onSeasonPick"
    />
</template>

<script lang="ts" setup>
import { computed, ref } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { useI18n } from 'vue-i18n';
import ArchiveListShell from '@/components/archive/ArchiveListShell.vue';
import FilterChipButton from '@/components/archive/FilterChipButton.vue';
import UsageRankingRow from '@/components/meta/UsageRankingRow.vue';
import FormatSwitch from '@/components/meta/FormatSwitch.vue';
import OptionSheet, { type SheetOption } from '@/components/shared/OptionSheet.vue';
import { useI18nStore } from '@/store/i18n';
import { loadSeasons, loadUsageRanking } from '@/services/meta';
import type { BattleFormat, MetaSeason, UsageRankingItem } from '@/services/meta';

const { t } = useI18n();
const i18nStore = useI18nStore();

const format = ref<BattleFormat>('singles');
const seasons = ref<MetaSeason[]>([]);
const seasonId = ref('');
const rows = ref<UsageRankingItem[]>([]);
const loading = ref(true);
const seasonSheetOpen = ref(false);

onLoad(() => {
    // 名称表先行（行内名称响应式查表），再拉赛季与榜单
    void i18nStore.ensureLoaded();
    void bootstrap();
});

/** 赛制 / 初始进入：拉赛季列表并锁定当前赛季，再拉榜单 */
async function bootstrap(): Promise<void> {
    loading.value = true;
    try {
        const list = await loadSeasons(format.value);
        seasons.value = list;
        if (!seasonId.value) seasonId.value = list[0]?.id ?? '';
        await fetchRows();
    } catch (err) {
        console.warn('[meta] 赛季加载失败', err);
    } finally {
        loading.value = false;
    }
}

/** 拉取当前 format × seasonId 的排行榜 */
async function fetchRows(): Promise<void> {
    if (!seasonId.value) {
        rows.value = [];
        return;
    }
    loading.value = true;
    try {
        rows.value = await loadUsageRanking(format.value, seasonId.value);
    } catch (err) {
        console.warn('[meta] 使用率榜单加载失败', err);
        rows.value = [];
    } finally {
        loading.value = false;
    }
}

const onFormatChange = async (value: BattleFormat) => {
    if (value === format.value) return;
    format.value = value;
    // 赛制变了：赛季重新取，重置为该赛制的当前赛季
    seasons.value = [];
    seasonId.value = '';
    await bootstrap();
};

const onSeasonPick = (value: string | string[]) => {
    const id = String(value);
    if (id === seasonId.value) return;
    seasonId.value = id;
    void fetchRows();
};

const rowKey = (row: UsageRankingItem) => row.speciesId;

const seasonLabel = computed(
    () => seasons.value.find((s) => s.id === seasonId.value)?.label ?? t('meta.seasonTitle'),
);

const seasonOptions = computed<SheetOption[]>(() =>
    seasons.value.map((s) => ({
        id: s.id,
        label: s.label,
        subtitle: s.isCurrent ? t('meta.seasonCurrent') : undefined,
    })),
);

const goPokemonMeta = (speciesId: number) => {
    uni.navigateTo({
        url: `/pages/meta/pokemon-meta?id=${speciesId}&format=${format.value}&season=${seasonId.value}`,
    });
};
</script>
