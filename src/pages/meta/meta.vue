<template>
    <ArchiveListShell
        :title="t('meta.title')"
        fallback-url="/pages/data/data"
        :loading="loading"
        :empty="!loading && rows.length === 0"
        :empty-title="emptyTitle"
        :empty-desc="emptyDesc"
    >
        <template #tools>
            <FormatSwitch :model-value="format" @update:model-value="onFormatChange" />
            <SeasonSwitch
                v-if="meta && seasons.length"
                class="mt-2"
                :seasons="seasons"
                :current-season="meta.season"
                :model-value="selectedSeason"
                @update:model-value="onSeasonChange"
            />
        </template>

        <template #list>
            <VirtualList
                :items="rows"
                :item-key="rowKey"
                :item-height="68"
                class="h-full"
            >
                <template #default="{ item, index }">
                    <UsageRankingRow
                        :rank="index + 1"
                        :name="item.name"
                        :form="item.form"
                        :species-id="item.speciesId"
                        @select="goPokemonMeta(item.slug)"
                    />
                </template>
            </VirtualList>
        </template>
    </ArchiveListShell>
</template>

<script lang="ts" setup>
import { computed, ref, shallowRef } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { useI18n } from 'vue-i18n';
import ArchiveListShell from '@/components/archive/ArchiveListShell.vue';
import VirtualList from '@/components/dex/VirtualList.vue';
import UsageRankingRow from '@/components/meta/UsageRankingRow.vue';
import FormatSwitch from '@/components/meta/FormatSwitch.vue';
import SeasonSwitch from '@/components/meta/SeasonSwitch.vue';
import { useI18nStore } from '@/store/i18n';
import {
    ensureDict,
    entryForm,
    entryName,
    loadBattleMeta,
    loadLeaderboardSlugs,
    loadLinkMap,
    toBattleLang,
    type BattleDict,
    type BattleMetaJson,
    type BattleFormat,
    type LeaderboardRowVM,
    type LinkEntry,
} from '@/services/meta';

const { t } = useI18n();
const i18nStore = useI18nStore();

const format = ref<BattleFormat>('singles');
const slugs = ref<string[]>([]);
const linkMap = shallowRef<Map<string, LinkEntry>>(new Map());
const pokemonDict = shallowRef<BattleDict | null>(null);
const meta = shallowRef<BattleMetaJson | null>(null);
const loading = ref(true);
/** 当前选中的赛季；初始为 meta.season，切换历史赛季后改变 */
const selectedSeason = ref('');
/** 历史赛季数据未发布（404）时置 true，显示降级空态 */
const unavailable = ref(false);

const seasons = computed(() => meta.value?.seasons ?? []);

onLoad(() => {
    void bootstrap();
});

/** 首次：先拉 meta 拿当前赛季，再按当前赛季（根路径）拉排行 / link / 精灵名 字典 */
async function bootstrap(): Promise<void> {
    loading.value = true;
    try {
        const metaJson = await loadBattleMeta();
        meta.value = metaJson;
        selectedSeason.value = metaJson.season;
        await loadData(format.value, null);
    } catch (err) {
        console.warn('[meta] 排行榜加载失败', err);
    } finally {
        loading.value = false;
    }
}

/**
 * 拉取某赛制 × 赛季的数据（排行榜 / link / 精灵名字典）。
 * seasonArg 为 null 时走根路径（当前赛季）；历史赛季缺失（404）→ 降级空态。
 */
async function loadData(battleFormat: BattleFormat, seasonArg: string | null): Promise<void> {
    loading.value = true;
    try {
        const [list, links, dict] = await Promise.all([
            loadLeaderboardSlugs(battleFormat, seasonArg),
            loadLinkMap(seasonArg),
            ensureDict('pokemon', seasonArg),
        ]);
        slugs.value = list;
        linkMap.value = links;
        pokemonDict.value = dict;
        unavailable.value = false;
    } catch (err) {
        slugs.value = [];
        unavailable.value = true;
        console.warn('[meta] 赛季数据加载失败', err);
    } finally {
        loading.value = false;
    }
}

/** 当前选中赛季 → service 路径参数：当前赛季走根路径（null），历史赛季传赛季名。 */
function seasonArg(): string | null {
    return selectedSeason.value && selectedSeason.value !== meta.value?.season ? selectedSeason.value : null;
}

const onFormatChange = async (value: BattleFormat) => {
    if (value === format.value) return;
    format.value = value;
    await loadData(value, seasonArg());
};

const onSeasonChange = async (season: string) => {
    if (season === selectedSeason.value) return;
    selectedSeason.value = season;
    await loadData(format.value, seasonArg());
};

// 名称/形态随内容语言解析；引用 currentLang，语言切换自动重算
const rows = computed<LeaderboardRowVM[]>(() => {
    const lang = toBattleLang(i18nStore.currentLang);
    const dict = pokemonDict.value;
    return slugs.value.map((slug) => {
        const entry = dict?.[slug];
        return {
            slug,
            name: entryName(entry, lang, slug),
            form: entryForm(entry, lang),
            speciesId: linkMap.value.get(slug)?.id,
        };
    });
});

const rowKey = (row: LeaderboardRowVM) => row.slug;

const seasonLabel = computed(() => selectedSeason.value || t('meta.seasonCurrent'));

const emptyTitle = computed(() =>
    unavailable.value ? t('meta.seasonUnavailableTitle') : t('meta.emptyTitle'),
);
const emptyDesc = computed(() =>
    unavailable.value ? t('meta.seasonUnavailableDesc') : t('meta.emptyDesc'),
);

const goPokemonMeta = (slug: string) => {
    uni.navigateTo({
        url: `/pages/meta/pokemon-meta?slug=${encodeURIComponent(slug)}&format=${format.value}&season=${encodeURIComponent(seasonArg() ?? '')}`,
    });
};
</script>

<style lang="scss" scoped></style>
