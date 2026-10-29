<template>
    <view class="min-h-screen page-bg" :style="pageSafeArea">
        <DetailNavbar :title="t('templates.title')" fallback-url="/pages/features/features">
            <template v-if="canManage" #right>
                <view class="nav-edit" :class="{ 'nav-edit--active': managing }" @click="toggleManage">
                    {{ managing ? t('common.done') : t('common.manage') }}
                </view>
            </template>
        </DetailNavbar>

        <scroll-view scroll-y class="tpl-scroll mt-[var(--navbar-total-height)] h-[calc(100vh-var(--navbar-total-height))]">
            <view class="mx-auto flex max-w-[720px] flex-col gap-4 px-4 pt-3" :class="managing ? 'pb-28' : 'pb-12'">
                <view v-if="!managing" class="action-row">
                    <button class="action-btn action-btn--primary" @click="onCreate">
                        <!-- #ifdef MP-WEIXIN -->
                        <text class="ic text-[16px]">{{ glyph('plus') }}</text>
                        <!-- #endif -->
                        <!-- #ifndef MP-WEIXIN -->
                        <svg data-ic="plus" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" class="h-4 w-4"><path d="M12 5v14M5 12h14"></path></svg>
                        <!-- #endif -->
                        {{ t('templates.create') }}
                    </button>

                    <button class="action-btn action-btn--ghost" @click="onOpenImport">{{ t('templates.importCode') }}</button>
                </view>

                <!-- 未登录：引导登录查看云端模板（本地草稿仍在下方列出） -->
                <view v-if="store.needsLogin && !managing" class="glass-panel flex flex-col items-center gap-2 px-6 py-8 text-center">
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
                        :selecting="managing"
                        :selected="selectedIds.includes(rec.id)"
                        @select="onOpen(rec)"
                        @toggle-select="toggleSelect(rec.id)"
                    />
                </view>
                <view v-else-if="!store.needsLogin" class="empty-state">
                    <text class="empty-state__title">{{ t('templates.emptyTitle') }}</text>
                    <text class="empty-state__desc">{{ t('templates.emptyDesc') }}</text>
                </view>
            </view>
        </scroll-view>

        <!-- 管理态底部操作条 -->
        <ManageActionBar
            v-if="managing"
            :count="selectedIds.length"
            :all-selected="allSelected"
            :select-all-label="t('common.selectAll')"
            :deselect-all-label="t('common.deselectAll')"
            :delete-label="interp('common.deleteCount', { count: selectedIds.length })"
            @toggle-all="toggleAll"
            @delete="onDeleteSelected"
        />

        <!-- 分享码导入 -->
        <ShareImportDialog
            :visible="importVisible"
            :title="t('templates.importTitle')"
            :hint="t('templates.importHint')"
            :placeholder="t('templates.importPlaceholder')"
            :confirm-label="t('templates.importConfirm')"
            :paste-label="t('templates.paste')"
            :error="importError"
            @update:visible="onImportVisible"
            @confirm="onImportConfirm"
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
import ManageActionBar from '@/components/shared/ManageActionBar.vue';
import TemplateListRow from '@/components/templates/TemplateListRow.vue';
import ShareImportDialog from '@/components/share/ShareImportDialog.vue';
import { authGate } from '@/services/session/authGate';
import { useTemplatesStore, type TemplateRecord } from '@/store/templates';
import { decodeShareCode, ShareCodeError } from '@/services/share/share-code';
import { normalizePayload } from '@/services/templates/template-model';
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

// ── 批量管理（导航栏「编辑」进入；草稿也能选；管理态点行仍进编辑页，勾选圈只负责选中） ──
const managing = ref(false);
const selectedIds = ref<string[]>([]);
const deleting = ref(false);

const canManage = computed(() => visibleRecords.value.length > 0);
const allSelected = computed(
    () => visibleRecords.value.length > 0 && selectedIds.value.length === visibleRecords.value.length,
);

function toggleManage(): void {
    managing.value = !managing.value;
    selectedIds.value = [];
}

