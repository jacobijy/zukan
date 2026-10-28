<template>
    <view class="archive-page min-h-screen page-bg" :style="[pageSafeArea, { paddingBottom: '40px' }]">
        <DetailNavbar :title="t('archive.abilityDetailTitle')" fallback-url="/pages/archive/abilities" />

        <scroll-view
            scroll-y
            class="relative z-10 mt-[var(--navbar-total-height)] h-[calc(100vh-var(--navbar-total-height))] px-4 pb-6"
        >
            <view class="mx-auto flex max-w-[720px] flex-col gap-3 pt-3">
                <!-- 头部：名称 -->
                <view class="glass-panel flex items-center gap-4 px-5 py-5">
                    <view class="min-w-0">
                        <text class="block truncate text-xl font-black tracking-[-0.02em] text-[#24262b]">{{ name }}</text>
                        <text class="mt-1 block text-[12px] font-bold" style="color: var(--text-secondary)">{{ interp('archive.pokemonCount', { n: pokemon.length }) }}</text>
                    </view>
                </view>

                <text class="section-label">{{ t('archive.sectionDescription') }}</text>
                <FlavorTextCard kind="ability" :id="abilityId" />

                <text class="section-label">{{ t('archive.sectionPokemon') }}</text>
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
import FlavorTextCard from '@/components/archive/FlavorTextCard.vue';
import PokemonMiniList from '@/components/archive/PokemonMiniList.vue';
import { loadAbilityPokemonIndex } from '@/services/pokemon/archive';
import { useI18nStore } from '@/store/i18n'

const pageSafeArea = usePageSafeArea();

const { t } = useI18n();
const i18nStore = useI18nStore();

const abilityId = ref(0);
const pokemon = ref<number[]>([]);

onLoad(async (options) => {
    abilityId.value = Number(options?.id ?? 0);
    void i18nStore.ensureLoaded();
    try {
        const index = await loadAbilityPokemonIndex();
        pokemon.value = index.get(abilityId.value) ?? [];
    } catch (err) {
        console.warn('[archive] 特性详情加载失败', err);
    }
});

const name = computed(
    () => (abilityId.value && i18nStore.abilityName(abilityId.value)) || `ability-${abilityId.value}`,
);
</script>
