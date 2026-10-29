<template>
    <view class="min-h-screen page-bg" :style="pageSafeArea">
        <DetailNavbar :title="t('teams.title')" fallback-url="/pages/data/data">
            <template v-if="canManage" #right>
                <view class="nav-edit" :class="{ 'nav-edit--active': managing }" @click="toggleManage">
                    {{ managing ? t('common.done') : t('common.manage') }}
                </view>
            </template>
        </DetailNavbar>

        <scroll-view scroll-y class="teams-scroll mt-[var(--navbar-total-height)] h-[calc(100vh-var(--navbar-total-height))]">
            <view class="mx-auto flex max-w-[720px] flex-col gap-4 px-4 pt-3" :class="managing ? 'pb-28' : 'pb-12'">
                <!-- 未登录引导 -->
                <view v-if="store.needsLogin" class="login-nudge">
                    <view class="login-nudge__icon">
                        <!-- #ifdef MP-WEIXIN -->
                        <text class="ic text-[28px]">{{ glyph('log-in') }}</text>
                        <!-- #endif -->
                        <!-- #ifndef MP-WEIXIN -->
                        <svg data-ic="log-in" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-7 w-7">
                            <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path>
                            <polyline points="10 17 15 12 10 7"></polyline>
                            <line x1="15" y1="12" x2="3" y2="12"></line>
                        </svg>
                        <!-- #endif -->
                    </view>
                    <text class="login-nudge__title">{{ t('teams.loginTitle') }}</text>
                    <text class="login-nudge__desc">{{ t('teams.loginDesc') }}</text>
                    <button class="login-nudge__btn" @click="authGate.open()">{{ t('teams.loginAction') }}</button>
                </view>

                <template v-else>
                    <view v-if="!managing" class="action-row">
                        <button class="action-btn action-btn--primary" @click="onCreate">
                            <!-- #ifdef MP-WEIXIN -->
                            <text class="ic text-[16px]">{{ glyph('plus') }}</text>
                            <!-- #endif -->
                            <!-- #ifndef MP-WEIXIN -->
                            <svg data-ic="plus" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" class="h-4 w-4"><path d="M12 5v14M5 12h14"></path></svg>
                            <!-- #endif -->
                            {{ t('teams.create') }}
                        </button>

                        <button class="action-btn action-btn--ghost" @click="onOpenImport">{{ t('teams.importCode') }}</button>
                    </view>

                    <view v-if="store.summaries.length" class="glass-panel">
                        <TeamListRow
                            v-for="team in store.summaries"
                            :key="team.id"
                            :team="team"
                            :selecting="managing"
                            :selected="selectedIds.includes(team.id)"
                            @select="onOpen(team)"
                            @toggle-select="toggleSelect(team.id)"
                        />
                    </view>
                    <view v-else-if="!store.listLoading" class="empty-state">
                        <text class="empty-state__title">{{ t('teams.emptyTitle') }}</text>
                        <text class="empty-state__desc">{{ t('teams.emptyDesc') }}</text>
                    </view>
                </template>
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
            :title="t('teams.importTitle')"
            :hint="t('teams.importHint')"
            :placeholder="t('teams.importPlaceholder')"
            :confirm-label="t('teams.importConfirm')"
            :paste-label="t('teams.paste')"
            :error="importError"
            @update:visible="onImportVisible"
            @confirm="onImportConfirm"
        />

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
import TeamListRow from '@/components/teams/TeamListRow.vue';
import ShareImportDialog from '@/components/share/ShareImportDialog.vue';
import { useTeamsStore } from '@/store/teams';
import { authGate } from '@/services/session/authGate';
import { decodeShareCode, ShareCodeError } from '@/services/share/share-code';
import { normalizePayload } from '@/services/teams/team-model';
import type { TeamSummary } from '@/services/api/teams';
import { glyph } from '@/components/icon/glyphs'

const pageSafeArea = usePageSafeArea();

const { t } = useI18n();
const store = useTeamsStore();

onLoad(async () => {
    try {
        await store.load(true);
    } catch (err) {
        console.warn('[teams] 加载失败', err);
    }
});

// ── 新建 / 打开 ──
function onCreate(): void {
    store.beginCreate(t('teams.defaultName'));
    uni.navigateTo({ url: '/pages/teams/team-edit' });
}
function onOpen(team: TeamSummary): void {
    uni.navigateTo({ url: `/pages/teams/team-edit?id=${team.id}` });
}

// ── 批量管理（导航栏「编辑」进入；管理态点行仍进编辑页，勾选圈只负责选中） ──
const managing = ref(false);
const selectedIds = ref<string[]>([]);
const deleting = ref(false);

const canManage = computed(() => !store.needsLogin && store.summaries.length > 0);
const allSelected = computed(
    () => store.summaries.length > 0 && selectedIds.value.length === store.summaries.length,
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
    selectedIds.value = allSelected.value ? [] : store.summaries.map((team) => team.id);
}

async function onDeleteSelected(): Promise<void> {
    const ids = selectedIds.value.slice();
    if (!ids.length || deleting.value) return;
    const confirmed = await new Promise<boolean>((resolve) => {
        uni.showModal({
            title: t('teams.delete'),
            content: interp('teams.confirmDeleteMany', { count: ids.length }),
            confirmText: t('teams.delete'),
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
        // 顺序删除：云端条目首个过 confirmLogin，并发会重复弹登录层
        for (const id of ids) {
            // eslint-disable-next-line no-await-in-loop -- 串行是本意，见上
            const out = await store.remove(id);
            if (!('removed' in out)) break; // aborted：用户关掉登录层
            removed++;
        }
    } catch (err) {
        console.warn('[teams] 批量删除失败', err);
        uni.showToast({ title: t('teams.errorGeneric'), icon: 'none' });
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

// ── 分享码：导入（解析后走「新建」流程进编辑页，保存闸门 / 冲突校验全部复用） ──
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
            e instanceof ShareCodeError && e.reason === 'bad-version' ? t('teams.errNewerVersion') : t('teams.errBadCode');
        return;
    }
    if (decoded.kind !== 'team') {
        importVisible.value = false;
        uni.showToast({ title: t('teams.errOtherKind'), icon: 'none' });
        return;
    }
    store.beginCreate(t('teams.defaultName'));
    store.replacePayload(normalizePayload(decoded.payload));
    importVisible.value = false;
    uni.navigateTo({ url: '/pages/teams/team-edit' });
}

// ── LoginModal（绑同一个 authGate） ──
const showLogin = computed({
    get: () => authGate.visible.value,
    set: (v) => {
        authGate.visible.value = v;
    },
});
function onLoginSuccess(): void {
    authGate.notifySuccess();
    void store.load(true);
}
</script>

<style lang="scss" scoped>
.teams-scroll {
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

.login-nudge {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 30px 22px;
    border-radius: 24px;
    background: rgba(255, 255, 255, 0.94);
    box-shadow: 0 18px 42px rgba(48, 55, 72, 0.08);
}

.login-nudge__icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 52px;
    height: 52px;
    border-radius: 18px;
    background: linear-gradient(135deg, #ff8a7e, #e04f47);
    color: #ffffff;
}

.login-nudge__title {
    margin-top: 6px;
    font-size: 16px;
    font-weight: 900;
    color: #24262b;
}

.login-nudge__desc {
    font-size: 13px;
    font-weight: 600;
    line-height: 1.5;
    color: #8d929c;
    text-align: center;
}

.login-nudge__btn {
    margin-top: 10px;
    width: 100%;
    height: 46px;
    line-height: 46px;
    border-radius: 14px;
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
