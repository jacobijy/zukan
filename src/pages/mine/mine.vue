<template>
    <view class="min-h-screen bg-gradient-to-b from-[#f8f9fa] to-[#e9ecef]" :style="{ paddingTop: 'var(--status-bar-height)', paddingBottom: '100px' }">
        <!-- 顶部标题栏 -->
        <view class="fixed top-0 left-0 right-0 z-[1000] bg-white/95 backdrop-blur-lg shadow-[0_2px_12px_rgba(0,0,0,0.08)] px-6 py-4" :style="{ paddingTop: 'var(--status-bar-height)' }">
            <text class="text-xl font-bold text-[#333]">个人中心</text>
        </view>

        <!-- 内容区域 -->
        <scroll-view scroll-y class="h-[calc(100vh-var(--status-bar-height)-100px)]">
            <!-- 用户信息卡片 -->
            <view class="bg-gradient-to-br from-[#FF6B6B] to-[#EE5A6F] p-6 pb-12">
                <view class="flex items-center gap-4">
                    <view class="w-20 h-20 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border-2 border-white/30">
                        <svg width="40" height="40" viewBox="0 0 24 24" fill="white" stroke="white" stroke-width="2">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                            <circle cx="12" cy="7" r="4"></circle>
                        </svg>
                    </view>
                    <view class="flex-1 text-white">
                        <text class="text-xl font-bold block mb-1">训练家</text>
                        <text class="text-sm opacity-90">ID: 88888888</text>
                    </view>
                </view>
            </view>

            <!-- 统计卡片 -->
            <view class="mx-4 -mt-8 bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.08)] p-5 mb-4">
                <view class="grid grid-cols-3 gap-4 text-center">
                    <view>
                        <text class="text-2xl font-bold text-[#FF6B6B] block">{{ favoritesCount }}</text>
                        <text class="text-xs text-[#999] mt-1 block">收藏</text>
                    </view>
                    <view>
                        <text class="text-2xl font-bold text-[#4ECDC4] block">0</text>
                        <text class="text-xs text-[#999] mt-1 block">对战</text>
                    </view>
                    <view>
                        <text class="text-2xl font-bold text-[#A78BFA] block">0</text>
                        <text class="text-xs text-[#999] mt-1 block">成就</text>
                    </view>
                </view>
            </view>

            <!-- 功能列表 -->
            <view class="px-4 space-y-3">
                <!-- 我的收藏 -->
                <view class="bg-white rounded-xl p-4 shadow-[0_2px_12px_rgba(0,0,0,0.08)] cursor-pointer active:scale-98 transition-transform" @click="navigateTo('/pages/favorite/favorite')">
                    <view class="flex items-center gap-3">
                        <view class="w-10 h-10 rounded-full bg-gradient-to-br from-[#FF6B6B]/10 to-[#EE5A6F]/10 flex items-center justify-center">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="#FF6B6B" stroke="#FF6B6B" stroke-width="2">
                                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                            </svg>
                        </view>
                        <view class="flex-1">
                            <text class="text-base font-semibold text-[#333]">我的收藏</text>
                            <text class="text-xs text-[#999] block mt-0.5">已收藏 {{ favoritesCount }} 只宝可梦</text>
                        </view>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" stroke-width="2">
                            <polyline points="9 18 15 12 9 6"></polyline>
                        </svg>
                    </view>
                </view>

                <!-- 浏览历史 -->
                <view class="bg-white rounded-xl p-4 shadow-[0_2px_12px_rgba(0,0,0,0.08)] cursor-pointer active:scale-98 transition-transform">
                    <view class="flex items-center gap-3">
                        <view class="w-10 h-10 rounded-full bg-gradient-to-br from-[#4ECDC4]/10 to-[#44A08D]/10 flex items-center justify-center">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4ECDC4" stroke-width="2">
                                <circle cx="12" cy="12" r="10"></circle>
                                <polyline points="12 6 12 12 16 14"></polyline>
                            </svg>
                        </view>
                        <view class="flex-1">
                            <text class="text-base font-semibold text-[#333]">浏览历史</text>
                            <text class="text-xs text-[#999] block mt-0.5">查看最近浏览的宝可梦</text>
                        </view>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" stroke-width="2">
                            <polyline points="9 18 15 12 9 6"></polyline>
                        </svg>
                    </view>
                </view>

                <!-- 设置 -->
                <view class="bg-white rounded-xl p-4 shadow-[0_2px_12px_rgba(0,0,0,0.08)] cursor-pointer active:scale-98 transition-transform">
                    <view class="flex items-center gap-3">
                        <view class="w-10 h-10 rounded-full bg-gradient-to-br from-[#A78BFA]/10 to-[#8B5CF6]/10 flex items-center justify-center">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#A78BFA" stroke-width="2">
                                <circle cx="12" cy="12" r="3"></circle>
                                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                            </svg>
                        </view>
                        <view class="flex-1">
                            <text class="text-base font-semibold text-[#333]">设置</text>
                            <text class="text-xs text-[#999] block mt-0.5">应用设置与偏好</text>
                        </view>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" stroke-width="2">
                            <polyline points="9 18 15 12 9 6"></polyline>
                        </svg>
                    </view>
                </view>

                <!-- 关于 -->
                <view class="bg-white rounded-xl p-4 shadow-[0_2px_12px_rgba(0,0,0,0.08)] cursor-pointer active:scale-98 transition-transform">
                    <view class="flex items-center gap-3">
                        <view class="w-10 h-10 rounded-full bg-gradient-to-br from-[#FBBF24]/10 to-[#F59E0B]/10 flex items-center justify-center">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FBBF24" stroke-width="2">
                                <circle cx="12" cy="12" r="10"></circle>
                                <line x1="12" y1="16" x2="12" y2="12"></line>
                                <line x1="12" y1="8" x2="12.01" y2="8"></line>
                            </svg>
                        </view>
                        <view class="flex-1">
                            <text class="text-base font-semibold text-[#333]">关于</text>
                            <text class="text-xs text-[#999] block mt-0.5">版本信息与说明</text>
                        </view>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" stroke-width="2">
                            <polyline points="9 18 15 12 9 6"></polyline>
                        </svg>
                    </view>
                </view>
            </view>

            <!-- 底部留白 -->
            <view class="h-4"></view>
        </scroll-view>

        <!-- 底部 TabBar -->
        <TabBar v-model="currentTab" @change="onTabChange" />
    </view>
</template>

<script lang="ts" setup>
import TabBar from '@/components/TabBar.vue'
import { usePokemonStore } from '@/store/pokemon'
import { storeToRefs } from 'pinia'
import { computed, ref } from 'vue'

const currentTab = ref(3)

const pokemonStore = usePokemonStore()
const { favorites } = storeToRefs(pokemonStore)

// 收藏数量
const favoritesCount = computed(() => {
    return favorites.value.length
})

const onTabChange = (index: number) => {
    console.log('Tab changed to:', index)
}

const navigateTo = (url: string) => {
    uni.navigateTo({ url })
}
</script>
