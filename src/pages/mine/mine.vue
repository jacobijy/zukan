<template>
    <TabPageShell title="我的" :tabIndex="3" @tab-change="onTabChange">
        <view class="trainer-card glass-panel mb-6" @click="onTrainerCardClick">
            <PokeballLogo :size="60" variant="blue" />
            <view class="min-w-0 flex-1">
                <text v-if="loggedIn" class="block text-[20px] font-bold leading-6 tracking-[-0.03em] text-[#24262b]">训练师</text>
                <text v-else class="block text-[20px] font-bold leading-6 tracking-[-0.03em] text-[#24262b]">未登录</text>
                <text class="mt-1 block text-[12px] font-semibold leading-4 text-[#8d929c]">
                    {{ loggedIn ? '已登录 · 点击退出登录' : '点击登录以同步数据' }}
                </text>
            </view>
            <view class="trainer-card__badge">
                <text class="block text-[10px] font-bold leading-3 text-[#9da2ad]">已收集</text>
                <text class="mt-0.5 block font-mono text-[18px] font-black leading-5 tracking-[-0.05em] text-[#24262b]">{{ favoritesCount }}</text>
            </view>
        </view>

        <view class="section-label">个人图鉴</view>
        <view class="mine-list glass-panel">
            <ListRow
                v-for="(item, index) in menuItems"
                :key="item.title"
                :title="item.title"
                :desc="item.desc"
                :iconClass="item.iconClass"
                :last="index === menuItems.length - 1"
                showChevron
                @click="() => {}"
            >
                <template #icon>
                    <svg v-if="item.icon === 'settings'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" class="h-6 w-6">
                        <circle cx="12" cy="12" r="3"></circle><path d="M19 12a7 7 0 0 0-.08-1l2.08-1.6-2-3.46-2.45.98a7.6 7.6 0 0 0-1.72-1L14.5 3h-5l-.33 2.92a7.6 7.6 0 0 0-1.72 1L5 5.94l-2 3.46L5.08 11a7 7 0 0 0 0 2L3 14.6l2 3.46 2.45-.98a7.6 7.6 0 0 0 1.72 1L9.5 21h5l.33-2.92a7.6 7.6 0 0 0 1.72-1l2.45.98 2-3.46L18.92 13c.05-.33.08-.66.08-1z"></path>
                    </svg>
                    <svg v-else-if="item.icon === 'star'" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-6 w-6">
                        <polygon points="12 2.8 14.9 8.7 21.4 9.65 16.7 14.25 17.8 20.75 12 17.68 6.2 20.75 7.3 14.25 2.6 9.65 9.1 8.7 12 2.8"></polygon>
                    </svg>
                    <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" class="h-6 w-6">
                        <circle cx="12" cy="12" r="9"></circle><path d="M12 7v5l3.2 2"></path>
                    </svg>
                </template>
                <template #meta>
                    <text v-if="item.count !== undefined" class="mine-row__count">{{ item.count }}</text>
                    <text v-else class="text-[11px] font-semibold text-[#b4b8c0]">{{ item.meta }}</text>
                </template>
            </ListRow>
        </view>

        <view class="section-label mt-6">训练师状态</view>
        <view class="status-card glass-panel">
            <view class="status-card__shine"></view>
            <view class="relative z-10 flex items-center justify-between gap-3">
                <view>
                    <text class="block text-[13px] font-bold text-[#3b3f48]">收藏进度已同步到本机。</text>
                    <text class="mt-1 block text-[12px] font-medium leading-5 text-[#8a8f99]">当前收藏 {{ favoritesCount }} 个宝可梦样本，可在图鉴页继续标记。</text>
                </view>
                <view class="status-card__meter">
                    <text>{{ favoritesCount }}</text>
                </view>
            </view>
        </view>
    </TabPageShell>

    <LoginModal v-model:visible="showLogin" @success="onLoginSuccess" />
</template>

<script lang="ts" setup>
import TabPageShell from "@/components/shared/TabPageShell.vue";
import ListRow from "@/components/shared/ListRow.vue";
import LoginModal from "@/components/shared/LoginModal.vue";
import PokeballLogo from "@/components/shared/PokeballLogo.vue";
import { isAuthenticated, clearSession } from '@/services/session';
import { usePokemonStore } from '@/store/pokemon';
import { storeToRefs } from 'pinia';
import { computed, ref } from 'vue';

const pokemonStore = usePokemonStore();
const { favorites } = storeToRefs(pokemonStore);

const favoritesCount = computed(() => favorites.value.length);

const showLogin = ref(false);
const loggedIn = ref(isAuthenticated());

function onTrainerCardClick() {
    if (loggedIn.value) {
        uni.showModal({
            title: '退出登录',
            content: '确定要退出当前账号吗？',
            success: (res) => {
                if (res.confirm) {
                    clearSession();
                    loggedIn.value = false;
                    uni.showToast({ title: '已退出登录', icon: 'none' });
                }
            }
        });
    } else {
        showLogin.value = true;
    }
}

async function onLoginSuccess() {
    loggedIn.value = true;
    uni.showToast({ title: '登录成功', icon: 'success' });
    // 把本地收藏并集合并到服务端，然后覆盖本地；失败静默降级
    await pokemonStore.syncFavoritesOnLogin();
}

const menuItems = computed(() => [
    { title: '设置', desc: '调整图鉴偏好和展示方式。', meta: '偏好', icon: 'settings', iconClass: 'list-row__icon--gray' },
    { title: '我的收藏', desc: '查看已经标记的宝可梦样本。', icon: 'star', iconClass: 'list-row__icon--gold', count: favoritesCount.value },
    { title: '浏览历史', desc: '回到最近查看过的研究记录。', meta: '记录', icon: 'clock', iconClass: 'list-row__icon--blue' }
]);

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
