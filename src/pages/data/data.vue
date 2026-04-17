<template>
    <view 
        class="min-h-screen bg-gradient-to-b from-[#f8f9fa] to-[#e9ecef] transition-opacity duration-300" 
        :class="{'opacity-0': transitioning, 'opacity-100': !transitioning}"
        :style="{ paddingTop: 'calc(var(--status-bar-height) + 60px)', paddingBottom: '100px' }"
    >
        <!-- 导航栏 -->
        <NavBar />

        <!-- 数据概览 -->
        <view class="p-5">
            <view class="bg-white rounded-2xl p-5 shadow-[0_4px_16px_rgba(0,0,0,0.08)] border border-black/4 mb-4">
                <text class="text-lg font-bold text-[#333] mb-3">数据概览</text>
                <view class="grid grid-cols-4 gap-4">
                    <view class="text-center">
                        <text class="text-2xl font-bold text-[#FF6B6B] block">1010</text>
                        <text class="text-xs text-[#999]">宝可梦总数</text>
                    </view>
                    <view class="text-center">
                        <text class="text-2xl font-bold text-[#4ECDC4] block">18</text>
                        <text class="text-xs text-[#999]">属性种类</text>
                    </view>
                    <view class="text-center">
                        <text class="text-2xl font-bold text-[#45B7D1] block">400+</text>
                        <text class="text-xs text-[#999]">招式数量</text>
                    </view>
                    <view class="text-center">
                        <text class="text-2xl font-bold text-[#96CEB4] block">300+</text>
                        <text class="text-xs text-[#999]"> Abilities</text>
                    </view>
                </view>
            </view>

            <!-- 热门宝可梦 -->
            <view class="bg-white rounded-2xl p-5 shadow-[0_4px_16px_rgba(0,0,0,0.08)] border border-black/4">
                <text class="text-lg font-bold text-[#333] mb-3">热门宝可梦</text>
                <view class="space-y-4">
                    <view class="flex items-center gap-3 p-3 rounded-xl bg-gray-50 cursor-pointer active:scale-[0.98] transition-transform" @click="goToDetail(25)">
                        <view class="w-10 h-10 bg-yellow-400 rounded-full flex items-center justify-center">
                            <text class="text-white font-bold text-xs">25</text>
                        </view>
                        <text class="font-semibold text-[#333]">皮卡丘</text>
                        <text class="ml-auto text-xs text-[#999]">电气属性</text>
                    </view>
                    <view class="flex items-center gap-3 p-3 rounded-xl bg-gray-50 cursor-pointer active:scale-[0.98] transition-transform" @click="goToDetail(6)">
                        <view class="w-10 h-10 bg-red-500 rounded-full flex items-center justify-center">
                            <text class="text-white font-bold text-xs">6</text>
                        </view>
                        <text class="font-semibold text-[#333]">喷火龙</text>
                        <text class="ml-auto text-xs text-[#999]">火/飞行</text>
                    </view>
                    <view class="flex items-center gap-3 p-3 rounded-xl bg-gray-50 cursor-pointer active:scale-[0.98] transition-transform" @click="goToDetail(9)">
                        <view class="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
                            <text class="text-white font-bold text-xs">9</text>
                        </view>
                        <text class="font-semibold text-[#333]">水箭龟</text>
                        <text class="ml-auto text-xs text-[#999]">水属性</text>
                    </view>
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

const currentTab = ref(2); // 当前选中的 tab 索引
const transitioning = ref(false); // 控制页面切换动画

// 跳转到宝可梦详情页
const goToDetail = (id: number) => {
    uni.navigateTo({
        url: `/pages/detail/detail?id=${id}`
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
