<template>
    <view 
        class="min-h-screen bg-gradient-to-b from-[#f8f9fa] to-[#e9ecef] transition-opacity duration-300" 
        :class="{'opacity-0': transitioning, 'opacity-100': !transitioning}"
        :style="{ paddingTop: 'calc(var(--status-bar-height) + var(--navbar-content-height))', paddingBottom: '100px' }"
    >
        <!-- 导航栏 -->
        <NavBar />

        <!-- 功能列表 -->
        <view class="px-5 py-4">
            <view class="max-w-[800px] mx-auto flex flex-col gap-2">
                <!-- 计算器功能条目 -->
                <view 
                    class="flex items-center bg-white rounded-xl p-4 shadow-[0_2px_8px_rgba(0,0,0,0.08)] cursor-pointer active:scale-98 transition-all duration-300 border border-black/4"
                    @click="goToPage('/pages/calc/calc')"
                >
                    <!-- 图标区域 -->
                    <view class="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center flex-shrink-0">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line>
                            <line x1="12" y1="12" x2="12" y2="12"></line>
                            <line x1="16" y1="16" x2="16" y2="16"></line>
                            <line x1="8" y1="8" x2="8" y2="8"></line>
                        </svg>
                    </view>
                    <!-- 文字信息 -->
                    <view class="ml-4 flex-1">
                        <text class="text-base font-semibold text-[#333]">伤害计算器</text>
                        <text class="text-xs text-[#999] mt-1 block">计算技能伤害和效果</text>
                    </view>
                    <!-- 箭头指示 -->
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#999" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="flex-shrink-0">
                        <polyline points="9 18 15 12 9 6"></polyline>
                    </svg>
                </view>

                <!-- 对战模拟功能条目 -->
                <view 
                    class="flex items-center bg-white rounded-xl p-4 shadow-[0_2px_8px_rgba(0,0,0,0.08)] cursor-pointer active:scale-98 transition-all duration-300 border border-black/4"
                    @click="goToPage('/pages/simulate/simulate')"
                >
                    <!-- 图标区域 -->
                    <view class="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center flex-shrink-0">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                            <line x1="3" y1="9" x2="21" y2="9"></line>
                            <line x1="9" y1="21" x2="9" y2="9"></line>
                        </svg>
                    </view>
                    <!-- 文字信息 -->
                    <view class="ml-4 flex-1">
                        <text class="text-base font-semibold text-[#333]">对战模拟器</text>
                        <text class="text-xs text-[#999] mt-1 block">模拟宝可梦对战场景</text>
                    </view>
                    <!-- 箭头指示 -->
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#999" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="flex-shrink-0">
                        <polyline points="9 18 15 12 9 6"></polyline>
                    </svg>
                </view>

                <!-- 数据统计功能条目 -->
                <view 
                    class="flex items-center bg-white rounded-xl p-4 shadow-[0_2px_8px_rgba(0,0,0,0.08)] cursor-pointer active:scale-98 transition-all duration-300 border border-black/4"
                    @click="goToPage('/pages/data/data')"
                >
                    <!-- 图标区域 -->
                    <view class="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center flex-shrink-0">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <line x1="18" y1="20" x2="18" y2="10"></line>
                            <line x1="12" y1="20" x2="12" y2="4"></line>
                            <line x1="6" y1="20" x2="6" y2="14"></line>
                        </svg>
                    </view>
                    <!-- 文字信息 -->
                    <view class="ml-4 flex-1">
                        <text class="text-base font-semibold text-[#333]">数据统计</text>
                        <text class="text-xs text-[#999] mt-1 block">查看宝可梦数据分析</text>
                    </view>
                    <!-- 箭头指示 -->
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#999" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="flex-shrink-0">
                        <polyline points="9 18 15 12 9 6"></polyline>
                    </svg>
                </view>

                <!-- 联系我们功能条目 -->
                <view 
                    class="flex items-center bg-white rounded-xl p-4 shadow-[0_2px_8px_rgba(0,0,0,0.08)] cursor-pointer active:scale-98 transition-all duration-300 border border-black/4"
                    @click="goToPage('/pages/contact/contact')"
                >
                    <!-- 图标区域 -->
                    <view class="w-12 h-12 bg-gradient-to-br from-red-500 to-orange-600 rounded-xl flex items-center justify-center flex-shrink-0">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                            <polyline points="22,6 12,13 2,6"></polyline>
                        </svg>
                    </view>
                    <!-- 文字信息 -->
                    <view class="ml-4 flex-1">
                        <text class="text-base font-semibold text-[#333]">联系我们</text>
                        <text class="text-xs text-[#999] mt-1 block">反馈问题和建议</text>
                    </view>
                    <!-- 箭头指示 -->
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#999" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="flex-shrink-0">
                        <polyline points="9 18 15 12 9 6"></polyline>
                    </svg>
                </view>
            </view>
        </view>

        <!-- 底部 TabBar -->
        <TabBar v-model="currentTab" @change="onTabChange" />
    </view>
</template>

<script lang="ts" setup>
import NavBar from "@/components/NavBar.vue";
import TabBar from "@/components/TabBar.vue";
import { ref } from "vue";

const currentTab = ref(1); // 当前选中的 tab 索引
const transitioning = ref(false); // 控制页面切换动画

// 页面跳转方法
const goToPage = (url: string) => {
    uni.navigateTo({
        url: url
    });
};

// Tab 切换处理
const onTabChange = (index: number) => {
    console.log('Tab changed to:', index);
    
    // 添加页面切换动画
    transitioning.value = true;
    
    // 延迟切换页面，确保动画完成
    setTimeout(() => {
        currentTab.value = index;
    }, 150);
};
</script>

<style lang="scss" scoped>
/* 所有样式已迁移至 Tailwind CSS */
</style>