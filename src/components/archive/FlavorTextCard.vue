<template>
    <view class="glass-panel px-5 py-4">
        <view v-if="loading" class="flex items-center gap-3 py-2 text-[#8d929c]">
            <view class="field-loader" style="width: 22px; height: 22px; border-width: 2px"></view>
            <text class="text-xs font-black tracking-[0.14em]">{{ t('archive.loadingText') }}</text>
        </view>

        <template v-else>
            <text v-if="flavorText" class="block text-[14px] font-medium leading-6 text-[#4a4f5a]">{{ flavorText }}</text>
            <text v-else-if="!effectText" class="block text-[13px] font-medium text-[#9da2ad]">{{ t('archive.noDescription') }}</text>

            <!-- 效果简述：ProseEffect 上游仅英文 bundle 有数据，非英文语言隐藏整段 -->
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
import type { FlavorFamily } from '@/services/resources/resourceManager';

const props = defineProps<{
    kind: 'move' | 'ability' | 'item';
    id: number;
}>();

/** 资料中心栏目 kind → 描述组实体族（决定拉哪个分片文件） */
const FAMILY_OF_KIND: Record<'move' | 'ability' | 'item', FlavorFamily> = {
    move: 'moves',
    ability: 'abilities',
    item: 'items',
};

const { t } = useI18n();
const i18nStore = useI18nStore();
const loading = ref(false);

// 直接读 store：描述组加载完成 / 内容语言切换后自动刷新，组件内不另存副本
// （同 PokedexEntry 的模式）。
const flavorText = computed(() => {
    switch (props.kind) {
        case 'move':
            return i18nStore.moveFlavorText(props.id);
        case 'ability':
            return i18nStore.abilityFlavorText(props.id);
        case 'item':
            return i18nStore.itemFlavorText(props.id);
    }
});

const effectText = computed(() => {
    if (props.kind === 'ability') return i18nStore.abilityEffect(props.id);
    if (props.kind === 'move') return i18nStore.moveEffect(props.id);
    return null;
});

// 描述组按实体族分片、不随名称预取，进入详情时按 kind 映射族按需拉对应片；
// 招式/特性额外加载效果文件（effects.bin），道具没有效果段。
watch(
    () => props.id,
    async (id) => {
        if (!id) return;
        loading.value = true;
        try {
            await i18nStore.ensureFlavorEntry(FAMILY_OF_KIND[props.kind], id);
            if (props.kind !== 'item') await i18nStore.ensureFlavorEffects();
        } finally {
            loading.value = false;
        }
    },
    { immediate: true },
);
</script>
