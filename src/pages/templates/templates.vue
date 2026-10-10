<template>
    <view class="min-h-screen page-bg" :style="pageSafeArea">
        <DetailNavbar :title="t('templates.title')" fallback-url="/pages/features/features" />

        <scroll-view scroll-y class="tpl-scroll mt-[var(--navbar-total-height)] h-[calc(100vh-var(--navbar-total-height))]">
            <view class="mx-auto flex max-w-[720px] flex-col gap-4 px-4 pb-12 pt-3">
                <button class="create-btn" @click="onCreate">
                    <!-- #ifdef MP-WEIXIN -->
                    <text class="ic text-[16px]">{{ glyph('plus') }}</text>
                    <!-- #endif -->
                    <!-- #ifndef MP-WEIXIN -->
                    <svg data-ic="plus" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" class="h-4 w-4"><path d="M12 5v14M5 12h14"></path></svg>
                    <!-- #endif -->
                    {{ t('templates.create') }}
                </button>

                <!-- 未登录：引导登录查看云端模板（本地草稿仍在下方列出） -->
                <view v-if="store.needsLogin" class="glass-panel flex flex-col items-center gap-2 px-6 py-8 text-center">
                    <view class="mb-1 flex h-12 w-12 items-center justify-center rounded-full bg-[#fde7e5] text-[#e04f47]">
                        <!-- #ifdef MP-WEIXIN -->
                        <text class="ic text-[24px]">{{ glyph('log-in') }}</text>
                        <!-- #endif -->
                        <!-- #ifndef MP-WEIXIN -->
                        <svg data-ic="log-in" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-6 w-6">
                            <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path>
                            <polyline points="10 17 15 12 10 7"></polyline>
                            <line x1="15" y1="12" x2="3" y2="12"></line>
                        </svg>
                        <!-- #endif -->
                    </view>
                    <text class="text-[15px] font-extrabold text-[#6f7682]">{{ t('templates.loginTitle') }}</text>
                    <text class="text-[13px] font-semibold leading-5 text-[#a6abb5]">{{ t('templates.loginDesc') }}</text>
                    <button class="nudge-btn" @click="authGate.open()">{{ t('templates.loginAction') }}</button>
                </view>

                <view v-if="visibleRecords.length" class="glass-panel">
                    <TemplateListRow
                        v-for="rec in visibleRecords"
                        :key="rec.id"
                        :record="rec"
                        @select="onOpen(rec)"
                        @menu="onMenu(rec)"
                    />
                </view>
                <view v-else-if="!store.needsLogin" class="empty-state">
                    <text class="empty-state__title">{{ t('templates.emptyTitle') }}</text>
                    <text class="empty-state__desc">{{ t('templates.emptyDesc') }}</text>
                </view>
            </view>
        </scroll-view>

        <!-- 行内「⋯」操作菜单 -->
        <OptionSheet
            :visible="menuVisible"
            :title="menuRecord?.name ?? ''"
            :options="menuOptions"
            :search-threshold="99"
            @update:visible="(v) => (menuVisible = v)"
            @update:model-value="onMenuAction"
        />

        <!-- 未登录删云端模板 / 保存时 confirmLogin → authGate 打开全局登录层 -->
        <LoginModal v-model:visible="showLogin" @success="onLoginSuccess" />
    </view>
</template>

<script lang="ts" setup>
import { usePageSafeArea } from '@/composables/usePageSafeArea';
import { computed, ref } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { useI18n } from 'vue-i18n';
import { interp } from '@/services/i18n/ui-i18n';
import DetailNavbar from '@/components/shared/DetailNavbar.vue';
import LoginModal from '@/components/shared/LoginModal.vue';
import OptionSheet, { type SheetOption } from '@/components/shared/OptionSheet.vue';
import TemplateListRow from '@/components/templates/TemplateListRow.vue';
import { authGate } from '@/services/session/authGate';
import { useTemplatesStore, type TemplateRecord } from '@/store/templates';
import { glyph } from '@/components/icon/glyphs';

const pageSafeArea = usePageSafeArea();

const { t } = useI18n();
const store = useTemplatesStore();

onLoad(async () => {
    try {
        await store.load();
    } catch (err) {
        console.warn('[templates] 加载失败', err);
    }
});

/** 列表记录：本地草稿 + 云端摘要（已无墓碑，直接取 store.records） */
const visibleRecords = computed(() => store.records);

/** 代理 authGate.visible 供 v-model 绑定（不能直接绑嵌套 ref）。 */
const showLogin = computed({
    get: () => authGate.visible.value,
    set: (v: boolean) => {
        authGate.visible.value = v;
    },
});

async function onLoginSuccess() {
    authGate.notifySuccess();
    try {
        await store.load(true);
    } catch (err) {
        console.warn('[templates] 登录后加载失败', err);
    }
}

// ── 新建 / 打开 ──
function onCreate(): void {
    store.beginCreate(t('templates.defaultName'));
    uni.navigateTo({ url: '/pages/templates/template-edit' });
}
function onOpen(rec: TemplateRecord): void {
    uni.navigateTo({ url: `/pages/templates/template-edit?id=${rec.id}` });
}

// ── 行内菜单 ──
const menuRecord = ref<TemplateRecord | null>(null);
const menuVisible = ref(false);
const menuOptions = computed<SheetOption[]>(() => [
    { id: 'rename', label: t('templates.rename') },
    { id: 'delete', label: t('templates.delete') },
]);

function onMenu(rec: TemplateRecord): void {
    menuRecord.value = rec;
    menuVisible.value = true;
}

async function onMenuAction(id: string | string[]): Promise<void> {
    const rec = menuRecord.value;
    if (!rec || typeof id !== 'string') return;
    if (id === 'rename') onOpen(rec);
    else if (id === 'delete') await confirmDelete(rec);
}

async function confirmDelete(rec: TemplateRecord): Promise<void> {
    const confirmed = await new Promise<boolean>((resolve) => {
        uni.showModal({
            title: t('templates.delete'),
            content: interp('templates.confirmDelete', { name: rec.name }),
            confirmText: t('templates.delete'),
            cancelText: t('common.cancel'),
            success: (r) => resolve(!!r.confirm),
            fail: () => resolve(false),
        });
    });
    if (!confirmed) return;

    const out = await store.remove(rec.id);
    // removed：草稿本地删 / 云端 DELETE 成功；aborted：取消登录，静默
    if ('removed' in out) {
        uni.showToast({ title: t('templates.toastDeleted'), icon: 'none' });
    }
}
</script>

<style lang="scss" scoped>
.tpl-scroll {
    width: 100%;
}

.create-btn {
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

    &::after {
        border: none !important;
    }
}

.nudge-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    margin-top: 8px;
    height: 44px;
    padding: 0 28px;
    border-radius: 16px;
    color: #ffffff;
    font-size: 15px;
    font-weight: 800;
    background: linear-gradient(135deg, #ff8a7e, #e04f47);

    &::after {
        border: none !important;
    }
}

.empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 48px 20px;
}

.empty-state__title {
    font-size: 15px;
    font-weight: 800;
    color: #6f7682;
}

.empty-state__desc {
    font-size: 13px;
    font-weight: 600;
    color: #a6abb5;
    text-align: center;
}
</style>
