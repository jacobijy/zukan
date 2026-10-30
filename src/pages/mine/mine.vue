<template>
    <TabPageShell :title="t('mine.title')" :tabIndex="3" @tab-change="onTabChange">
        <view class="trainer-card glass-panel mb-6" @click="onTrainerCardClick">
            <view class="trainer-card__avatar" @click.stop="onAvatarClick">
                <image
                    v-if="loggedIn && avatarUrl"
                    :src="avatarUrl"
                    mode="aspectFill"
                    class="trainer-card__avatar-img"
                    @error="onAvatarError"
                />
                <PokeballLogo v-else :size="60" variant="blue" />
                <!-- 已登录时提示头像可替换 -->
                <view v-if="loggedIn" class="trainer-card__avatar-badge">
                    <!-- #ifdef MP-WEIXIN -->
                    <text class="ic text-[12px]">{{ glyph('refresh-ccw') }}</text>
                    <!-- #endif -->
                    <!-- #ifndef MP-WEIXIN -->
                    <svg data-ic="refresh-ccw" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" class="h-3 w-3">
                        <path d="M3 12a9 9 0 1 0 3-6.7L3 8"></path>
                        <path d="M3 3v5h5"></path>
                    </svg>
                    <!-- #endif -->
                </view>
            </view>
            <view class="min-w-0 flex-1">
                <text v-if="loggedIn" class="block text-[20px] font-bold leading-6 tracking-[-0.03em] text-[#24262b]">{{ t('mine.trainer') }}</text>
                <text v-else class="block text-[20px] font-bold leading-6 tracking-[-0.03em] text-[#24262b]">{{ t('mine.loggedOut') }}</text>
                <text class="mt-1 block text-[12px] font-semibold leading-4 text-[#8d929c]">
                    {{ loggedIn ? t('mine.loggedInHint') : t('mine.loggedOutHint') }}
                </text>
            </view>
            <view class="trainer-card__badge">
                <text class="block text-[10px] font-bold leading-3 text-[#9da2ad]">{{ t('mine.collected') }}</text>
                <text class="mt-0.5 block font-mono text-[18px] font-black leading-5 tracking-[-0.05em] text-[#24262b]">{{ favoritesCount }}</text>
            </view>
        </view>

        <view class="section-label">{{ t('mine.sectionDex') }}</view>
        <view class="mine-list glass-panel">
            <ListRow
                v-for="(item, index) in menuItems"
                :key="item.title"
                :title="item.title"
                :desc="item.desc"
                :iconClass="item.iconClass"
                :last="index === menuItems.length - 1"
                showChevron
                @click="onMenuTap(item)"
            >
                <template #icon>
                    <HubIcon :name="item.icon" />
                </template>
                <template #meta>
                    <text v-if="item.count !== undefined" class="mine-row__count">{{ item.count }}</text>
                    <text v-else class="text-[11px] font-semibold text-[#b4b8c0]">{{ item.meta }}</text>
                </template>
            </ListRow>
        </view>

        <view class="section-label mt-6">{{ t('mine.sectionStatus') }}</view>
        <view class="status-card glass-panel">
            <view class="status-card__shine"></view>
            <view class="relative z-10 flex items-center justify-between gap-3">
                <view>
                    <text class="block text-[13px] font-bold text-[#3b3f48]">{{ t('mine.statusSynced') }}</text>
                    <text class="mt-1 block text-[12px] font-medium leading-5 text-[#8a8f99]">{{ interp('mine.statusDesc', { count: favoritesCount }) }}</text>
                </view>
                <view class="status-card__meter">
                    <text>{{ favoritesCount }}</text>
                </view>
            </view>
        </view>

        <!-- 账号绑定（仅渲染平台支持且后端已启用的方式；默认不出现） -->
        <AccountBindings :providers="visibleProviders" />
    </TabPageShell>

    <LoginModal v-model:visible="showLogin" @success="onLoginSuccess" />
