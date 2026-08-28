<template>
    <view class="archive-page min-h-screen page-bg" :style="{ paddingTop: 'var(--status-bar-height)', paddingBottom: '40px' }">
        <DetailNavbar :title="t('archive.itemDetailTitle')" fallback-url="/pages/archive/items" />

        <scroll-view
            scroll-y
            class="relative z-10 mt-[calc(var(--status-bar-height)+52px)] h-[calc(100vh-var(--status-bar-height)-52px)] px-4 pb-6"
        >
            <view class="mx-auto flex max-w-[720px] flex-col gap-3 pt-3">
                <!-- 头部：大图标 + 名称 -->
                <view class="glass-panel flex items-center gap-4 px-5 py-5">
                    <view class="flex h-28 w-28 flex-shrink-0 items-center justify-center rounded-3xl bg-[#f5f6fa] shadow-[inset_0_1px_0_#fff]">
                        <ItemIcon :id="itemId" size="lg" />
                    </view>
                    <view class="min-w-0 flex-1">
                        <text class="block text-xl font-black leading-6 tracking-[-0.02em] text-[#24262b]">{{ name }}</text>
                        <text class="mt-1 block text-[12px] font-bold text-[#8d929c]">#{{ String(itemId).padStart(4, '0') }}</text>
                    </view>
                </view>

                <text class="section-label">{{ t('archive.sectionDescription') }}</text>
                <FlavorTextCard kind="item" :id="itemId" />
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
import ItemIcon from '@/components/archive/ItemIcon.vue';
import { useI18nStore } from '@/store/i18n';

const { t } = useI18n();
const i18nStore = useI18nStore();

const itemId = ref(0);

onLoad((options) => {
    itemId.value = Number(options?.id ?? 0);
    void i18nStore.ensureLoaded();
});

const name = computed(
    () => (itemId.value && i18nStore.itemName(itemId.value)) || `item-${itemId.value}`,
);
</script>
