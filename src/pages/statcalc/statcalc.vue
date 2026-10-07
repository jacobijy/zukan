<template>
    <view
        class="statcalc-page min-h-screen page-bg"
        :style="[pageSafeArea, { paddingBottom: '40px' }]"
    >
        <DetailNavbar :title="t('statcalc.title')" @back="goBack" />

        <scroll-view
            scroll-y
            class="relative z-10 h-[calc(100vh-var(--navbar-total-height))] mt-[var(--navbar-total-height)] px-4 pb-6"
        >
            <view class="mx-auto max-w-[720px] flex flex-col gap-3 pt-3">
                <!-- 共享配置编辑内核：规则分段 + 宝可梦/等级/性格 + 六维输入与实时结果 -->
                <TemplateBuildEditor v-model="draft" v-model:level="level" />

                <button class="sc-save-template" @click="goSaveTemplate">
                    <!-- #ifdef MP-WEIXIN -->
                    <text class="ic text-[16px]">{{ glyph('bookmark') }}</text>
                    <!-- #endif -->
                    <!-- #ifndef MP-WEIXIN -->
                    <svg data-ic="bookmark" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4">
                        <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"></path>
                    </svg>
                    <!-- #endif -->
                    <text>{{ t('templates.saveTemplate') }}</text>
                </button>

                <button class="sc-reset" @click="resetAll">{{ t('common.reset') }}</button>
            </view>
        </scroll-view>
    </view>
</template>

<script lang="ts" setup>
import { usePageSafeArea } from '@/composables/usePageSafeArea';
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { glyph } from '@/components/icon/glyphs';
import DetailNavbar from '@/components/shared/DetailNavbar.vue';
import TemplateBuildEditor from '@/components/templates/TemplateBuildEditor.vue';
import { useTemplatesStore } from '@/store/templates';
import type { TemplatePayload } from '@/services/templates/template-model';

const pageSafeArea = usePageSafeArea();

const { t } = useI18n();
const templatesStore = useTemplatesStore();

// 当前计算配置（纯计算用）；null = 未选宝可梦
const draft = ref<TemplatePayload | null>(null);
const level = ref(50);

const resetAll = () => {
    draft.value = null;
    level.value = 50;
};

/** 存为模板：把当前配置带入模板新建编辑页（预填，保存/草稿由编辑页接管）。 */
const goSaveTemplate = () => {
    if (!draft.value) {
        uni.showToast({ title: t('statcalc.toast.noData'), icon: 'none' });
        return;
    }
    templatesStore.beginCreate(t('templates.defaultName'), draft.value);
    uni.navigateTo({ url: '/pages/templates/template-edit' });
};

const goBack = () => {
    // DetailNavbar 已处理返回导航
};
</script>

<style scoped>
.sc-save-template {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    height: 48px;
    border-radius: 16px;
    color: #ffffff;
    font-size: 15px;
    font-weight: 800;
    background: linear-gradient(135deg, #ff8a7e, #e04f47);
    box-shadow: 0 12px 24px rgba(224, 79, 71, 0.22);
}

.sc-save-template::after {
    border: none !important;
}

.sc-reset {
    height: 46px;
    line-height: 46px;
    border-radius: 16px;
    background: #eef0f5;
    color: #6f7682;
    font-size: 15px;
    font-weight: 800;
}

.sc-reset::after {
    border: none !important;
}
</style>
