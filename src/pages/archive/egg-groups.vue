<template>
    <view class="archive-page min-h-screen page-bg" :style="[pageSafeArea, { paddingBottom: '40px' }]">
        <DetailNavbar :title="t('archive.eggGroupsTitle')" fallback-url="/pages/data/data" />

        <scroll-view
            scroll-y
            class="relative z-10 mt-[var(--navbar-total-height)] h-[calc(100vh-var(--navbar-total-height))] px-4 pb-6"
        >
            <view class="mx-auto flex max-w-[720px] flex-col gap-3 pt-3">
                <view v-if="loading" class="flex items-center justify-center py-20">
                    <view class="field-loader"></view>
                </view>
                <view v-else class="glass-panel overflow-hidden">
                    <EggGroupRow
                        v-for="group in EGG_GROUPS"
                        :key="group.id"
                        :id="group.id"
                        :count="countOf(group.id)"
                        @select="goDetail(group.id)"
                    />
                </view>
            </view>
        </scroll-view>
    </view>
</template>

<script lang="ts" setup>
import { usePageSafeArea } from '@/composables/usePageSafeArea';
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { onLoad } from '@dcloudio/uni-app';
import DetailNavbar from '@/components/shared/DetailNavbar.vue';
import EggGroupRow from '@/components/archive/EggGroupRow.vue';
import { loadEggGroupPokemonIndex } from '@/services/pokemon/archive';
import { EGG_GROUPS } from '@/constants/eggGroups';
import { useI18nStore } from '@/store/i18n';

const pageSafeArea = usePageSafeArea();

const { t } = useI18n();
const i18nStore = useI18nStore();

const index = ref<Map<number, number[]> | null>(null);
const loading = ref(true);

onLoad(async () => {
    void i18nStore.ensureLoaded();
    try {
        index.value = await loadEggGroupPokemonIndex();
    } catch (err) {
        console.warn('[archive] 蛋组索引加载失败', err);
    } finally {
        loading.value = false;
    }
});

const countOf = (id: number) => index.value?.get(id)?.length ?? 0;

const goDetail = (id: number) => {
    uni.navigateTo({ url: `/pages/archive/egg-group-detail?id=${id}` });
};
</script>
