<template>
    <view class="archive-page min-h-screen page-bg" :style="{ paddingTop: 'var(--status-bar-height)', paddingBottom: '40px' }">
        <DetailNavbar :title="t('archive.typesTitle')" fallback-url="/pages/data/data" />

        <scroll-view
            scroll-y
            class="relative z-10 mt-[calc(var(--status-bar-height)+52px)] h-[calc(100vh-var(--status-bar-height)-52px)] px-4 pb-6"
        >
            <view class="mx-auto flex max-w-[720px] flex-col gap-3 pt-3">
                <view v-if="loading" class="flex items-center justify-center py-20">
                    <view class="field-loader"></view>
                </view>
                <view v-else class="glass-panel overflow-hidden">
                    <TypeRow
                        v-for="slug in ALL_TYPE_SLUGS"
                        :key="slug"
                        :slug="slug"
                        :count="countOf(slug)"
                        @select="goDetail(slug)"
                    />
                </view>
            </view>
        </scroll-view>
    </view>
</template>

<script lang="ts" setup>
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { onLoad } from '@dcloudio/uni-app';
import DetailNavbar from '@/components/shared/DetailNavbar.vue';
import TypeRow from '@/components/archive/TypeRow.vue';
import { loadTypePokemonIndex } from '@/services/pokemon/archive';
import { ALL_TYPE_SLUGS } from '@/constants/pokemonTypes';
import { useI18nStore } from '@/store/i18n';

const { t } = useI18n();
const i18nStore = useI18nStore();

const index = ref<Map<string, number[]> | null>(null);
const loading = ref(true);

onLoad(async () => {
    void i18nStore.ensureLoaded();
    try {
        index.value = await loadTypePokemonIndex();
    } catch (err) {
        console.warn('[archive] 属性索引加载失败', err);
    } finally {
        loading.value = false;
    }
});

const countOf = (slug: string) => index.value?.get(slug)?.length ?? 0;

const goDetail = (slug: string) => {
    uni.navigateTo({ url: `/pages/archive/type-detail?slug=${slug}` });
};
</script>
