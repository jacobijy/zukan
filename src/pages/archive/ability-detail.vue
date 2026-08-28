<template>
    <view class="archive-page min-h-screen page-bg" :style="{ paddingTop: 'var(--status-bar-height)', paddingBottom: '40px' }">
        <DetailNavbar :title="t('archive.abilityDetailTitle')" fallback-url="/pages/archive/abilities" />

        <scroll-view
            scroll-y
            class="relative z-10 mt-[calc(var(--status-bar-height)+52px)] h-[calc(100vh-var(--status-bar-height)-52px)] px-4 pb-6"
        >
            <view class="mx-auto flex max-w-[720px] flex-col gap-3 pt-3">
                <!-- 头部：名称 -->
                <view class="glass-panel flex items-center gap-4 px-5 py-5">
                    <view class="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#9a86f4] to-[#4b32a6] text-white shadow-[0_10px_20px_rgba(75,50,166,0.25)]">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="h-6 w-6"><path d="m12 2 2.6 6.5L21 11l-6.4 2.5L12 20l-2.6-6.5L3 11l6.4-2.5L12 2z"></path></svg>
                    </view>
                    <view class="min-w-0">
                        <text class="block truncate text-xl font-black tracking-[-0.02em] text-[#24262b]">{{ name }}</text>
                        <text class="mt-1 block text-[12px] font-bold text-[#8d929c]">{{ t('archive.pokemonCount', { n: pokemon.length }) }}</text>
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
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { onLoad } from '@dcloudio/uni-app';
import DetailNavbar from '@/components/shared/DetailNavbar.vue';
import FlavorTextCard from '@/components/archive/FlavorTextCard.vue';
import PokemonMiniList from '@/components/archive/PokemonMiniList.vue';
import { loadAbilityPokemonIndex } from '@/services/pokemon/archive';
import { useI18nStore } from '@/store/i18n';

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
