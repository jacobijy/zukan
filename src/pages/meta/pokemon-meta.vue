<template>
    <view class="archive-page min-h-screen page-bg" :style="[pageSafeArea, { paddingBottom: '40px' }]">
        <DetailNavbar :title="heroName" fallback-url="/pages/meta/meta" />

        <scroll-view
            scroll-y
            class="relative z-10 mt-[var(--navbar-total-height)] h-[calc(100vh-var(--navbar-total-height))] px-4 pb-6"
        >
            <view v-if="loading" class="flex h-full items-center justify-center">
                <view class="field-loader"></view>
            </view>

            <!-- 历史赛季数据未发布 → 降级空态 -->
            <view v-else-if="unavailable" class="flex h-full items-center justify-center">
                <view class="text-center px-8">
                    <text class="block text-[15px] font-extrabold text-[#6f7682]">{{ t('meta.seasonUnavailableTitle') }}</text>
                    <text class="mt-1 block text-[13px] font-semibold text-[#a6abb5]">{{ t('meta.seasonUnavailableDesc') }}</text>
                </view>
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
import { usePageSafeArea } from '@/composables/usePageSafeArea';
import { computed, ref, shallowRef } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { useI18n } from 'vue-i18n';
import DetailNavbar from '@/components/shared/DetailNavbar.vue';
import EncryptedSprite from '@/components/sprite/EncryptedSprite.vue';
import MetaRateSection from '@/components/meta/MetaRateSection.vue';
import SpreadSection from '@/components/meta/SpreadSection.vue';
import TeammateSection from '@/components/meta/TeammateSection.vue';
import { useI18nStore } from '@/store/i18n';
import { typeStrs } from '@/utils/helpers';
import {
    ensureDict,
    ensureMoveRefs,
    entryName,
    loadBattleMeta,
    loadLinkMap,
    loadPokemonConfig,
    resolveMoveMeta,
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
} from '@/services/meta'

const pageSafeArea = usePageSafeArea();

const { t } = useI18n();
const i18nStore = useI18nStore();

const slug = ref('');
const format = ref<BattleFormat>('singles');
/** 当前展示赛季；null = 当前赛季（根路径），历史赛季为赛季名（如 'M5'） */
const season = ref<string | null>(null);
const config = shallowRef<PokemonConfigVM | null>(null);
const linkMap = shallowRef<Map<string, LinkEntry>>(new Map());
const meta = shallowRef<BattleMetaJson | null>(null);
const dicts = shallowRef<Partial<Record<BattleDictCategory, BattleDict>>>({});
const loading = ref(true);
/** 历史赛季数据未发布（404）时置 true，显示降级空态 */
const unavailable = ref(false);

onLoad(async (options) => {
    slug.value = decodeURIComponent(options?.slug ?? '');
    format.value = options?.format === 'doubles' ? 'doubles' : 'singles';
    season.value = options?.season ? decodeURIComponent(options.season) : null;
    await loadAll();
});

const cats: BattleDictCategory[] = ['pokemon', 'moves', 'abilities', 'items', 'natures'];

async function loadAll(): Promise<void> {
    loading.value = true;
    try {
        const [cfg, links, metaJson, ...dictList] = await Promise.all([
            loadPokemonConfig(format.value, slug.value, season.value),
            loadLinkMap(season.value),
            loadBattleMeta(),
            ...cats.map((c) => ensureDict(c, season.value)),
        ]);
        config.value = cfg;
        linkMap.value = links;
        meta.value = metaJson;
        dicts.value = Object.fromEntries(cats.map((c, i) => [c, dictList[i]]));
        unavailable.value = false;
        // 名称 lookup（招式分类名翻译依赖）；通常 boot 已就绪
        await i18nStore.ensureLoaded().catch((err) => console.warn('[meta] 名称组不可用', err));
        // 招式属性 / 分类反查表；失败不阻塞，招式行不显示徽章
        await ensureMoveRefs().catch((err) => console.warn('[meta] 招式反查表不可用', err));
    } catch (err) {
        config.value = null;
        unavailable.value = true;
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
const seasonLabel = computed(() => season.value ?? meta.value?.season ?? '');

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
const itemRows = computed<RateRowVM[]>(() => {
    const dict = dicts.value.items;
    return toRateRows(config.value?.items ?? []).map((r) => ({
        name: entryName(dict?.[r.name], lang.value, r.name),
        pct: r.pct,
        barWidth: r.barWidth,
        iconName: r.name,
    }));
});
const moveRows = computed<RateRowVM[]>(() => {
    const dict = dicts.value.moves;
    return toRateRows(config.value?.moves ?? []).map((r) => {
        const moveMeta = resolveMoveMeta(r.name);
        return {
            name: entryName(dict?.[r.name], lang.value, r.name),
            pct: r.pct,
            barWidth: r.barWidth,
            typeSlug: moveMeta ? (typeStrs[moveMeta.typeId] ?? 'normal') : undefined,
            category: moveMeta?.damageClassId
                ? (i18nStore.moveDamageClassName(moveMeta.damageClassId) ?? undefined)
                : undefined,
        };
    });
});

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
