<template>
    <view
        class="mine-page min-h-screen"
        :style="{
            paddingTop: 'calc(var(--status-bar-height) + var(--navbar-content-height))',
            paddingBottom: '104px'
        }"
    >
        <NavBar title="我的" />

        <view class="relative z-10 px-4 py-4 sm:px-5">
            <view class="mx-auto max-w-[720px]">
                <view class="trainer-card mb-6">
                    <view class="trainer-card__avatar">
                        <view class="trainer-card__avatar-cap"></view>
                    </view>
                    <view class="min-w-0 flex-1">
                        <text class="block text-[20px] font-bold leading-6 tracking-[-0.03em] text-[#24262b]">训练师小明</text>
                        <text class="mt-1 block text-[12px] font-semibold leading-4 text-[#8d929c]">Lv. 58 · 金牌训练家</text>
                    </view>
                    <view class="trainer-card__badge">
                        <text class="block text-[10px] font-bold leading-3 text-[#9da2ad]">已收集</text>
                        <text class="mt-0.5 block font-mono text-[18px] font-black leading-5 tracking-[-0.05em] text-[#24262b]">156</text>
                    </view>
                </view>

                <view class="section-label">个人图鉴</view>
                <view class="mine-list">
                    <view
                        v-for="(item, index) in menuItems"
                        :key="item.title"
                        class="mine-row"
                        :class="{ 'mine-row--last': index === menuItems.length - 1 }"
                    >
                        <view class="mine-row__icon" :class="item.iconClass">
                            <svg v-if="item.icon === 'settings'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" class="h-6 w-6">
                                <circle cx="12" cy="12" r="3"></circle>
                                <path d="M19 12a7 7 0 0 0-.08-1l2.08-1.6-2-3.46-2.45.98a7.6 7.6 0 0 0-1.72-1L14.5 3h-5l-.33 2.92a7.6 7.6 0 0 0-1.72 1L5 5.94l-2 3.46L5.08 11a7 7 0 0 0 0 2L3 14.6l2 3.46 2.45-.98a7.6 7.6 0 0 0 1.72 1L9.5 21h5l.33-2.92a7.6 7.6 0 0 0 1.72-1l2.45.98 2-3.46L18.92 13c.05-.33.08-.66.08-1z"></path>
                            </svg>
                            <svg v-else-if="item.icon === 'star'" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-6 w-6">
                                <polygon points="12 2.8 14.9 8.7 21.4 9.65 16.7 14.25 17.8 20.75 12 17.68 6.2 20.75 7.3 14.25 2.6 9.65 9.1 8.7 12 2.8"></polygon>
                            </svg>
                            <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" class="h-6 w-6">
                                <circle cx="12" cy="12" r="9"></circle>
                                <path d="M12 7v5l3.2 2"></path>
                            </svg>
                        </view>

                        <view class="mine-row__body">
                            <view class="min-w-0 flex-1 py-3.5">
                                <text class="block text-[16px] font-semibold leading-5 tracking-[-0.01em] text-[#24262b]">{{ item.title }}</text>
                                <text class="mt-1 block text-[12px] font-medium leading-4 text-[#8d929c]">{{ item.desc }}</text>
                            </view>
                            <view class="mine-row__meta">
                                <text v-if="item.count !== undefined" class="mine-row__count">{{ item.count }}</text>
                                <text v-else class="text-[11px] font-semibold text-[#b4b8c0]">{{ item.meta }}</text>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4 text-[#c4c7cf]">
                                    <path d="m9 18 6-6-6-6"></path>
                                </svg>
                            </view>
                        </view>
                    </view>
                </view>

                <view class="section-label mt-6">训练师状态</view>
                <view class="status-card">
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
            </view>
        </view>

        <TabBar v-model="currentTab" @change="onTabChange" />
    </view>
</template>

<script lang="ts" setup>
import NavBar from "@/components/NavBar.vue";
import TabBar from "@/components/TabBar.vue";
import { usePokemonStore } from '@/store/pokemon';
import { storeToRefs } from 'pinia';
import { computed, ref } from 'vue';

const currentTab = ref(3);
const pokemonStore = usePokemonStore();
const { favorites } = storeToRefs(pokemonStore);

const favoritesCount = computed(() => favorites.value.length);

const menuItems = computed(() => [
    { title: '设置', desc: '调整图鉴偏好和展示方式。', meta: '偏好', icon: 'settings', iconClass: 'mine-row__icon--gray' },
    { title: '我的收藏', desc: '查看已经标记的宝可梦样本。', icon: 'star', iconClass: 'mine-row__icon--gold', count: favoritesCount.value },
    { title: '浏览历史', desc: '回到最近查看过的研究记录。', meta: '记录', icon: 'clock', iconClass: 'mine-row__icon--blue' }
]);

const onTabChange = (index: number) => {
    currentTab.value = index;
};
</script>

<style lang="scss" scoped>
.mine-page {
    position: relative;
    overflow: hidden;
    color: #24262b;
    background:
        radial-gradient(circle at 18% -10%, rgba(255, 255, 255, 0.95), transparent 34%),
        linear-gradient(180deg, #f7f8fb 0%, #f1f2f6 46%, #eef0f5 100%);
}

.mine-page::before {
    position: absolute;
    inset: 0;
    pointer-events: none;
    content: '';
    background-image:
        linear-gradient(rgba(45, 49, 58, 0.025) 1px, transparent 1px),
        linear-gradient(90deg, rgba(45, 49, 58, 0.022) 1px, transparent 1px);
    background-size: 32px 32px;
    mask-image: linear-gradient(to bottom, rgba(0, 0, 0, 0.5), transparent 58%);
}

.section-label {
    padding: 0 14px 8px;
    color: #9da2ad;
    font-size: 12px;
    font-weight: 800;
    letter-spacing: 0.12em;
}

.trainer-card,
.mine-list,
.status-card {
    border: 1px solid rgba(255, 255, 255, 0.78);
    border-radius: 24px;
    background: rgba(255, 255, 255, 0.92);
    box-shadow: 0 18px 42px rgba(48, 55, 72, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.88);
    backdrop-filter: blur(18px);
}

.trainer-card {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 16px;
}

.trainer-card__avatar {
    position: relative;
    display: flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    width: 60px;
    height: 60px;
    overflow: hidden;
    border-radius: 18px;
    background: linear-gradient(135deg, #73b7ff 0%, #357df4 58%, #275bd8 100%);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.42), 0 10px 20px rgba(63, 70, 86, 0.12);
}

.trainer-card__avatar::before,
.trainer-card__avatar::after {
    position: absolute;
    content: '';
}

.trainer-card__avatar::before {
    top: 12px;
    width: 26px;
    height: 26px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.94);
}

.trainer-card__avatar::after {
    bottom: -10px;
    width: 46px;
    height: 28px;
    border-radius: 999px 999px 16px 16px;
    background: rgba(255, 255, 255, 0.94);
}

.trainer-card__avatar-cap {
    position: absolute;
    z-index: 1;
    top: 9px;
    width: 31px;
    height: 10px;
    border-radius: 999px 999px 4px 4px;
    background: #f05245;
}

.trainer-card__badge {
    flex-shrink: 0;
    min-width: 58px;
    padding: 9px 10px;
    border-radius: 16px;
    text-align: right;
    background: #f5f6fa;
}

.mine-list {
    overflow: hidden;
}

.mine-row {
    display: flex;
    align-items: center;
    min-height: 78px;
    padding-left: 14px;
    transition: background-color 0.18s ease, transform 0.18s ease;
}

.mine-row:active {
    background: rgba(241, 243, 248, 0.82);
    transform: scale(0.992);
}

.mine-row__icon {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    border-radius: 14px;
    color: #fff;
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.38), 0 10px 20px rgba(63, 70, 86, 0.12);
}

.mine-row__icon--gray {
    background: linear-gradient(135deg, #b8bcc5 0%, #8e949f 56%, #6e7480 100%);
}

.mine-row__icon--gold {
    color: #4c3506;
    background: linear-gradient(135deg, #ffe7a8 0%, #f4c849 54%, #e99a24 100%);
}

.mine-row__icon--blue {
    background: linear-gradient(135deg, #73b7ff 0%, #357df4 58%, #275bd8 100%);
}

.mine-row__body {
    display: flex;
    flex: 1;
    align-items: center;
    min-width: 0;
    margin-left: 14px;
    padding-right: 12px;
    border-bottom: 1px solid rgba(222, 225, 232, 0.86);
}

.mine-row--last .mine-row__body {
    border-bottom: 0;
}

.mine-row__meta {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    gap: 4px;
    margin-left: 10px;
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
