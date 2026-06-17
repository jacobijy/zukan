<template>
    <view
        class="data-page min-h-screen"
        :style="{
            paddingTop: 'calc(var(--status-bar-height) + var(--navbar-content-height))',
            paddingBottom: '104px'
        }"
    >
        <NavBar title="资料中心" />

        <view class="relative z-10 px-4 py-4 sm:px-5">
            <view class="mx-auto max-w-[720px]">
                <view class="section-label">图鉴概览</view>
                <view class="data-list">
                    <view
                        v-for="(item, index) in overviewItems"
                        :key="item.label"
                        class="data-row"
                        :class="{ 'data-row--last': index === overviewItems.length - 1 }"
                    >
                        <view class="data-row__icon" :class="item.iconClass">
                            <svg v-if="item.icon === 'book'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" class="h-6 w-6">
                                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                                <path d="M6.5 3H20v18H6.5A2.5 2.5 0 0 1 4 18.5v-13A2.5 2.5 0 0 1 6.5 3z"></path>
                                <path d="M9 8h6"></path>
                            </svg>
                            <svg v-else-if="item.icon === 'spark'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" class="h-6 w-6">
                                <path d="m12 2 2.6 6.5L21 11l-6.4 2.5L12 20l-2.6-6.5L3 11l6.4-2.5L12 2z"></path>
                            </svg>
                            <svg v-else-if="item.icon === 'bolt'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" class="h-6 w-6">
                                <polygon points="13 2.5 4 14 12 14 11 21.5 20 10 12 10 13 2.5"></polygon>
                            </svg>
                            <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" class="h-6 w-6">
                                <path d="M12 3.5 19.5 8v8L12 20.5 4.5 16V8L12 3.5z"></path>
                                <path d="M12 12 19.5 8M12 12v8.5M12 12 4.5 8"></path>
                            </svg>
                        </view>

                        <view class="data-row__body">
                            <view class="min-w-0 flex-1 py-3.5">
                                <text class="block text-[16px] font-semibold leading-5 tracking-[-0.01em] text-[#24262b]">{{ item.label }}</text>
                                <text class="mt-1 block text-[12px] font-medium leading-4 text-[#8d929c]">{{ item.desc }}</text>
                            </view>
                            <text class="data-row__value" :class="item.valueClass">{{ item.value }}</text>
                        </view>
                    </view>
                </view>

                <view class="section-label mt-6">热门样本</view>
                <view class="data-list">
                    <view
                        v-for="(pokemon, index) in popularPokemons"
                        :key="pokemon.id"
                        class="data-row"
                        :class="{ 'data-row--last': index === popularPokemons.length - 1 }"
                        @click="goToDetail(pokemon.id)"
                    >
                        <view class="pokemon-mark" :class="pokemon.markClass">
                            <text>{{ String(pokemon.id).padStart(3, '0') }}</text>
                        </view>
                        <view class="data-row__body">
                            <view class="min-w-0 flex-1 py-3.5">
                                <text class="block text-[16px] font-semibold leading-5 tracking-[-0.01em] text-[#24262b]">{{ pokemon.name }}</text>
                                <text class="mt-1 block text-[12px] font-medium leading-4 text-[#8d929c]">{{ pokemon.type }}</text>
                            </view>
                            <view class="data-row__meta">
                                <text class="text-[11px] font-semibold text-[#b4b8c0]">详情</text>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4 text-[#c4c7cf]">
                                    <path d="m9 18 6-6-6-6"></path>
                                </svg>
                            </view>
                        </view>
                    </view>
                </view>

                <view class="section-label mt-6">研究提示</view>
                <view class="note-card">
                    <view class="note-card__shine"></view>
                    <text class="relative z-10 block text-[13px] font-bold text-[#3b3f48]">资料先按系统清单浏览。</text>
                    <text class="relative z-10 mt-1 block text-[12px] font-medium leading-5 text-[#8a8f99]">统计入口保持轻量，方便在图鉴、功能和样本详情之间快速跳转。</text>
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

const currentTab = ref(2);

const overviewItems = [
    { value: '1010', label: '宝可梦总数', desc: '当前图鉴记录的全国编号范围。', icon: 'book', iconClass: 'data-row__icon--green', valueClass: 'text-[#34b85a]' },
    { value: '18', label: '属性种类', desc: '用于筛选、克制和组合分析。', icon: 'spark', iconClass: 'data-row__icon--gold', valueClass: 'text-[#d89a1e]' },
    { value: '400+', label: '招式数量', desc: '覆盖对战计算和招式检索。', icon: 'bolt', iconClass: 'data-row__icon--blue', valueClass: 'text-[#357df4]' },
    { value: '300+', label: '特性记录', desc: '包含常见对战特性与说明。', icon: 'cube', iconClass: 'data-row__icon--violet', valueClass: 'text-[#7350d4]' }
];

const popularPokemons = [
    { id: 25, name: '皮卡丘', type: '电气属性', markClass: 'pokemon-mark--gold' },
    { id: 6, name: '喷火龙', type: '火 / 飞行', markClass: 'pokemon-mark--red' },
    { id: 9, name: '水箭龟', type: '水属性', markClass: 'pokemon-mark--blue' }
];

const goToDetail = (id: number) => {
    uni.navigateTo({
        url: `/pages/detail/detail?id=${id}`
    });
};

const onTabChange = (index: number) => {
    currentTab.value = index;
};
</script>

<style lang="scss" scoped>
.data-page {
    position: relative;
    overflow: hidden;
    color: #24262b;
    background:
        radial-gradient(circle at 18% -10%, rgba(255, 255, 255, 0.95), transparent 34%),
        linear-gradient(180deg, #f7f8fb 0%, #f1f2f6 46%, #eef0f5 100%);
}

.data-page::before {
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

.data-list,
.note-card {
    border: 1px solid rgba(255, 255, 255, 0.78);
    border-radius: 24px;
    background: rgba(255, 255, 255, 0.92);
    box-shadow: 0 18px 42px rgba(48, 55, 72, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.88);
    backdrop-filter: blur(18px);
}

.data-list {
    overflow: hidden;
}

.data-row {
    display: flex;
    align-items: center;
    min-height: 78px;
    padding-left: 14px;
    transition: background-color 0.18s ease, transform 0.18s ease;
}

.data-row:active {
    background: rgba(241, 243, 248, 0.82);
    transform: scale(0.992);
}

.data-row__icon,
.pokemon-mark {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    border-radius: 14px;
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.38), 0 10px 20px rgba(63, 70, 86, 0.12);
}

.data-row__icon {
    color: #fff;
}

.data-row__icon--green {
    background: linear-gradient(135deg, #7ad66f 0%, #34b85a 58%, #178f42 100%);
}

.data-row__icon--gold {
    color: #4c3506;
    background: linear-gradient(135deg, #ffe7a8 0%, #f4c849 54%, #e99a24 100%);
}

.data-row__icon--blue {
    background: linear-gradient(135deg, #73b7ff 0%, #357df4 58%, #275bd8 100%);
}

.data-row__icon--violet {
    background: linear-gradient(135deg, #9a86f4 0%, #7350d4 58%, #4b32a6 100%);
}

.data-row__body {
    display: flex;
    flex: 1;
    align-items: center;
    min-width: 0;
    margin-left: 14px;
    padding-right: 12px;
    border-bottom: 1px solid rgba(222, 225, 232, 0.86);
}

.data-row--last .data-row__body {
    border-bottom: 0;
}

.data-row__value {
    flex-shrink: 0;
    margin-left: 12px;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 22px;
    font-weight: 900;
    letter-spacing: -0.04em;
}

.data-row__meta {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    gap: 4px;
    margin-left: 10px;
}

.pokemon-mark {
    color: #fff;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 12px;
    font-weight: 900;
}

.pokemon-mark--gold {
    color: #4c3506;
    background: linear-gradient(135deg, #ffe7a8 0%, #f4c849 54%, #e99a24 100%);
}

.pokemon-mark--red {
    background: linear-gradient(135deg, #ff8a76 0%, #f05245 54%, #b9352f 100%);
}

.pokemon-mark--blue {
    background: linear-gradient(135deg, #73b7ff 0%, #357df4 58%, #275bd8 100%);
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
