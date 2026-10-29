<template>
    <view class="min-h-screen page-bg" :style="pageSafeArea">
        <DetailNavbar
            :title="isNew ? t('teams.create') : mode === 'edit' ? t('teams.editTitle') : viewTitle"
            fallback-url="/pages/teams/teams"
        >
            <!-- 编辑已有条目：左槽变「取消」（新建态仍是返回箭头，走 onBackPress 脏检查） -->
            <template v-if="!isNew && mode === 'edit'" #back>
                <button class="nav-cancel" @click="onCancelEdit">{{ t('common.cancel') }}</button>
            </template>
            <template #right>
                <view
                    class="nav-share"
                    :class="{ 'nav-share--disabled': !canShare }"
                    @click="onShare"
                >
                    <!-- #ifdef MP-WEIXIN -->
                    <text class="ic text-[20px]">{{ glyph('share') }}</text>
                    <!-- #endif -->
                    <!-- #ifndef MP-WEIXIN -->
                    <svg data-ic="share" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5">
                        <path d="M12 3v12"></path>
                        <path d="m8 7 4-4 4 4"></path>
                        <path d="M4 11v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8"></path>
                    </svg>
                    <!-- #endif -->
                </view>
                <view v-if="isNew || mode === 'edit'" class="save-trigger" :class="{ 'save-trigger--busy': store.saving }" @click="onSave">
                    <text>{{ store.saving ? t('teams.saving') : t('teams.save') }}</text>
                </view>
                <view v-else class="nav-edit" @click="enterEdit">
                    <text>{{ t('common.edit') }}</text>
                </view>
            </template>
        </DetailNavbar>

        <scroll-view scroll-y class="edit-scroll mt-[var(--navbar-total-height)] h-[calc(100vh-var(--navbar-total-height))]">
            <!-- 观察模式（仅已有条目）：队名在导航栏，这里只放赛制 / 人数信息行 -->
            <view v-if="!isNew && mode === 'view'" class="mx-auto flex max-w-[720px] flex-col gap-4 px-4 pb-16 pt-3">
                <view class="team-ro-meta">
                    <text class="team-ro-format">
                        {{ payload.format === 'doubles' ? t('teams.formatDoubles') : t('teams.formatSingles') }}
                    </text>
                    <text class="team-ro-count">{{ interp('teams.memberCount', { count: payload.members.length }) }}</text>
                </view>

                <MemberReadonlyCard v-for="(member, i) in payload.members" :key="i" :member="member" />

                <view v-if="payload.members.length === 0" class="team-ro-empty">
                    <text>{{ t('teams.viewEmpty') }}</text>
                </view>
            </view>

            <!-- 编辑模式（新建直接进入） -->
            <view v-else class="mx-auto flex max-w-[720px] flex-col gap-4 px-4 pb-16 pt-3">
                <!-- 名称 + 赛制 -->
                <view class="glass-panel edit-head">
                    <input
                        class="edit-name"
                        :value="store.draftName"
                        :placeholder="t('teams.defaultName')"
                        maxlength="50"
                        @input="onNameInput"
                    />
                    <view class="format-row">
                        <text class="format-row__label">{{ t('teams.formatLabel') }}</text>
                        <FormatSwitch :model-value="payload.format" @update:model-value="setFormat" />
                    </view>
                </view>

                <!-- 成员 -->
                <MemberCard
                    v-for="(member, i) in payload.members"
                    :key="i"
                    :member="member"
                    :format="payload.format"
                    @change="(m: TeamMember) => onMemberChange(i, m)"
                    @remove="onRemoveMember(i)"
                />

                <view v-if="payload.members.length < MAX_MEMBERS" class="add-member" @click="pickerVisible = true">
                    <!-- #ifdef MP-WEIXIN -->
                    <text class="ic text-[16px]">{{ glyph('plus') }}</text>
                    <!-- #endif -->
                    <!-- #ifndef MP-WEIXIN -->
                    <svg data-ic="plus" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" class="h-4 w-4"><path d="M12 5v14M5 12h14"></path></svg>
                    <!-- #endif -->
                    <text>{{ t('teams.addMember') }}</text>
                    <text class="add-member__count">{{ interp('teams.memberCount', { count: payload.members.length }) }}</text>
                </view>
            </view>
        </scroll-view>

        <PokemonPicker
            v-if="isNew || mode === 'edit'"
            v-model:visible="pickerVisible"
            :title="t('teams.title')"
            :form-title="t('teams.pickForm')"
            :search-placeholder="t('teams.pickerSearch')"
            @pick="onPick"
        />

        <!-- 分享码导出：直接编码当前草稿（无需先保存） -->
        <ShareExportDialog
            v-model:visible="exportVisible"
            :title="t('teams.exportTitle')"
            :hint="t('teams.exportHint')"
            :code="exportCode"
            :copy-label="t('teams.copyCode')"
            @copy="onCopyCode"
        >
            <TeamSharePreview :name="shareName" :payload="store.draftPayload" />
        </ShareExportDialog>

        <LoginModal v-model:visible="showLogin" @success="onLoginSuccess" />
    </view>
</template>

