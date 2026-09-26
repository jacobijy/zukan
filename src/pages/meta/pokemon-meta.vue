<template>
    <view class="archive-page min-h-screen page-bg" :style="{ paddingTop: 'var(--status-bar-height)', paddingBottom: '40px' }">
        <DetailNavbar :title="heroName" fallback-url="/pages/meta/meta" />

        <scroll-view
            scroll-y
            class="relative z-10 mt-[calc(var(--status-bar-height)+52px)] h-[calc(100vh-var(--status-bar-height)-52px)] px-4 pb-6"
        >
            <view v-if="loading" class="flex h-full items-center justify-center">
                <view class="field-loader"></view>
            </view>

            <view v-else class="mx-auto flex max-w-[720px] flex-col gap-3 pt-3">
                <!-- 头部：立绘 + 名称 + 格式 / 赛季 -->
                <view class="glass-panel flex items-center gap-4 px-5 py-5">
                    <EncryptedSprite
                        v-if="speciesId"
                        :pokemon-id="speciesId"
                        variant="home"
                        eager
                        img-class="h-20 w-20"
                        skeleton-class="h-20 w-20"
                    />
                    <view v-else class="h-20 w-20 rounded-2xl bg-gradient-to-br from-[#f2f4f8] to-[#e7ebf2]"></view>

                    <view class="min-w-0 flex-1">
                        <text class="block truncate text-xl font-black tracking-[-0.02em] text-[#24262b]">{{ heroName }}</text>
                        <view class="mt-2 flex flex-wrap gap-1.5">
                            <view class="rounded-full bg-[#eaf2ff] px-2.5 py-1 text-[10px] font-extrabold text-[#357df4]">{{ formatLabel }}</view>
                            <view class="rounded-full bg-[#f3f1fb] px-2.5 py-1 text-[10px] font-extrabold text-[#6d55c4]">{{ seasonLabel }}</view>
                        </view>
                    </view>
                </view>

                <template v-if="config">
                    <MetaRateSection v-if="abilityRows.length" :title="t('meta.sectionAbilities')" kind="ability" :rows="abilityRows" />
                    <MetaRateSection v-if="itemRows.length" :title="t('meta.sectionItems')" kind="item" :rows="itemRows" />
                    <MetaRateSection v-if="moveRows.length" :title="t('meta.sectionMoves')" kind="move" :rows="moveRows" />
                    <MetaRateSection v-if="natureRows.length" :title="t('meta.sectionNatures')" kind="nature" :rows="natureRows" />
                    <SpreadSection v-if="spreadRows.length" :title="t('meta.sectionSpreads')" :rows="spreadRows" />
                    <TeammateSection v-if="teammateRows.length" :title="t('meta.sectionTeammates')" :rows="teammateRows" @select="goTeammate" />
                </template>
            </view>
        </scroll-view>
    </view>
</template>

<script lang="ts" setup>
import { computed, ref, shallowRef } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { useI18n } from 'vue-i18n';
import DetailNavbar from '@/components/shared/DetailNavbar.vue';
import EncryptedSprite from '@/components/sprite/EncryptedSprite.vue';
import MetaRateSection from '@/components/meta/MetaRateSection.vue';
import SpreadSection from '@/components/meta/SpreadSection.vue';
import TeammateSection from '@/components/meta/TeammateSection.vue';
import { useI18nStore } from '@/store/i18n';
import {
    ensureDict,
    entryName,
    loadBattleMeta,
    loadLinkMap,
    loadPokemonConfig,
    statKeyByEnglish,
    toBattleLang,
    toRateRows,
    toSpreadRows,
    toTeammateNames,
    type BattleDict,
    type BattleDictCategory,
    type BattleFormat,
    type BattleMetaJson,
    type LinkEntry,
    type PokemonConfigVM,
    type RateRowVM,
    type SpreadRowVM,
    type TeammateRowVM,
} from '@/services/meta';

const { t } = useI18n();
const i18nStore = useI18nStore();

