<template>
    <view 
        class="min-h-screen bg-gradient-to-b from-[#f8f9fa] to-[#e9ecef] transition-opacity duration-300" 
        :class="{'opacity-0': transitioning, 'opacity-100': !transitioning}"
        :style="{ paddingTop: 'calc(var(--status-bar-height) + 60px)', paddingBottom: '100px' }"
    >
        <!-- 导航栏 -->
        <NavBar />

        <!-- 功能卡片网格 -->
        <view class="p-5">
            <view class="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-4 max-w-[1400px] mx-auto">
                <!-- 计算器功能卡片 -->
                <view 
                    class="bg-white rounded-2xl p-5 shadow-[0_4px_16px_rgba(0,0,0,0.08)] cursor-pointer active:scale-95 transition-all duration-300 border border-black/4 flex flex-col items-center justify-center gap-3 hover:shadow-[0_8px_24px_rgba(0,0,0,0.12)]"
                    @click="goToPage('/pages/calc/calc')"
                >
                    <view class="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line>
                            <line x1="12" y1="12" x2="12" y2="12"></line>
                            <line x1="16" y1="16" x2="16" y2="16"></line>
                            <line x1="8" y1="8" x2="8" y2="8"></line>
                        </svg>
                    </view>
                    <text class="text-sm font-semibold text-[#333]">伤害计算器</text>
                </view>

                <!-- 对战模拟功能卡片 -->
                <view 
                    class="bg-white rounded-2xl p-5 shadow-[0_4px_16px_rgba(0,0,0,0.08)] cursor-pointer active:scale-95 transition-all duration-300 border border-black/4 flex flex-col items-center justify-center gap-3 hover:shadow-[0_8px_24px_rgba(0,0,0,0.12)]"
                    @click="goToPage('/pages/simulate/simulate')"
                >
                    <view class="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                            <line x1="3" y1="9" x2="21" y2="9"></line>
                            <line x1="9" y1="21" x2="9" y2="9"></line>
                        </svg>
                    </view>
                    <text class="text-sm font-semibold text-[#333]">对战模拟器</text>
                </view>

                <!-- 数据统计功能卡片 -->
                <view 
                    class="bg-white rounded-2xl p-5 shadow-[0_4px_16px_rgba(0,0,0,0.08)] cursor-pointer active:scale-95 transition-all duration-300 border border-black/4 flex flex-col items-center justify-center gap-3 hover:shadow-[0_8px_24px_rgba(0,0,0,0.12)]"
                    @click="goToPage('/pages/data/data')"
                >
                    <view class="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <line x1="18" y1="20" x2="18" y2="10"></line>
                            <line x1="12" y1="20" x2="12" y2="4"></line>
                            <line x1="6" y1="20" x2="6" y2="14"></line>
                        </svg>
                    </view>
                    <text class="text-sm font-semibold text-[#333]">数据统计</text>
                </view>

                <!-- 联系我们功能卡片 -->
                <view 
                    class="bg-white rounded-2xl p-5 shadow-[0_4px_16px_rgba(0,0,0,0.08)] cursor-pointer active:scale-95 transition-all duration-300 border border-black/4 flex flex-col items-center justify-center gap-3 hover:shadow-[0_8px_24px_rgba(0,0,0,0.12)]"
                    @click="goToPage('/pages/contact/contact')"
                >
                    <view class="w-12 h-12 bg-gradient-to-br from-red-500 to-orange-600 rounded-xl flex items-center justify-center">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                            <polyline points="22,6 12,13 2,6"></polyline>
                        </svg>
                    </view>
                    <text class="text-sm font-semibold text-[#333]">联系我们</text>
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