</template>

<script lang="ts" setup>
import TabPageShell from "@/components/shared/TabPageShell.vue";
import ListRow from "@/components/shared/ListRow.vue";
import LoginModal from "@/components/shared/LoginModal.vue";
import AccountBindings from "@/components/shared/AccountBindings.vue";
import PokeballLogo from "@/components/shared/PokeballLogo.vue";
import HubIcon, { type HubIconName } from '@/components/shared/HubIcon.vue';
import { glyph } from '@/components/icon/glyphs';
import { isAuthenticated } from '@/services/session';
import { devtoolsEnabled } from '@/services/devtools/enabled';
import { authGate } from '@/services/session/authGate';
import { detectPlatform } from '@/infra/platform';
import { selectVisibleProviders } from '@/services/platform/providerConfig';
import { AvatarError, clearAvatar, getAvatar, pickAvatar } from '@/services/profile/avatar';
import { usePokemonStore } from '@/store/pokemon';
import { useI18n } from 'vue-i18n';
import { interp } from '@/services/i18n/ui-i18n';
import { storeToRefs } from 'pinia';
import { computed, ref } from 'vue';
import { onShow } from '@dcloudio/uni-app';

interface MenuItem {
    title: string;
    desc: string;
    meta?: string;
    count?: number;
    icon: HubIconName;
    iconClass: string;
}

const pokemonStore = usePokemonStore();
const { favorites } = storeToRefs(pokemonStore);
const { t } = useI18n();

const favoritesCount = computed(() => favorites.value.length);

/** 代理 authGate.visible 供 v-model 绑定（理由见 index.vue）。 */
const showLogin = computed({
    get: () => authGate.visible.value,
    set: (v: boolean) => { authGate.visible.value = v; },
});

const loggedIn = ref(isAuthenticated());
/** 本机头像（data URL 或 USER_DATA_PATH 文件路径）；空 = 用默认精灵球。 */
const avatarUrl = ref(getAvatar());
const avatarBusy = ref(false);
// 页面由 switchTab 保活、不再重跑 setup，onShow 时刷新登录态与头像
// （用户在别处登录/登出或更换头像后切到本页也能正确反映）
onShow(() => {
    loggedIn.value = isAuthenticated();
    avatarUrl.value = getAvatar();
});

// 平台在页面生命周期内不变；默认（未配置 VITE_AUTH_PROVIDERS）为 []，绑定区不出现。
const visibleProviders = selectVisibleProviders(detectPlatform());

/** 卡片本身只作为未登录时的登录入口；退出登录已移到设置页。 */
function onTrainerCardClick() {
    if (!loggedIn.value) authGate.open();
}

function onAvatarClick() {
    if (!loggedIn.value) {
        authGate.open();
        return;
    }
    if (!avatarUrl.value) {
        void changeAvatar();
        return;
    }
    uni.showActionSheet({
        itemList: [t('mine.avatarChange'), t('mine.avatarReset')],
        success: (res) => {
            if (res.tapIndex === 0) void changeAvatar();
            else if (res.tapIndex === 1) resetAvatar();
        },
        fail: () => {},
    });
}

async function changeAvatar(): Promise<void> {
    if (avatarBusy.value) return;
    avatarBusy.value = true;
    try {
        const src = await pickAvatar();
        if (src) {
            avatarUrl.value = src;
            uni.showToast({ title: t('mine.avatarUpdated'), icon: 'none' });
        }
    } catch (err) {
        console.warn('[mine] 更换头像失败', err);
        const key = err instanceof AvatarError && err.reason === 'too-large' ? 'mine.avatarTooLarge' : 'mine.avatarFailed';
        uni.showToast({ title: t(key), icon: 'none' });
    } finally {
        avatarBusy.value = false;
    }
}

function resetAvatar(): void {
    clearAvatar();
    avatarUrl.value = '';
    uni.showToast({ title: t('mine.avatarUpdated'), icon: 'none' });
}