<script lang="ts" setup>
import { usePageSafeArea } from '@/composables/usePageSafeArea';
import { computed, ref } from 'vue';
import { onBackPress, onLoad } from '@dcloudio/uni-app';
import { useI18n } from 'vue-i18n';
import { interp } from '@/services/i18n/ui-i18n';
import DetailNavbar from '@/components/shared/DetailNavbar.vue';
import LoginModal from '@/components/shared/LoginModal.vue';
import FormatSwitch from '@/components/meta/FormatSwitch.vue';
import PokemonPicker from '@/components/shared/PokemonPicker.vue';
import MemberCard from '@/components/teams/MemberCard.vue';
import MemberReadonlyCard from '@/components/teams/MemberReadonlyCard.vue';
import ShareExportDialog from '@/components/share/ShareExportDialog.vue';
import TeamSharePreview from '@/components/share/TeamSharePreview.vue';
import { useTeamsStore, type SaveOutcome } from '@/store/teams';
import { authGate } from '@/services/session/authGate';
import { encodeShareCode } from '@/services/share/share-code';
import { glyph } from '@/components/icon/glyphs';
import {
    LIMITS,
    emptyMember,
    type TeamFormat,
    type TeamMember,
    type TeamPayload,
} from '@/services/teams/team-model'

const pageSafeArea = usePageSafeArea();

const MAX_MEMBERS = LIMITS.maxMembers;

const { t } = useI18n();
const store = useTeamsStore();

const isNew = computed(() => store.currentId === null);
const payload = computed<TeamPayload>(() => store.draftPayload);

// ── 观察 / 编辑双模式：打开已有条目默认观察，新建（含分享码导入）直接编辑 ──
const mode = ref<'view' | 'edit'>('view');
const viewTitle = computed(() => store.draftName || t('teams.defaultName'));

const pickerVisible = ref(false);

// ── 分享码导出（编码当前草稿，不要求先保存；空队伍禁用） ──
const exportVisible = ref(false);
const exportCode = ref('');
const canShare = computed(() => store.draftPayload.members.length > 0);
const shareName = computed(() => store.draftName.trim() || t('teams.defaultName'));

function onShare(): void {
    if (!canShare.value) return;
    exportCode.value = encodeShareCode('team', store.draftPayload);
    exportVisible.value = true;
}

function onCopyCode(): void {
    uni.setClipboardData({
        data: exportCode.value,
        success: () => uni.showToast({ title: t('teams.codeCopied'), icon: 'none' }),
    });
}

// ── 编辑快照：进入编辑时记录，取消时还原（保存成功后刷新为最新） ──
interface Snapshot {
    name: string;
    payload: TeamPayload;
}
const snapshot = ref<Snapshot | null>(null);

function clonePayload(p: TeamPayload): TeamPayload {
    return JSON.parse(JSON.stringify(p)) as TeamPayload;
}

const isDirty = computed(
    () =>
        !!snapshot.value &&
        (snapshot.value.name !== store.draftName ||
            JSON.stringify(snapshot.value.payload) !== JSON.stringify(store.draftPayload)),
);

onLoad(async (options) => {
    if (options?.id) {
        try {
            await store.open(options.id);
        } catch {
            uni.navigateBack();
            return;
        }
        mode.value = 'view';
        return;
    }
    // 无 id = 新建（teams 列表已 beginCreate，这里幂等兜底）
    store.beginCreate(t('teams.defaultName'));
    mode.value = 'edit';
    snapshot.value = { name: store.draftName, payload: clonePayload(store.draftPayload) };
});

function enterEdit(): void {
    snapshot.value = { name: store.draftName, payload: clonePayload(store.draftPayload) };
    mode.value = 'edit';
}

function restoreSnapshot(): void {
    if (!snapshot.value) return;
    store.setName(snapshot.value.name);
    store.replacePayload(snapshot.value.payload);
}

/** 编辑态「取消」/ 系统返回：dirty 先确认；已有条目放弃后回观察模式，新建则离开页面。 */
function cancelEdit(leavePage: boolean): void {
    const finish = () => {
        restoreSnapshot();
        if (leavePage) {
            store.clearCurrent();
            uni.navigateBack();
        } else {
            mode.value = 'view';
        }
    };
    if (!isDirty.value) {
        finish();
        return;
    }
    uni.showModal({
        title: t('teams.exitConfirmTitle'),
        content: t('teams.discardCloudDesc'),
        confirmText: t('teams.discard'),
        cancelText: t('common.cancel'),
        success: (r) => {
            if (r.confirm) finish();
        },
    });
}

function onCancelEdit(): void {
    cancelEdit(isNew.value);
}

// 系统返回手势 / 导航栏返回：编辑态拦下走取消流程；观察态走默认返回
onBackPress(() => {
    if (mode.value !== 'edit') return false;
    cancelEdit(isNew.value);
    return true;
});

// ── 名称 / 赛制 ──
// uni <input> H5 是原生 Event，小程序值在 e.detail.value；统一按 any 处理
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function onNameInput(e: any): void {
    store.setName(e.detail?.value ?? e.target?.value ?? '');
}
function setFormat(format: TeamFormat): void {
    store.replacePayload({ ...payload.value, format });
}

