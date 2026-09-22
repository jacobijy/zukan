<template>
    <view class="glass-panel px-5 py-4">
        <view v-if="loading" class="flex items-center gap-3 py-2 text-[#8d929c]">
            <view class="field-loader" style="width: 22px; height: 22px; border-width: 2px"></view>
            <text class="text-xs font-black tracking-[0.14em]">{{ t('archive.loadingText') }}</text>
        </view>

        <template v-else>
            <text v-if="flavorText" class="block text-[14px] font-medium leading-6 text-[#4a4f5a]">{{ flavorText }}</text>
            <text v-else-if="!effectText" class="block text-[13px] font-medium text-[#9da2ad]">{{ t('archive.noDescription') }}</text>

            <!-- 效果简述：无版本维度；上游仅 en/fr/de，其它内容语言回落英文显示 -->
            <view v-if="effectText" class="mt-3 border-t border-[#eef0f5] pt-3">
                <text class="section-label block !px-0 !pb-1">{{ t('archive.effect') }}</text>
                <text class="block text-[13px] font-medium leading-6 text-[#6f7480]">{{ effectText }}</text>
            </view>
        </template>
    </view>
</template>

<script lang="ts" setup>
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useI18nStore } from '@/store/i18n';

const props = defineProps<{
    /** 招式 id（决定拉哪个 moves flavor 分片） */
    id: number;
}>();

const { t } = useI18n();
const i18nStore = useI18nStore();
const loading = ref(false);

// 直接读 store：分片到达 / 内容语言切换后自动刷新，组件内不另存副本。
const flavorText = computed(() => i18nStore.moveFlavorText(props.id));
const effectText = computed(() => i18nStore.moveEffect(props.id));

// 描述组按实体族分片、不随名称预取，进入详情时按需拉 moves 族那一片 + 招式效果。
watch(
    () => props.id,
    async (id) => {
        if (!id) return;
        loading.value = true;
        try {
            await i18nStore.ensureFlavorEntry('moves', id);
            await i18nStore.ensureMoveEffects();
        } finally {
            loading.value = false;
        }
    },
    { immediate: true },
);
</script>
