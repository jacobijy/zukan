<template>
    <view 
        class="min-h-screen bg-gradient-to-b from-[#f8f9fa] to-[#e9ecef] transition-opacity duration-300" 
        :class="{'opacity-0': transitioning, 'opacity-100': !transitioning}"
        :style="{ paddingTop: 'calc(var(--status-bar-height) + var(--navbar-content-height))', paddingBottom: '100px' }"
    >
        <!-- 导航栏 -->
        <NavBar title="个人中心" />

        <!-- 个人信息卡片 -->
        <view class="mx-5 mt-5 mb-4 bg-gradient-to-br from-[#FF6B6B] to-[#EE5A6F] rounded-2xl p-5 text-white shadow-[0_4px_16px_rgba(238,90,111,0.3)]">
            <view class="flex items-center">
                <view class="w-16 h-16 bg-white/20 rounded-full p-1 mr-4">
                    <view class="w-full h-full bg-gray-200 border-2 border-dashed rounded-full"></view>
                </view>
                <view class="flex-1">
                    <text class="text-lg font-bold block">训练师小明</text>
                    <text class="text-sm opacity-80 block mt-1">Lv. 58 | 金牌训练家</text>
                </view>
                <view class="text-right">
                    <text class="text-sm opacity-90 block">已收集</text>
                    <text class="text-xl font-bold block">156/1010</text>
                </view>
            </view>
        </view>

        <!-- 功能列表 -->
        <view class="mx-5 space-y-3">
            <!-- 设置 -->
            <view class="bg-white rounded-2xl p-4 shadow-[0_4px_16px_rgba(0,0,0,0.08)] border border-black/4 flex items-center justify-between">
                <view class="flex items-center">
                    <view class="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center mr-3">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#666" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="12" cy="12" r="3"></circle>
                            <path d="M12 1v6m0 6v6m11-7h-6m-6 0H1"></path>
                        </svg>
                    </view>
                    <text class="font-semibold text-[#333]">设置</text>
                </view>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
            </view>

            <!-- 收藏列表 -->
            <view class="bg-white rounded-2xl p-4 shadow-[0_4px_16px_rgba(0,0,0,0.08)] border border-black/4 flex items-center justify-between">
                <view class="flex items-center">
                    <view class="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center mr-3">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="#EF4444" stroke="#EF4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                        </svg>
                    </view>
                    <text class="font-semibold text-[#333]">我的收藏</text>
                </view>
                <view class="flex items-center">
                    <view class="bg-[#EF4444] text-white text-xs font-bold px-2.5 py-1 rounded-full mr-2">
                        {{ favoritesCount }}
                    </view>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="9 18 15 12 9 6"></polyline>
                    </svg>
                </view>
            </view>

            <!-- 历史记录 -->
            <view class="bg-white rounded-2xl p-4 shadow-[0_4px_16px_rgba(0,0,0,0.08)] border border-black/4 flex items-center justify-between">
                <view class="flex items-center">
                    <view class="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="12" cy="12" r="10"></circle>
                            <polyline points="12 6 12 12 16 14"></polyline>
                        </svg>
                    </view>
                    <text class="font-semibold text-[#333]">浏览历史</text>
                </view>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
            </view>
        </view>

        <!-- 底部 TabBar -->
        <TabBar v-model="currentTab" @change="onTabChange" />
    </view>
</template>

<script lang="ts" setup>
import NavBar from "@/components/NavBar.vue";
import TabBar from "@/components/TabBar.vue";
import { usePokemonStore } from '@/store/pokemon';
import { storeToRefs } from 'pinia';
import { computed, ref } from 'vue';

const currentTab = ref(3); // 当前选中的 tab 索引
const transitioning = ref(false); // 控制页面切换动画
const pokemonStore = usePokemonStore();
const { favorites } = storeToRefs(pokemonStore);

// 计算收藏数量
const favoritesCount = computed(() => {
    return favorites.value.length;
});

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
