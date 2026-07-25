<template>
    <view
        class="more-page min-h-screen page-bg"
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
                    <ListRow
                        v-for="(item, index) in featureItems"
                        :key="item.title"
                        :title="item.title"
                        :desc="item.desc"
                        :meta="item.meta"
                        :iconClass="item.iconClass"
                        :last="index === featureItems.length - 1"
                        showChevron
                        @click="goToPage(item.url)"
                    >
                        <template #icon>
                            <svg v-if="item.icon === 'target'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" class="h-6 w-6">
                                <circle cx="12" cy="12" r="8"></circle><circle cx="12" cy="12" r="3"></circle>
                                <path d="M12 4v3M12 17v3M4 12h3M17 12h3"></path>
                            </svg>
                            <svg v-else-if="item.icon === 'grid'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" class="h-6 w-6">
                                <rect x="3.5" y="3.5" width="17" height="17" rx="4"></rect><path d="M3.5 9.5h17M9.5 20.5v-11"></path>
                            </svg>
                            <svg v-else-if="item.icon === 'chart'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" class="h-6 w-6">
                                <path d="M4 19V5"></path><path d="M8.5 19v-6"></path><path d="M13 19V8"></path><path d="M17.5 19v-9"></path><path d="M3.5 19h17"></path>
                            </svg>
                            <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" class="h-6 w-6">
                                <rect x="3.5" y="5" width="17" height="14" rx="3"></rect><path d="m4.5 7.5 7.5 5.25 7.5-5.25"></path>
                            </svg>
                        </template>
                    </ListRow>
                </view>

            </view>
        </view>

        <TabBar v-model="currentTab" @change="onTabChange" />
    </view>
</template>

<script lang="ts" setup>
import NavBar from "@/components/NavBar.vue";
import TabBar from "@/components/TabBar.vue";
import ListRow from "@/components/shared/ListRow.vue";
import { ref } from "vue";

const currentTab = ref(1);

const featureItems = [
    { title: '伤害计算器', desc: '计算技能伤害、克制关系与实战收益。', meta: '对战', url: '/pages/calc/calc', icon: 'target', iconClass: 'list-row__icon--green' },
    { title: '对战模拟器', desc: '用研究记录的方式复盘宝可梦对战场景。', meta: '沙盘', url: '/pages/simulate/simulate', icon: 'grid', iconClass: 'list-row__icon--blue' },
    { title: '数据统计', desc: '查看属性、能力值和收集进度的统计摘要。', meta: '资料', url: '/pages/data/data', icon: 'chart', iconClass: 'list-row__icon--violet' },
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

.feature-list {
    border: 1px solid rgba(255, 255, 255, 0.78);
    border-radius: 24px;
    background: rgba(255, 255, 255, 0.92);
    box-shadow: 0 18px 42px rgba(48, 55, 72, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.88);
    backdrop-filter: blur(18px);
}

.feature-list {
    overflow: hidden;
    border: 1px solid rgba(255, 255, 255, 0.78);
    border-radius: 24px;
    background: rgba(255, 255, 255, 0.92);
    box-shadow: 0 18px 42px rgba(48, 55, 72, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.88);
    backdrop-filter: blur(18px);
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
