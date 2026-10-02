<template>
    <view class="min-h-screen page-bg" :style="{ paddingTop: 'var(--status-bar-height)' }">
        <DetailNavbar :title="t('teams.title')" fallback-url="/pages/data/data" />

        <scroll-view scroll-y class="teams-scroll mt-[calc(var(--status-bar-height)+52px)] h-[calc(100vh-var(--status-bar-height)-52px)]">
            <view class="mx-auto flex max-w-[720px] flex-col gap-4 px-4 pb-12 pt-3">
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
                    <button class="create-btn" @click="onCreate">
                        <!-- #ifdef MP-WEIXIN -->
                        <text class="ic text-[16px]">{{ glyph('plus') }}</text>
                        <!-- #endif -->
                        <!-- #ifndef MP-WEIXIN -->
                        <svg data-ic="plus" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" class="h-4 w-4"><path d="M12 5v14M5 12h14"></path></svg>
                        <!-- #endif -->
                        {{ t('teams.create') }}
                    </button>

                    <view v-if="store.summaries.length" class="glass-panel">
                        <TeamListRow
                            v-for="team in store.summaries"
                            :key="team.id"
                            :team="team"
                            @select="onOpen(team)"
                            @menu="onMenu(team)"
                        />
                    </view>
                    <view v-else-if="!store.listLoading" class="empty-state">
                        <text class="empty-state__title">{{ t('teams.emptyTitle') }}</text>
                        <text class="empty-state__desc">{{ t('teams.emptyDesc') }}</text>
                    </view>
                </template>
            </view>
        </scroll-view>

        <!-- 行内「⋯」操作菜单 -->
        <OptionSheet
            :visible="menuVisible"
            :title="menuTeam?.name ?? ''"
            :options="menuOptions"
            :search-threshold="99"
            @update:visible="(v) => (menuVisible = v)"
            @update:model-value="onMenuAction"
        />

        <LoginModal v-model:visible="showLogin" @success="onLoginSuccess" />
    </view>
</template>

<script lang="ts" setup>
import { computed, ref } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { useI18n } from 'vue-i18n';
import { interp } from '@/services/i18n/ui-i18n';
import DetailNavbar from '@/components/shared/DetailNavbar.vue';
import OptionSheet, { type SheetOption } from '@/components/shared/OptionSheet.vue';
import LoginModal from '@/components/shared/LoginModal.vue';
import TeamListRow from '@/components/teams/TeamListRow.vue';
import { useTeamsStore } from '@/store/teams';
import { authGate } from '@/services/session/authGate';
import type { TeamSummary } from '@/services/api/teams';
import { glyph } from '@/components/icon/glyphs';

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

// ── 行内菜单 ──
const menuTeam = ref<TeamSummary | null>(null);
const menuVisible = ref(false);
const menuOptions = computed<SheetOption[]>(() => [
    { id: 'rename', label: t('teams.rename') },
    { id: 'delete', label: t('teams.delete') },
]);

function onMenu(team: TeamSummary): void {
    menuTeam.value = team;
    menuVisible.value = true;
}

async function onMenuAction(id: string | string[]): Promise<void> {
    const team = menuTeam.value;
    if (!team || typeof id !== 'string') return;
    if (id === 'rename') onOpen(team);
    else if (id === 'delete') await confirmDelete(team);
}

async function confirmDelete(team: TeamSummary): Promise<void> {
    const confirmed = await new Promise<boolean>((resolve) => {
        uni.showModal({
            title: t('teams.delete'),
            content: interp('teams.confirmDelete', { name: team.name }),
            confirmText: t('teams.delete'),
            cancelText: t('common.cancel'),
            success: (r) => resolve(!!r.confirm),
            fail: () => resolve(false),
        });
    });
    if (!confirmed) return;

    const out = await store.remove(team.id);
    if ('removed' in out) {
        uni.showToast({ title: t('teams.delete'), icon: 'none' });
    }
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