/** 文件被系统清理 / data URL 失效时回落到默认精灵球。 */
function onAvatarError(): void {
    clearAvatar();
    avatarUrl.value = '';
}

function onLoginSuccess() {
    authGate.notifySuccess();
    loggedIn.value = true;
    uni.showToast({ title: t('mine.toastLoginSuccess'), icon: 'success' });
    // 收藏已在 LoginModal 登录成功时统一从后端刷新（loadFavorites），这里不再本地合并。
}

const menuItems = computed<MenuItem[]>(() => [
    { title: t('mine.menu.settings'), desc: t('mine.menu.settingsDesc'), meta: t('mine.menu.settingsMeta'), icon: 'mine-settings', iconClass: 'list-row__icon--gray' },
    { title: t('mine.menu.favorites'), desc: t('mine.menu.favoritesDesc'), icon: 'mine-fav', iconClass: 'list-row__icon--gold', count: favoritesCount.value },
    { title: t('mine.menu.history'), desc: t('mine.menu.historyDesc'), meta: t('mine.menu.historyMeta'), icon: 'mine-history', iconClass: 'list-row__icon--blue' },
    // dev-only：门禁为假时整行不渲染，生产用户看不到。文案硬编码中文，不进 i18n
    // （往 ui-messages 的 zh/en 两份里塞只有开发者看得到的键是噪音）
    ...(devtoolsEnabled
        ? [{ title: '开发者工具', desc: '加密资源探测、i18n 文本浏览。', meta: 'dev', icon: 'mine-devtools', iconClass: 'list-row__icon--violet' } as MenuItem]
        : []),
]);

function onMenuTap(item: MenuItem) {
    if (item.icon === 'mine-settings') {
        uni.navigateTo({ url: '/pages/settings/settings' });
    } else if (item.icon === 'mine-devtools') {
        uni.navigateTo({ url: '/pages/devtools/devtools' });
    }
}

const onTabChange = (_index: number) => {
    // TabBar handles tab switching internally
};
</script>

<style lang="scss" scoped>
.trainer-card {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 16px;
}

.trainer-card__avatar {
    position: relative;
    flex-shrink: 0;
    width: 60px;
    height: 60px;

    &:active {
        transform: scale(0.96);
    }
}

.trainer-card__avatar-img {
    display: block;
    width: 60px;
    height: 60px;
    border-radius: 18px;
    background: #eef1f6;
    box-shadow: 0 10px 20px rgba(63, 70, 86, 0.12);
}

.trainer-card__avatar-badge {
    position: absolute;
    right: -4px;
    bottom: -4px;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    border-radius: 999px;
    color: #e04f47;
    background: #ffffff;
    box-shadow: 0 3px 8px rgba(48, 55, 72, 0.18);
}

.trainer-card__badge {
    flex-shrink: 0;
    min-width: 58px;
    padding: 9px 10px;
    border-radius: 16px;
    text-align: right;
    background: #f5f6fa;
}

.mine-row__count {
    min-width: 26px;
    padding: 3px 8px;
    border-radius: 999px;
    color: #6f5209;
    font-size: 12px;
    font-weight: 900;
    text-align: center;
    background: #fff0bc;
}

.status-card {
    position: relative;
    padding: 16px;
    overflow: hidden;
}

.status-card__shine {
    position: absolute;
    right: -32px;
    top: -48px;
    width: 130px;
    height: 130px;
    border-radius: 999px;
    background: radial-gradient(circle, rgba(244, 200, 73, 0.18), transparent 67%);
}

.status-card__meter {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    border-radius: 16px;
    color: #4c3506;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 16px;
    font-weight: 900;
    background: linear-gradient(135deg, #ffe7a8 0%, #f4c849 54%, #e99a24 100%);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.38), 0 10px 20px rgba(63, 70, 86, 0.12);
}
</style>
