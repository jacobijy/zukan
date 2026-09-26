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
            <view class="mt-2 flex items-center">
                <view class="season-chip">
                    <view class="h-1.5 w-1.5 rounded-full bg-[#34b85a]"></view>
                    <text>{{ seasonLabel }}</text>
                </view>
            </view>
        </template>

        <template #default="{ item, index }">
            <UsageRankingRow
                :rank="index + 1"
                :name="item.name"
                :form="item.form"
                :species-id="item.speciesId"
                @select="goPokemonMeta(item.slug)"
            />
        </template>
    </ArchiveListShell>
</template>

<script lang="ts" setup>
import { computed, ref, shallowRef } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { useI18n } from 'vue-i18n';
import ArchiveListShell from '@/components/archive/ArchiveListShell.vue';
import UsageRankingRow from '@/components/meta/UsageRankingRow.vue';
import FormatSwitch from '@/components/meta/FormatSwitch.vue';
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

onLoad(() => {
    void bootstrap();
});

/** 首次：并发拉 meta / 排行榜 / link / 精灵名 字典 */
async function bootstrap(): Promise<void> {
    loading.value = true;
    try {
        const [metaJson, list, links, dict] = await Promise.all([
            loadBattleMeta(),
            loadLeaderboardSlugs(format.value),
            loadLinkMap(),
            ensureDict('pokemon'),
        ]);
        meta.value = metaJson;
        slugs.value = list;
        linkMap.value = links;
        pokemonDict.value = dict;
    } catch (err) {
        console.warn('[meta] 排行榜加载失败', err);
    } finally {
        loading.value = false;
    }
}

const onFormatChange = async (value: BattleFormat) => {
    if (value === format.value) return;
    format.value = value;
    loading.value = true;
    try {
        slugs.value = await loadLeaderboardSlugs(value);
    } catch (err) {
        console.warn('[meta] 排行榜切换失败', err);
    } finally {
        loading.value = false;
    }
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

const seasonLabel = computed(() => {
    const season = meta.value?.season ?? '';
    return season ? `${season} · ${t('meta.seasonCurrent')}` : t('meta.seasonCurrent');
});

const goPokemonMeta = (slug: string) => {
    uni.navigateTo({
        url: `/pages/meta/pokemon-meta?slug=${encodeURIComponent(slug)}&format=${format.value}`,
    });
};
</script>

<style lang="scss" scoped>
.season-chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 32px;
    padding: 0 12px;
    font-size: 12px;
    font-weight: 800;
    color: #4a5060;
    background: #fff;
    border: 1px solid #e1e4eb;
    border-radius: 999px;
    box-shadow: 0 8px 16px rgba(48, 55, 72, 0.06);
}
</style>
