<template>
    <view v-if="text || loading" class="archive-section dex-entry mb-3 p-4">
        <view class="flex items-center justify-between gap-3">
            <text class="text-lg font-black tracking-[-0.03em] text-[#24262b]">{{ t('detail.pokedex.title') }}</text>
            <text class="rounded-full border border-[#e1e4eb] bg-[#f5f6fa] px-3 py-1 text-[10px] font-black tracking-[0.14em] text-[#8d929c]">DEX</text>
        </view>

        <!-- 描述正文是卡片主体：位于标题与底部版本标签之间 -->
        <text v-if="text" class="dex-entry__text block text-[15px] font-medium leading-relaxed text-[#4b5060]">{{ text }}</text>
        <text v-else class="dex-entry__text block text-sm font-semibold text-[#8d929c]">{{ t('detail.pokedex.loading') }}</text>

        <!--
            版本图标沉到底部、缩小成一排：有软件图标的版本（X/Y 起）才出现，
            gen1–5 无图标版本不在此（那种物种整条不渲染，正文回落最新一条）。
        -->
        <view v-if="iconOptions.length" class="dex-entry__versions">
            <PokedexVersionPicker v-model="selectedVersion" :options="iconOptions" />
        </view>
    </view>
</template>

<script lang="ts" setup>
import { useI18nStore } from '@/store/i18n';
import { useI18n } from 'vue-i18n';
import { computed, ref, watch } from 'vue';
import PokedexVersionPicker from './PokedexVersionPicker.vue';
import { iconFlavorOptions } from '@/constants/versionIcons';

const props = defineProps<{
    /** 物种 id（同一物种的各形态共享图鉴描述） */
    speciesId: number;
}>();

const { t } = useI18n();
const i18nStore = useI18nStore();

// 直接读 store：描述组加载完成 / 内容语言切换后 store 的 flavor 表重建，
// 计算属性自动刷新，组件内不另存副本（方法内部读 flavor ref，computed 能追踪）。
const allVersions = computed(() =>
    props.speciesId ? i18nStore.speciesFlavorVersions(props.speciesId) : [],
);
/** 可切换的版本图标：该物种有描述 ∩ 有软件图标，按 version 升序 */
const iconOptions = computed(() => iconFlavorOptions(allVersions.value));

const selectedVersion = ref<number | null>(null);

// 进入详情 / 切形态（物种变化）/ 分片到达 / 切语言：选中版本一旦不在选项里，
// 就回落到其中最新（version 最大）的一枚；没有任何图标版本时置 null。
watch(
    [() => props.speciesId, iconOptions],
    ([, options]) => {
        if (!options.some((o) => o.version === selectedVersion.value)) {
            selectedVersion.value = options.length ? options[options.length - 1]!.version : null;
        }
    },
    { immediate: true },
);

const text = computed(() => {
    if (!props.speciesId) return null;
    if (selectedVersion.value !== null) {
        return allVersions.value.find((v) => v.version === selectedVersion.value)?.text ?? null;
    }
    // 该物种只有 gen1–5 老版本描述、无图标可切：回落最新一条纯文本
    return i18nStore.speciesFlavorText(props.speciesId);
});

const loading = ref(false);

// 描述组按实体族分片、不随名称预取，进入详情 / 切换形态（物种变化）时按需
// 拉取对应物种族的那一片（片号由 speciesId 算出，跨片自动累积合并）。
watch(
    () => props.speciesId,
    async (sid) => {
        if (!sid) return;
        loading.value = true;
        try {
            await i18nStore.ensureFlavorEntry('species', sid);
        } finally {
            loading.value = false;
        }
    },
    { immediate: true },
);
</script>

<style lang="scss" scoped>
.dex-entry {
    display: flex;
    flex-direction: column;
}

/* 描述正文：卡片主体，标题下留出呼吸、上下垂直居中于标题与标签之间 */
.dex-entry__text {
    margin-top: 12px;
}

/* 版本标签沉底：hairline 分隔，图标本身已缩小到 30px */
.dex-entry__versions {
    margin-top: 14px;
    padding-top: 12px;
    border-top: 1px solid #eef0f4;
}
</style>
