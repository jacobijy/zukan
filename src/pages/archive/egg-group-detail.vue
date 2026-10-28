<template>
    <view class="archive-page min-h-screen page-bg" :style="[pageSafeArea, { paddingBottom: '40px' }]">
        <DetailNavbar :title="t('archive.eggGroupDetailTitle')" fallback-url="/pages/archive/egg-groups" />

        <scroll-view
            scroll-y
            class="relative z-10 mt-[var(--navbar-total-height)] h-[calc(100vh-var(--navbar-total-height))] px-4 pb-6"
        >
            <view class="mx-auto flex max-w-[720px] flex-col gap-3 pt-3">
                <!-- 头部：蛋组胶囊 + 名称/计数 -->
                <view class="glass-panel flex items-center gap-4 px-5 py-5">
                    <view class="egg-pill">
                        <text class="egg-pill__text">{{ name }}</text>
                    </view>
                    <view class="min-w-0">
                        <text class="block text-xl font-black tracking-[-0.02em] text-[#24262b]">{{ name }}</text>
                        <text class="mt-1 block text-[12px] font-bold" style="color: var(--text-secondary)">{{ interp('archive.pokemonCount', { n: pokemon.length }) }}</text>
                    </view>
                </view>

                <text class="section-label">{{ t('archive.sectionEggGroupPokemon') }}</text>
                <PokemonMiniList :species-ids="pokemon" />
            </view>
        </scroll-view>
    </view>
</template>

<script lang="ts" setup>
import { usePageSafeArea } from '@/composables/usePageSafeArea';
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { interp } from '@/services/i18n/ui-i18n';
import { onLoad } from '@dcloudio/uni-app';
import DetailNavbar from '@/components/shared/DetailNavbar.vue';
import PokemonMiniList from '@/components/archive/PokemonMiniList.vue';
import { loadEggGroupPokemonIndex } from '@/services/pokemon/archive';
import { getEggGroupMeta } from '@/constants/eggGroups';
import { useI18nStore } from '@/store/i18n';

const pageSafeArea = usePageSafeArea();

const { t } = useI18n();
const i18nStore = useI18nStore();

const groupId = ref(0);
const pokemon = ref<number[]>([]);

onLoad(async (options) => {
    const parsed = Number(options?.id);
    if (Number.isFinite(parsed) && parsed > 0) groupId.value = parsed;
    void i18nStore.ensureLoaded();
    try {
        const index = await loadEggGroupPokemonIndex();
        pokemon.value = index.get(groupId.value) ?? [];
    } catch (err) {
        console.warn('[archive] 蛋组详情加载失败', err);
    }
});

const name = computed(
    () => i18nStore.eggGroupName(groupId.value) ?? getEggGroupMeta(groupId.value)?.name ?? '-',
);
</script>

<style scoped>
/* 与 EggGroupRow / TypeBadge lg pill 同视觉口径的统一中性紫胶囊 */
.egg-pill {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    padding: 7px 16px;
    border-radius: 999px;
    background: linear-gradient(135deg, #f0eaff 0%, #ddd1fe 60%, #c9b8f8 100%);
    box-shadow: 0 8px 16px rgba(90, 62, 192, 0.16);
}

.egg-pill__text {
    font-size: 14px;
    font-weight: 900;
    letter-spacing: 0.04em;
    color: #4a32a0;
    white-space: nowrap;
}
</style>
