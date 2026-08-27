<template>
    <view v-if="text || loading" class="archive-section mb-3 p-4">
        <view class="mb-2.5 flex items-center justify-between gap-3">
            <text class="text-lg font-black tracking-[-0.03em] text-[#24262b]">{{ t('detail.pokedex.title') }}</text>
            <text class="rounded-full border border-[#e1e4eb] bg-[#f5f6fa] px-3 py-1 text-[10px] font-black tracking-[0.14em] text-[#8d929c]">DEX</text>
        </view>

        <text v-if="text" class="block text-[15px] font-medium leading-relaxed text-[#4b5060]">{{ text }}</text>
        <text v-else class="block text-sm font-semibold text-[#8d929c]">{{ t('detail.pokedex.loading') }}</text>
    </view>
</template>

<script lang="ts" setup>
import { useI18nStore } from '@/store/i18n';
import { useI18n } from 'vue-i18n';
import { computed, ref, watch } from 'vue';

const props = defineProps<{
    /** 物种 id（同一物种的各形态共享图鉴描述） */
    speciesId: number;
}>();

const { t } = useI18n();
const i18nStore = useI18nStore();

// 直接读 store：描述组加载完成 / 内容语言切换后 store 的 flavor 表重建，
// 计算属性自动刷新，组件内不另存副本（方法内部读 flavor ref，computed 能追踪）。
const text = computed(() =>
    props.speciesId ? i18nStore.speciesFlavorText(props.speciesId) : null,
);
const loading = ref(false);

// 描述组体积大、不随名称预取，进入详情 / 切换形态（物种变化）时按需加载。
watch(
    () => props.speciesId,
    async (sid) => {
        if (!sid) return;
        loading.value = true;
        try {
            await i18nStore.ensureFlavor();
        } finally {
            loading.value = false;
        }
    },
    { immediate: true },
);
</script>