function toggleSelect(id: string): void {
    const ids = selectedIds.value;
    selectedIds.value = ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
}

function toggleAll(): void {
    selectedIds.value = allSelected.value ? [] : visibleRecords.value.map((r) => r.id);
}

async function onDeleteSelected(): Promise<void> {
    const ids = selectedIds.value.slice();
    if (!ids.length || deleting.value) return;
    const confirmed = await new Promise<boolean>((resolve) => {
        uni.showModal({
            title: t('templates.delete'),
            content: interp('templates.confirmDeleteMany', { count: ids.length }),
            confirmText: t('templates.delete'),
            cancelText: t('common.cancel'),
            success: (r) => resolve(!!r.confirm),
            fail: () => resolve(false),
        });
    });
    if (!confirmed) return;

    deleting.value = true;
    uni.showLoading({ title: t('common.processing'), mask: true });
    let removed = 0;
    try {
        // 顺序删除：草稿本地直接删，云端条目首个过 confirmLogin，并发会重复弹登录层
        for (const id of ids) {
            // eslint-disable-next-line no-await-in-loop -- 串行是本意，见上
            const out = await store.remove(id);
            if (!('removed' in out)) break; // aborted：用户关掉登录层
            removed++;
        }
    } catch (err) {
        console.warn('[templates] 批量删除失败', err);
        uni.showToast({ title: t('templates.errorGeneric'), icon: 'none' });
    } finally {
        uni.hideLoading();
        deleting.value = false;
    }
    if (removed > 0) {
        uni.showToast({ title: interp('common.deletedCount', { count: removed }), icon: 'none' });
        managing.value = false;
        selectedIds.value = [];
    }
}

// ── 分享码：导入（解析后走「新建」流程进编辑页；未登录可先存草稿，上云闸门复用） ──
const importVisible = ref(false);
const importError = ref('');

function onOpenImport(): void {
    importError.value = '';
    importVisible.value = true;
}

function onImportVisible(v: boolean): void {
    importVisible.value = v;
    if (!v) importError.value = '';
}

function onImportConfirm(text: string): void {
    let decoded;
    try {
        decoded = decodeShareCode(text);
    } catch (e) {
        importError.value =
            e instanceof ShareCodeError && e.reason === 'bad-version'
                ? t('templates.errNewerVersion')
                : t('templates.errBadCode');
        return;
    }
    if (decoded.kind !== 'template') {
        importVisible.value = false;
        uni.showToast({ title: t('templates.errOtherKind'), icon: 'none' });
        return;
    }
    const payload = normalizePayload(decoded.payload);
    if (payload === null) {
        importError.value = t('templates.errBadCode');
        return;
    }
    store.beginCreate(t('templates.defaultName'), payload);
    importVisible.value = false;
    uni.navigateTo({ url: '/pages/templates/template-edit' });
}
</script>

<style lang="scss" scoped>
.tpl-scroll {
    width: 100%;
}

.nav-edit {
    padding: 6px 12px;
    border-radius: 999px;
    color: #5d6470;
    font-size: 13px;
    font-weight: 800;

    &:active {
        background: #f1f3f8;
    }
}

.nav-edit--active {
    color: #e04f47;
}

.action-row {
    display: flex;
    gap: 12px;
}

.action-btn {
    display: flex;
    flex: 1;
    align-items: center;
    justify-content: center;
    gap: 6px;
    height: 46px;
    margin: 0;
    padding: 0;
    border-radius: 14px;
    font-size: 14px;
    font-weight: 800;

    &::after {
        border: none !important;
    }

    &:active {
        transform: scale(0.98);
    }
}

.action-btn--primary {
    color: #ffffff;
    background: linear-gradient(135deg, #ff8a7e, #e04f47);
    box-shadow: 0 12px 24px rgba(224, 79, 71, 0.22);
}

.action-btn--ghost {
    color: #e04f47;
    background: #fff6f5;
    border: 1.5px solid rgba(224, 79, 71, 0.28);
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