// ── 成员增删改 ──
function onMemberChange(index: number, member: TeamMember): void {
    const members = payload.value.members.slice();
    members.splice(index, 1, member);
    store.replacePayload({ ...payload.value, members });
}
function onRemoveMember(index: number): void {
    store.replacePayload({
        ...payload.value,
        members: payload.value.members.filter((_, i) => i !== index),
    });
}
function onPick(speciesId: number, formId?: number): void {
    if (payload.value.members.length >= MAX_MEMBERS) return;
    const members = [...payload.value.members, emptyMember(speciesId, formId)];
    store.replacePayload({ ...payload.value, members });
}

// ── 保存 ──
async function onSave(): Promise<void> {
    let outcome: SaveOutcome;
    try {
        outcome = await store.save();
    } catch {
        // 非 RestRequestError（网络中断等）：兜底提示，避免静默失败
        uni.showToast({ title: t('teams.errorGeneric'), icon: 'none' });
        return;
    }

    if (outcome.status === 'saved') {
        snapshot.value = { name: store.draftName, payload: clonePayload(store.draftPayload) };
        mode.value = 'view';
        uni.showToast({ title: t('teams.saved'), icon: 'none' });
    } else if (outcome.status === 'aborted') {
        // 静默：用户主动关闭了登录层
    } else if (outcome.status === 'invalid') {
        uni.showToast({ title: invalidText(outcome.reason), icon: 'none' });
    } else if (outcome.reason === 'session-expired') {
        // 会话已失效且刷新失败 → 引导重新登录
        uni.showToast({ title: t('teams.errorAuth'), icon: 'none' });
    } else {
        uni.showToast({ title: outcome.message ?? t('teams.errorGeneric'), icon: 'none' });
    }
}

function invalidText(reason: 'name-required' | 'name-too-long' | 'payload-too-large'): string {
    if (reason === 'name-required') return t('teams.errorNameRequired');
    if (reason === 'name-too-long') return t('teams.errorNameTooLong');
    return t('teams.errorPayloadTooLarge');
}

// ── LoginModal：保存触发 requireLogin 时显示；成功 → 结算 → store.save 继续 ──
const showLogin = computed({
    get: () => authGate.visible.value,
    set: (v) => {
        authGate.visible.value = v;
    },
});
function onLoginSuccess(): void {
    authGate.notifySuccess();
}
</script>

<style lang="scss" scoped>
.edit-scroll {
    width: 100%;
}

.save-trigger {
    padding: 6px 14px;
    border-radius: 999px;
    background: linear-gradient(135deg, #ff8a7e, #e04f47);
    color: #ffffff;
    font-size: 13px;
    font-weight: 800;
    box-shadow: 0 8px 18px rgba(224, 79, 71, 0.22);

    &:active {
        opacity: 0.85;
    }
}

.nav-share {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    margin-right: 6px;
    border-radius: 999px;
    color: #5d6470;

    &:active {
        background: #f1f3f8;
    }
}

.nav-share--disabled {
    color: #d3d6dd;
}

.nav-cancel {
    display: flex;
    align-items: center;
    height: 36px;
    margin: 0;
    padding: 0 4px;
    color: #5d6470;
    font-size: 14px;
    font-weight: 700;
    background: transparent;

    &::after {
        border: none !important;
    }

    &:active {
        color: #24262b;
    }
}

.nav-edit {
    padding: 6px 14px;
    border-radius: 999px;
    color: #ffffff;
    font-size: 13px;
    font-weight: 800;
    background: linear-gradient(135deg, #ff8a7e, #e04f47);
    box-shadow: 0 8px 18px rgba(224, 79, 71, 0.22);

    &:active {
        opacity: 0.85;
    }
}

.team-ro-meta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 4px;
}

.team-ro-count {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 12px;
    font-weight: 800;
    color: #9aa0ab;
}

.team-ro-format {
    padding: 3px 10px;
    border: 1px solid #dfe3ea;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 800;
    color: #5d6470;
    background: #ffffff;
}

.team-ro-empty {
    padding: 30px 20px;
    font-size: 13px;
    font-weight: 600;
    color: #a6abb5;
    text-align: center;
}

.save-trigger--busy {
    opacity: 0.6;
}

.edit-head {
    display: flex;
    flex-direction: column;
    padding: 14px;
}

.edit-name {
    height: 46px;
    padding: 0 12px;
    border-radius: 14px;
    background: #f5f6fa;
    font-size: 16px;
    font-weight: 800;
    color: #24262b;
}

.format-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 12px;
}

.format-row__label {
    font-size: 13px;
    font-weight: 700;
    color: #6f7682;
}

.add-member {
    display: flex;
    align-items: center;
    gap: 8px;
    height: 52px;
    padding: 0 16px;
    border: 1px dashed #d2d6de;
    border-radius: 18px;
    background: rgba(255, 255, 255, 0.7);
    color: #6f7682;
    font-size: 14px;
    font-weight: 800;
}

.add-member__count {
    margin-left: auto;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 12px;
    font-weight: 800;
    color: #b0b5bf;
}
</style>
