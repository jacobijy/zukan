<template>
    <view class="min-h-screen page-bg" :style="pageSafeArea">
        <DetailNavbar :title="isNew ? t('teams.create') : t('teams.editTitle')" fallback-url="/pages/teams/teams">
            <template #right>
                <view class="save-trigger" :class="{ 'save-trigger--busy': store.saving }" @click="onSave">
                    <text>{{ store.saving ? t('teams.saving') : t('teams.save') }}</text>
                </view>
            </template>
        </DetailNavbar>

        <scroll-view scroll-y class="edit-scroll mt-[var(--navbar-total-height)] h-[calc(100vh-var(--navbar-total-height))]">
            <view class="mx-auto flex max-w-[720px] flex-col gap-4 px-4 pb-16 pt-3">
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

        <MemberPicker v-model:visible="pickerVisible" @pick="onPick" />
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
import FormatSwitch from '@/components/meta/FormatSwitch.vue';
import MemberPicker from '@/components/teams/MemberPicker.vue';
import MemberCard from '@/components/teams/MemberCard.vue';
import { useTeamsStore } from '@/store/teams';
import { authGate } from '@/services/session/authGate';
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

const pickerVisible = ref(false);

onLoad(async (options) => {
    if (options?.id) {
        try {
            await store.open(options.id);
        } catch {
            uni.navigateBack();
        }
        return;
    }
    // 无 id = 新建（teams 列表已 beginCreate，这里幂等兜底）
    store.beginCreate(t('teams.defaultName'));
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
    const outcome = await store.save();

    if (outcome.status === 'saved') {
        uni.showToast({ title: t('teams.saved'), icon: 'none' });
    } else if (outcome.status === 'aborted') {
        // 静默：用户主动关闭了登录层
    } else if (outcome.status === 'invalid') {
        uni.showToast({ title: invalidText(outcome.reason), icon: 'none' });
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
