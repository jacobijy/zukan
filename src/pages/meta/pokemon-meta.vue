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
                <!-- 头部：立绘 + 名称 + 赛制 / 赛季上下文 -->
                <view class="glass-panel flex items-center gap-4 px-5 py-5">
                    <EncryptedSprite
                        :pokemon-id="speciesId"
                        variant="home"
                        eager
                        img-class="h-20 w-20"
                        skeleton-class="h-20 w-20"
                    />
                    <view class="min-w-0 flex-1">
                        <text class="block truncate text-xl font-black tracking-[-0.02em] text-[#24262b]">{{ heroName }}</text>
                        <view class="mt-2 flex flex-wrap gap-1.5">
                            <view class="rounded-full bg-[#eaf2ff] px-2.5 py-1 text-[10px] font-extrabold text-[#357df4]">{{ formatLabel }}</view>
                            <view class="rounded-full bg-[#f3f1fb] px-2.5 py-1 text-[10px] font-extrabold text-[#6d55c4]">{{ seasonLabel }}</view>
                        </view>
                    </view>
                </view>

                <MetaRateSection :title="t('meta.sectionAbilities')" icon-kind="ability" :rows="abilityRows" />
                <MetaRateSection :title="t('meta.sectionItems')" icon-kind="item" :rows="itemRows" />
                <MetaRateSection :title="t('meta.sectionMoves')" icon-kind="move" :rows="moveRows" />
            </view>
        </scroll-view>
    </view>
</template>

<script lang="ts" setup>
import { computed, ref } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { useI18n } from 'vue-i18n';
import DetailNavbar from '@/components/shared/DetailNavbar.vue';
import EncryptedSprite from '@/components/sprite/EncryptedSprite.vue';
import MetaRateSection from '@/components/meta/MetaRateSection.vue';
import { loadMoveList } from '@/services/pokemon/archive';
import { loadPokemonUsageMeta, loadSeasons } from '@/services/meta';
import type { BattleFormat, MetaRateRowVM, MetaSeason, PokemonUsageMeta } from '@/services/meta';
import { useI18nStore } from '@/store/i18n';
import { typeStrs } from '@/utils/helpers';

const { t } = useI18n();
const i18nStore = useI18nStore();

const speciesId = ref(0);
const format = ref<BattleFormat>('singles');
const seasonId = ref('');
const meta = ref<PokemonUsageMeta | null>(null);
const seasons = ref<MetaSeason[]>([]);
const moveTypes = new Map<number, number>();
const loading = ref(true);

onLoad(async (options) => {
    speciesId.value = Number(options?.id ?? 0);
    format.value = (options?.format as BattleFormat) === 'doubles' ? 'doubles' : 'singles';
    seasonId.value = options?.season ?? '';

    void i18nStore.ensureLoaded();
    try {
        const [data, moveList, seasonList] = await Promise.all([
            loadPokemonUsageMeta(speciesId.value, format.value, seasonId.value),
            loadMoveList(),
            loadSeasons(format.value),
        ]);
        meta.value = data;
        for (const m of moveList) moveTypes.set(m.id, m.typeId);
        seasons.value = seasonList;
    } catch (err) {
        console.warn('[meta] 宝可梦对战配置加载失败', err);
    } finally {
        loading.value = false;
    }
});

const heroName = computed(
    () => i18nStore.speciesName(speciesId.value) ?? `pokemon-${speciesId.value}`,
);
const formatLabel = computed(() =>
    format.value === 'doubles' ? t('meta.formatDoubles') : t('meta.formatSingles'),
);
const seasonLabel = computed(
    () => seasons.value.find((s) => s.id === seasonId.value)?.label ?? seasonId.value,
);

function toRow(
    id: number,
    name: string | null,
    fallback: string,
    rate: number,
    barWidth: number,
    typeSlug?: string,
): MetaRateRowVM {
    return { key: id, name: name ?? `${fallback}-${id}`, rate, barWidth, typeSlug };
}

const abilityRows = computed<MetaRateRowVM[]>(() =>
    (meta.value?.abilities ?? []).map((c) =>
        toRow(c.id, i18nStore.abilityName(c.id), 'ability', c.usageRate, c.barWidth),
    ),
);

const itemRows = computed<MetaRateRowVM[]>(() =>
    (meta.value?.items ?? []).map((c) =>
        toRow(c.id, i18nStore.itemName(c.id), 'item', c.usageRate, c.barWidth),
    ),
);

const moveRows = computed<MetaRateRowVM[]>(() =>
    (meta.value?.moves ?? []).map((c) => {
        const slug = typeStrs[moveTypes.get(c.id) ?? 0];
        return toRow(c.id, i18nStore.moveName(c.id), 'move', c.usageRate, c.barWidth, slug);
    }),
);
</script>
