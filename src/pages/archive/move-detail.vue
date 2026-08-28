<template>
    <view class="archive-page min-h-screen page-bg" :style="{ paddingTop: 'var(--status-bar-height)', paddingBottom: '40px' }">
        <DetailNavbar :title="t('archive.moveDetailTitle')" fallback-url="/pages/archive/moves" />

        <scroll-view
            scroll-y
            class="relative z-10 mt-[calc(var(--status-bar-height)+52px)] h-[calc(100vh-var(--status-bar-height)-52px)] px-4 pb-6"
        >
            <view class="mx-auto flex max-w-[720px] flex-col gap-3 pt-3">
                <view v-if="loading" class="flex items-center justify-center py-20">
                    <view class="field-loader"></view>
                </view>

                <template v-else-if="move">
                    <!-- 头部：名称 + 属性徽章 + 分类 -->
                    <view class="glass-panel flex items-center gap-4 px-5 py-5">
                        <view class="min-w-0 flex-1">
                            <text class="block truncate text-xl font-black tracking-[-0.02em] text-[#24262b]">{{ name }}</text>
                            <view class="mt-2 flex items-center gap-2">
                                <TypeBadge :type="typeSlug" size="md" variant="pill" />
                                <text class="text-[12px] font-bold text-[#8d929c]">{{ categoryName }}</text>
                            </view>
                        </view>
                    </view>

                    <!-- 数值网格 -->
                    <InfoGrid>
                        <InfoCard :label="t('archive.power')" :value="powerText" icon-class="info-card__icon--red">
                            <template #icon>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5"><polygon points="13 2.5 4 14 12 14 11 21.5 20 10 12 10 13 2.5"></polygon></svg>
                            </template>
                        </InfoCard>
                        <InfoCard :label="t('archive.accuracy')" :value="accuracyText" icon-class="info-card__icon--paper">
                            <template #icon>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5"><circle cx="12" cy="12" r="9"></circle><circle cx="12" cy="12" r="5"></circle><circle cx="12" cy="12" r="1.5" fill="currentColor"></circle></svg>
                            </template>
                        </InfoCard>
                        <InfoCard :label="t('archive.pp')" :value="String(move.pp)" icon-class="info-card__icon--green">
                            <template #icon>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 3H20v18H6.5A2.5 2.5 0 0 1 4 18.5v-13A2.5 2.5 0 0 1 6.5 3z"></path></svg>
                            </template>
                        </InfoCard>
                        <InfoCard :label="t('archive.priority')" :value="priorityText" icon-class="info-card__icon--gold">
                            <template #icon>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5"><path d="M12 19V5"></path><path d="m5 12 7-7 7 7"></path></svg>
                            </template>
                        </InfoCard>
                        <InfoCard :label="t('archive.target')" :value="targetName" icon-class="info-card__icon--paper" wide>
                            <template #icon>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5"><circle cx="12" cy="12" r="9"></circle><circle cx="12" cy="12" r="4"></circle><circle cx="12" cy="12" r="1" fill="currentColor"></circle></svg>
                            </template>
                        </InfoCard>
                    </InfoGrid>

                    <text class="section-label">{{ t('archive.sectionDescription') }}</text>
                    <FlavorTextCard kind="move" :id="move.id" />
                </template>
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
import InfoGrid from '@/components/pokemon/InfoGrid.vue';
import InfoCard from '@/components/pokemon/InfoCard.vue';
import FlavorTextCard from '@/components/archive/FlavorTextCard.vue';
import { loadMoveList, type MoveListRow } from '@/services/pokemon/archive';
import { typeStrs } from '@/utils/helpers';
import { useI18nStore } from '@/store/i18n';

const { t } = useI18n();
const i18nStore = useI18nStore();

const move = ref<MoveListRow | null>(null);
const loading = ref(true);

onLoad(async (options) => {
    const id = Number(options?.id ?? 0);
    void i18nStore.ensureLoaded();
    try {
        const list = await loadMoveList();
        move.value = list.find((m) => m.id === id) ?? null;
    } catch (err) {
        console.warn('[archive] 招式详情加载失败', err);
    } finally {
        loading.value = false;
    }
});

const name = computed(() =>
    move.value ? (i18nStore.moveName(move.value.id) ?? `move-${move.value.id}`) : '',
);
const typeSlug = computed(() => (move.value ? (typeStrs[move.value.typeId] ?? 'normal') : 'normal'));
const categoryName = computed(
    () =>
        (move.value?.damageClassId && i18nStore.moveDamageClassName(move.value.damageClassId)) ||
        t('archive.dash'),
);
const targetName = computed(
    () =>
        (move.value?.targetId && i18nStore.moveTargetName(move.value.targetId)) || t('archive.dash'),
);
const powerText = computed(() =>
    move.value && move.value.power > 0 ? String(move.value.power) : t('archive.dash'),
);
const accuracyText = computed(() =>
    move.value && move.value.accuracy > 0 ? String(move.value.accuracy) : t('archive.dash'),
);
const priorityText = computed(() => {
    const p = move.value?.priority ?? 0;
    return p > 0 ? `+${p}` : String(p);
});
</script>
