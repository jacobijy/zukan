<template>
    <view
        class="more-page min-h-screen"
        :style="{
            paddingTop: 'calc(var(--status-bar-height) + var(--navbar-content-height))',
            paddingBottom: '104px'
        }"
    >
        <NavBar title="其他功能" />

        <view class="relative z-10 px-4 py-4 sm:px-5">
            <view class="mx-auto max-w-[720px]">
                <view class="section-label">常用工具</view>
                <view class="feature-list">
                    <view
                        v-for="(item, index) in featureItems"
                        :key="item.title"
                        class="feature-row"
                        :class="{ 'feature-row--last': index === featureItems.length - 1 }"
                        @click="goToPage(item.url)"
                    >
                        <view class="feature-row__icon" :class="item.iconClass">
                            <svg v-if="item.icon === 'target'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" class="h-6 w-6">
                                <circle cx="12" cy="12" r="8"></circle>
                                <circle cx="12" cy="12" r="3"></circle>
                                <path d="M12 4v3M12 17v3M4 12h3M17 12h3"></path>
                            </svg>
                            <svg v-else-if="item.icon === 'grid'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" class="h-6 w-6">
                                <rect x="3.5" y="3.5" width="17" height="17" rx="4"></rect>
                                <path d="M3.5 9.5h17M9.5 20.5v-11"></path>
                            </svg>
                            <svg v-else-if="item.icon === 'chart'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" class="h-6 w-6">
                                <path d="M4 19V5"></path>
                                <path d="M8.5 19v-6"></path>
                                <path d="M13 19V8"></path>
                                <path d="M17.5 19v-9"></path>
                                <path d="M3.5 19h17"></path>
                            </svg>
                            <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" class="h-6 w-6">
                                <rect x="3.5" y="5" width="17" height="14" rx="3"></rect>
                                <path d="m4.5 7.5 7.5 5.25 7.5-5.25"></path>
                            </svg>
                        </view>

                        <view class="feature-row__body">
                            <view class="min-w-0 flex-1 py-3.5">
                                <text class="block text-[16px] font-semibold leading-5 tracking-[-0.01em] text-[#24262b]">{{ item.title }}</text>
                                <text class="mt-1 block text-[12px] font-medium leading-4 text-[#8d929c]">{{ item.desc }}</text>
                            </view>
                            <view class="feature-row__meta">
                                <text class="text-[11px] font-semibold text-[#b4b8c0]">{{ item.meta }}</text>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4 text-[#c4c7cf]">
                                    <path d="m9 18 6-6-6-6"></path>
                                </svg>
                            </view>
                        </view>
                    </view>
                </view>

                <view class="section-label mt-6">图鉴实验室</view>
                <view class="note-card">
                    <view class="note-card__shine"></view>
                    <text class="relative z-10 block text-[13px] font-bold text-[#3b3f48]">这些入口会保持轻量。</text>
                    <text class="relative z-10 mt-1 block text-[12px] font-medium leading-5 text-[#8a8f99]">像系统设置一样快速扫描，点开后再进入更完整的研究视图。</text>
                </view>
            </view>
        </view>

        <TabBar v-model="currentTab" @change="onTabChange" />
    </view>
</template>

<script lang="ts" setup>
import NavBar from "@/components/NavBar.vue";
import TabBar from "@/components/TabBar.vue";
import { ref } from "vue";

const currentTab = ref(1);

const featureItems = [
    { title: '伤害计算器', desc: '计算技能伤害、克制关系与实战收益。', meta: '对战', url: '/pages/calc/calc', icon: 'target', iconClass: 'feature-row__icon--green' },
    { title: '对战模拟器', desc: '用研究记录的方式复盘宝可梦对战场景。', meta: '沙盘', url: '/pages/simulate/simulate', icon: 'grid', iconClass: 'feature-row__icon--blue' },
    { title: '数据统计', desc: '查看属性、能力值和收集进度的统计摘要。', meta: '资料', url: '/pages/data/data', icon: 'chart', iconClass: 'feature-row__icon--violet' },
    { title: '联系我们', desc: '提交问题反馈，让这本图鉴继续完善。', meta: '反馈', url: '/pages/contact/contact', icon: 'mail', iconClass: 'feature-row__icon--gold' }
];

const goToPage = (url: string) => {
    uni.navigateTo({ url });
};

const onTabChange = (index: number) => {
    currentTab.value = index;
};
</script>

<style lang="scss" scoped>
.more-page {
    position: relative;
    overflow: hidden;
    color: #24262b;
    background:
        radial-gradient(circle at 18% -10%, rgba(255, 255, 255, 0.95), transparent 34%),
        linear-gradient(180deg, #f7f8fb 0%, #f1f2f6 46%, #eef0f5 100%);
}

.more-page::before {
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

.feature-list,
.note-card {
    border: 1px solid rgba(255, 255, 255, 0.78);
    border-radius: 24px;
    background: rgba(255, 255, 255, 0.92);
    box-shadow: 0 18px 42px rgba(48, 55, 72, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.88);
    backdrop-filter: blur(18px);
}

.feature-list {
    overflow: hidden;
}

.feature-row {
    display: flex;
    align-items: center;
    min-height: 78px;
    padding-left: 14px;
    transition: background-color 0.18s ease, transform 0.18s ease;
}

.feature-row:active {
    background: rgba(241, 243, 248, 0.82);
    transform: scale(0.992);
}

.feature-row__icon {
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

.feature-row__icon--green {
    background: linear-gradient(135deg, #7ad66f 0%, #34b85a 58%, #178f42 100%);
}

.feature-row__icon--blue {
    background: linear-gradient(135deg, #73b7ff 0%, #357df4 58%, #275bd8 100%);
}

.feature-row__icon--violet {
    background: linear-gradient(135deg, #9a86f4 0%, #7350d4 58%, #4b32a6 100%);
}

.feature-row__icon--gold {
    color: #4c3506;
    background: linear-gradient(135deg, #ffe7a8 0%, #f4c849 54%, #e99a24 100%);
}

.feature-row__body {
    display: flex;
    flex: 1;
    align-items: center;
    min-width: 0;
    margin-left: 14px;
    padding-right: 12px;
    border-bottom: 1px solid rgba(222, 225, 232, 0.86);
}

.feature-row--last .feature-row__body {
    border-bottom: 0;
}

.feature-row__meta {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    gap: 4px;
    margin-left: 10px;
}

.note-card {
    position: relative;
    padding: 16px;
    overflow: hidden;
}

.note-card__shine {
    position: absolute;
    right: -32px;
    top: -48px;
    width: 130px;
    height: 130px;
    border-radius: 999px;
    background: radial-gradient(circle, rgba(83, 144, 244, 0.14), transparent 67%);
}
</style>
