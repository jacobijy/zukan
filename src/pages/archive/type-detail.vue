<template>
    <view class="archive-page min-h-screen page-bg" :style="{ paddingTop: 'var(--status-bar-height)', paddingBottom: '40px' }">
        <DetailNavbar :title="t('archive.typeDetailTitle')" fallback-url="/pages/archive/types" />

        <scroll-view
            scroll-y
            class="relative z-10 mt-[calc(var(--status-bar-height)+52px)] h-[calc(100vh-var(--status-bar-height)-52px)] px-4 pb-6"
        >
            <view class="mx-auto flex max-w-[720px] flex-col gap-3 pt-3">
                <!-- 头部：属性徽章 + 名称 -->
                <view class="glass-panel flex items-center gap-4 px-5 py-5">
                    <TypeBadge :type="slug" size="lg" variant="pill" />
                    <view class="min-w-0">
                        <text class="block text-xl font-black tracking-[-0.02em] text-[#24262b]">{{ name }}</text>
                        <text class="mt-1 block text-[12px] font-bold text-[#8d929c]">{{ t('archive.pokemonCount', { n: pokemon.length }) }}</text>
                    </view>
                </view>

                <TypeMatchupCard :type="slug" />

                <text class="section-label">{{ t('archive.sectionTypePokemon') }}</text>
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
import TypeBadge from '@/components/pokemon/TypeBadge.vue';
import TypeMatchupCard from '@/components/archive/TypeMatchupCard.vue';
import PokemonMiniList from '@/components/archive/PokemonMiniList.vue';
import { loadTypePokemonIndex } from '@/services/pokemon/archive';
import { getTypeMeta } from '@/constants/pokemonTypes';
import { useI18nStore } from '@/store/i18n';

const { t } = useI18n();
const i18nStore = useI18nStore();

const slug = ref('normal');
const pokemon = ref<number[]>([]);

onLoad(async (options) => {
    if (options?.slug) slug.value = options.slug;
    void i18nStore.ensureLoaded();
    try {
        const index = await loadTypePokemonIndex();
        pokemon.value = index.get(slug.value) ?? [];
    } catch (err) {
        console.warn('[archive] 属性详情加载失败', err);
    }
});

const name = computed(() => i18nStore.typeName(slug.value) ?? getTypeMeta(slug.value).name);
</script>