const slug = ref('');
const format = ref<BattleFormat>('singles');
const config = shallowRef<PokemonConfigVM | null>(null);
const linkMap = shallowRef<Map<string, LinkEntry>>(new Map());
const meta = shallowRef<BattleMetaJson | null>(null);
const dicts = shallowRef<Partial<Record<BattleDictCategory, BattleDict>>>({});
const loading = ref(true);

onLoad(async (options) => {
    slug.value = decodeURIComponent(options?.slug ?? '');
    format.value = options?.format === 'doubles' ? 'doubles' : 'singles';
    await loadAll();
});

const cats: BattleDictCategory[] = ['pokemon', 'moves', 'abilities', 'items', 'natures'];

async function loadAll(): Promise<void> {
    loading.value = true;
    try {
        const [cfg, links, metaJson, ...dictList] = await Promise.all([
            loadPokemonConfig(format.value, slug.value),
            loadLinkMap(),
            loadBattleMeta(),
            ...cats.map(ensureDict),
        ]);
        config.value = cfg;
        linkMap.value = links;
        meta.value = metaJson;
        dicts.value = Object.fromEntries(cats.map((c, i) => [c, dictList[i]]));
    } catch (err) {
        console.warn('[meta] 对战配置加载失败', err);
    } finally {
        loading.value = false;
    }
}

const lang = computed(() => toBattleLang(i18nStore.currentLang));

const speciesId = computed(() => linkMap.value.get(slug.value)?.id);
const heroName = computed(() => {
    const entry = dicts.value.pokemon?.[slug.value];
    return entryName(entry, lang.value, slug.value);
});
const formatLabel = computed(() =>
    format.value === 'doubles' ? t('meta.formatDoubles') : t('meta.formatSingles'),
);
const seasonLabel = computed(() => meta.value?.season ?? '');

/** 英文名行 → 翻译 + 相对 bar 的 VM */
function translatedRate(
    rows: PokemonConfigVM['abilities'],
    cat: BattleDictCategory,
): RateRowVM[] {
    const dict = dicts.value[cat];
    return toRateRows(rows).map((r) => ({
        name: entryName(dict?.[r.name], lang.value, r.name),
        pct: r.pct,
        barWidth: r.barWidth,
    }));
}

const abilityRows = computed(() => translatedRate(config.value?.abilities ?? [], 'abilities'));
const itemRows = computed(() => translatedRate(config.value?.items ?? [], 'items'));
const moveRows = computed(() => translatedRate(config.value?.moves ?? [], 'moves'));

const natureRows = computed<RateRowVM[]>(() => {
    const dict = dicts.value.natures;
    return toRateRows(config.value?.natures ?? []).map((r) => ({
        name: entryName(dict?.[r.name], lang.value, r.name),
        pct: r.pct,
        barWidth: r.barWidth,
        detail: natureDetail(r.up, r.down),
    }));
});

/** 性格加减能力：`↑攻击 ↓特攻`；无 up/down（中性性格）返回 undefined */
function natureDetail(up?: string, down?: string): string | undefined {
    if (!up || !down) return undefined;
    const label = (s: string) => {
        const key = statKeyByEnglish(s);
        return key ? t(key) : s;
    };
    return `↑${label(up)} ↓${label(down)}`;
}

const spreadRows = computed<SpreadRowVM[]>(() => toSpreadRows(config.value?.spreads ?? []));

const teammateRows = computed<TeammateRowVM[]>(() => {
    const dict = dicts.value.pokemon;
    // rows 里是精灵英文名；pokemon 字典 / link 以 slug（≈英文名小写）为键
    return toTeammateNames(config.value?.teammates ?? []).map((name) => {
        const candidate = name.toLowerCase();
        const entry = dict?.[candidate];
        return {
            slug: candidate,
            name: entryName(entry, lang.value, name),
            speciesId: linkMap.value.get(candidate)?.id,
        };
    });
});

const goTeammate = (candidate: string) => {
    uni.navigateTo({
        url: `/pages/meta/pokemon-meta?slug=${encodeURIComponent(candidate)}&format=${format.value}`,
    });
};
</script>
