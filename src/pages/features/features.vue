<template>
    <view class="min-h-screen bg-gradient-to-b from-[#f8f9fa] to-[#e9ecef]" :style="{ paddingTop: 'var(--status-bar-height)', paddingBottom: '100px' }">
        <!-- 顶部标题栏 -->
        <view class="fixed top-0 left-0 right-0 z-[1000] bg-white/95 backdrop-blur-lg shadow-[0_2px_12px_rgba(0,0,0,0.08)] px-6 py-4" :style="{ paddingTop: 'var(--status-bar-height)' }">
            <text class="text-xl font-bold text-[#333]">功能中心</text>
        </view>

        <!-- 内容区域 -->
        <scroll-view scroll-y class="h-[calc(100vh-var(--status-bar-height)-100px)] p-5">
            <!-- 功能卡片网格 -->
            <view class="grid grid-cols-2 gap-4">
                <!-- 对战模拟器 -->
                <view class="bg-white rounded-2xl p-5 shadow-[0_2px_12px_rgba(0,0,0,0.08)] cursor-pointer active:scale-95 transition-transform" @click="navigateTo('/pages/calc/calc')">
                    <view class="w-14 h-14 rounded-full bg-gradient-to-br from-[#FF6B6B]/10 to-[#EE5A6F]/10 flex items-center justify-center mb-3">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#FF6B6B" stroke-width="2">
                            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
                        </svg>
                    </view>
                    <text class="text-base font-bold text-[#333] block mb-1">对战模拟</text>
                    <text class="text-xs text-[#999]">伤害计算器</text>
                </view>

                <!-- 队伍构建 -->
                <view class="bg-white rounded-2xl p-5 shadow-[0_2px_12px_rgba(0,0,0,0.08)] cursor-pointer active:scale-95 transition-transform">
                    <view class="w-14 h-14 rounded-full bg-gradient-to-br from-[#4ECDC4]/10 to-[#44A08D]/10 flex items-center justify-center mb-3">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#4ECDC4" stroke-width="2">
                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                            <circle cx="9" cy="7" r="4"></circle>
                            <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                            <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                        </svg>
                    </view>
                    <text class="text-base font-bold text-[#333] block mb-1">队伍构建</text>
                    <text class="text-xs text-[#999]">组建最强阵容</text>
                </view>

                <!-- 属性克制 -->
                <view class="bg-white rounded-2xl p-5 shadow-[0_2px_12px_rgba(0,0,0,0.08)] cursor-pointer active:scale-95 transition-transform">
                    <view class="w-14 h-14 rounded-full bg-gradient-to-br from-[#A78BFA]/10 to-[#8B5CF6]/10 flex items-center justify-center mb-3">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#A78BFA" stroke-width="2">
                            <circle cx="12" cy="12" r="10"></circle>
                            <path d="M12 6v6l4 2"></path>
                        </svg>
                    </view>
                    <text class="text-base font-bold text-[#333] block mb-1">属性克制</text>
                    <text class="text-xs text-[#999]">查看相克关系</text>
                </view>

                <!-- 技能查询 -->
                <view class="bg-white rounded-2xl p-5 shadow-[0_2px_12px_rgba(0,0,0,0.08)] cursor-pointer active:scale-95 transition-transform">
                    <view class="w-14 h-14 rounded-full bg-gradient-to-br from-[#FBBF24]/10 to-[#F59E0B]/10 flex items-center justify-center mb-3">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#FBBF24" stroke-width="2">
                            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
                            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
                        </svg>
                    </view>
                    <text class="text-base font-bold text-[#333] block mb-1">技能查询</text>
                    <text class="text-xs text-[#999]">招式详细信息</text>
                </view>

                <!-- 特性大全 -->
                <view class="bg-white rounded-2xl p-5 shadow-[0_2px_12px_rgba(0,0,0,0.08)] cursor-pointer active:scale-95 transition-transform">
                    <view class="w-14 h-14 rounded-full bg-gradient-to-br from-[#10B981]/10 to-[#059669]/10 flex items-center justify-center mb-3">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#10B981" stroke-width="2">
                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                        </svg>
                    </view>
                    <text class="text-base font-bold text-[#333] block mb-1">特性大全</text>
                    <text class="text-xs text-[#999]">所有特性介绍</text>
                </view>

                <!-- 道具百科 -->
                <view class="bg-white rounded-2xl p-5 shadow-[0_2px_12px_rgba(0,0,0,0.08)] cursor-pointer active:scale-95 transition-transform">
                    <view class="w-14 h-14 rounded-full bg-gradient-to-br from-[#EC4899]/10 to-[#DB2777]/10 flex items-center justify-center mb-3">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#EC4899" stroke-width="2">
                            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                        </svg>
                    </view>
                    <text class="text-base font-bold text-[#333] block mb-1">道具百科</text>
                    <text class="text-xs text-[#999]">道具效果说明</text>
                </view>
            </view>

            <!-- 底部提示 -->
            <view class="mt-6 text-center text-[#999] text-sm">
                <text>更多功能开发中...</text>
            </view>
        </scroll-view>

        <!-- 底部 TabBar -->
        <TabBar v-model="currentTab" @change="onTabChange" />
    </view>
</template>

<script lang="ts" setup>
import TabBar from '@/components/TabBar.vue'
import { ref } from 'vue'

const currentTab = ref(1)

const onTabChange = (index: number) => {
    console.log('Tab changed to:', index)
}

const navigateTo = (url: string) => {
    uni.navigateTo({ url })
}
</script>
