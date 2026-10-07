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

                <view v-if="visibleRecords.length" class="glass-panel">
                    <TemplateListRow
                        v-for="rec in visibleRecords"
                        :key="rec.id"
                        :record="rec"
                        @select="onOpen(rec)"
                        @menu="onMenu(rec)"
                    />
                </view>
                <view v-else class="empty-state">
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
    </view>
</template>

<script lang="ts" setup>
import { usePageSafeArea } from '@/composables/usePageSafeArea';
import { computed, ref } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { useI18n } from 'vue-i18n';
import { interp } from '@/services/i18n/ui-i18n';
import DetailNavbar from '@/components/shared/DetailNavbar.vue';
import OptionSheet, { type SheetOption } from '@/components/shared/OptionSheet.vue';
import TemplateListRow from '@/components/templates/TemplateListRow.vue';
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

/** 列表只显示有效记录（deleted 墓碑对用户隐藏） */
const visibleRecords = computed(() => store.records.filter((r) => r.sync !== 'deleted'));

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
    if ('removed' in out) {
        uni.showToast({ title: t('templates.toastDeleted'), icon: 'none' });
    } else if ('tombstoned' in out) {
        // 未登录删云端条目：标记待删除，登录后补删
        uni.showToast({ title: t('templates.stateDeleted'), icon: 'none' });
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
