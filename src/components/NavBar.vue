<template>
  <view
    class="navbar-root fixed top-0 left-0 right-0 z-[1000] border-b border-[#e5e7ee] bg-white shadow-[0_4px_18px_rgba(48,55,72,0.06)]"
    :style="{ paddingTop: 'var(--status-bar-height)' }"
  >
    <view class="navbar-inner relative flex items-center justify-center px-4">
        <!-- 左上角头像：已登录显示本机头像，未登录显示精灵球占位；点击未登录弹登录框 -->
        <view class="navbar-avatar" @click="onAvatarClick">
            <image
                v-if="loggedIn && avatarUrl"
                :src="avatarUrl"
                mode="aspectFill"
                class="navbar-avatar__img"
                @error="onAvatarError"
            />
            <PokeballLogo v-else :size="30" variant="blue" />
        </view>
        <text class="whitespace-nowrap text-xl font-black tracking-[-0.04em] text-[#24262b]">{{ title }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import PokeballLogo from '@/components/shared/PokeballLogo.vue';
import { getAvatar } from '@/services/profile/avatar';
import { isAuthenticated } from '@/services/session';
import { authGate } from '@/services/session/authGate';
import { onSessionChange } from '@/services/session/sessionChange';

const props = defineProps<{ title?: string }>()
const { t } = useI18n()
const displayTitle = computed(() => props.title ?? t('nav.pokedex'))

/**
 * 登录态与头像：页面由 switchTab 保活、setup 不重跑，登录/登出发生在其他页面
 * （「我的」页）时 NavBar 不会重建，需订阅会话变化与 onShow 式刷新。
 * avatarUrl 读 storage，头像更换在 mine.vue 落盘后此处的 ref 需要重新读。
 */
const loggedIn = ref(isAuthenticated());
const avatarUrl = ref(getAvatar());

const offSession = onSessionChange(() => {
    loggedIn.value = isAuthenticated();
    avatarUrl.value = getAvatar();
});
onUnmounted(() => offSession());

function onAvatarClick() {
    if (!loggedIn.value) authGate.open();
}

/** 头像文件被系统清理 / data URL 失效时回落到默认精灵球。 */
function onAvatarError() {
    avatarUrl.value = '';
}
</script>

<style lang="scss" scoped>
.navbar-inner {
  height: var(--navbar-content-height);
}

.navbar-avatar {
  position: absolute;
  left: 16px;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: 999px;
  overflow: hidden;
  cursor: pointer;
  transition: transform 0.14s ease, box-shadow 0.18s ease;
}

.navbar-avatar:active {
  transform: translateY(-50%) scale(0.92);
}

.navbar-avatar__img {
  width: 100%;
  height: 100%;
}
</style>
