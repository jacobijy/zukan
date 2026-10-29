<template>
    <view>
        <view class="section-label mt-6">{{ t('data.sectionPopular') }}</view>
        <view class="data-list glass-panel">
            <ListRow
                v-for="(row, index) in rows"
                :key="row.id"
                :title="row.name"
                :desc="row.types"
                :meta="row.meta"
                :iconClass="row.markClass"
                :last="index === rows.length - 1"
                showChevron
                @click="goToDetail(row.id)"
            >
                <template #icon>
                    <text class="pokemon-mark__text" :class="{ 'pokemon-mark__text--rank': row.rank !== null }">{{
                        row.mark
                    }}</text>
                </template>
            </ListRow>
        </view>
    </view>
</template>

<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import ListRow from '@/components/shared/ListRow.vue';
import { getTypeName } from '@/constants/pokemonTypes';
import { interp } from '@/services/i18n/ui-i18n';
import { loadPopularPokemons, type PopularPokemon } from '@/services/popularity/popularity';
import { useI18nStore } from '@/store/i18n';

const { t } = useI18n();
const i18nStore = useI18nStore();
// 物种 / 属性名随内容语言走 i18n 内容 bundle，深链冷启动名称未到时 computed 自动刷新。
void i18nStore.ensureLoaded();

/** 资料中心只展示榜首 Top 3（协议建议首页 Top N，N 取与旧硬编码一致的 3）。 */
const TOP_N = 3;

/**
 * 拉不到榜单（网络失败 / 服务端故障）或榜单为空（新环境尚无任何收藏）时的
 * 内置回落三项，保持接入热度接口前的展示与跳转。
 */
const FALLBACK_DEFS = [
    { pokemonId: 25, speciesId: 25, fallbackName: '皮卡丘', types: ['electric'], markClass: 'pokemon-mark--gold' },
    { pokemonId: 6, speciesId: 6, fallbackName: '喷火龙', types: ['fire', 'flying'], markClass: 'pokemon-mark--red' },
    { pokemonId: 9, speciesId: 9, fallbackName: '水箭龟', types: ['water'], markClass: 'pokemon-mark--blue' },
];

/** 名次磁贴配色：金 / 红 / 蓝，三名之外用中性灰（Top 3 不会触发，留作扩量兜底）。 */
const RANK_MARK_CLASS = ['pokemon-mark--gold', 'pokemon-mark--red', 'pokemon-mark--blue'];

interface PopularRow {
    id: number;
    name: string;
    types: string;
    mark: string;
    markClass: string;
    meta: string;
    /** 真实榜单项的名次；回落项为 null（决定磁贴显示名次还是全国编号） */
    rank: number | null;
}

const entries = ref<PopularPokemon[] | null>(null);

const typeLabel = (slug: string): string => i18nStore.typeName(slug) ?? getTypeName(slug);

const rows = computed<PopularRow[]>(() => {
    const list = entries.value;
    if (list && list.length > 0) {
        return list.slice(0, TOP_N).map((p) => ({
            id: p.pokemonId,
            name: i18nStore.speciesName(p.speciesId) ?? `#${p.speciesId}`,
            types: p.types.map(typeLabel).join(' / '),
            mark: String(p.rank),
            markClass: RANK_MARK_CLASS[p.rank - 1] ?? 'list-row__icon--gray',
            meta: interp('data.popular.favoriteCount', { n: p.favoriteCount }),
            rank: p.rank,
        }));
    }
    // 回落：与旧版一致的全国编号磁贴 +「详情」，名称未就绪用内置中文名。
    return FALLBACK_DEFS.map((p) => ({
        id: p.pokemonId,
        name: i18nStore.speciesName(p.speciesId) ?? p.fallbackName,
        types: p.types.map(typeLabel).join(' / '),
        mark: String(p.pokemonId).padStart(3, '0'),
        markClass: p.markClass,
        meta: t('data.detail'),
        rank: null,
    }));
});

onMounted(() => {
    void (async () => {
        try {
            // 名称表与榜单并行；空榜（length=0）不赋值，rows 保持内置回落。
            const [, list] = await Promise.all([i18nStore.ensureLoaded(), loadPopularPokemons(TOP_N)]);
            if (list.length > 0) entries.value = list;
        } catch (err) {
            // 静默回落内置三项，不打断资料页浏览。
            console.warn('[popularity] 热门样本加载失败，使用内置三项回落', err);
        }
    })();
});

const goToDetail = (id: number) => {
    uni.navigateTo({ url: `/pages/detail/detail?id=${id}` });
};
</script>

<style lang="scss" scoped>
/* 编号 / 名次标记字形；配色 .pokemon-mark--* 与 .list-row__icon--* 均在 global.css
 * （基础与变体必须同处全局，scoped 特异性会盖掉传入的配色变体）。 */
.pokemon-mark__text {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 12px;
    font-weight: 900;
}

/* 单位数名次比三位编号笔画少，放大一档填满磁贴 */
.pokemon-mark__text--rank {
    font-size: 17px;
}
</style>
