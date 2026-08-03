<template>
    <view
        class="data-page min-h-screen page-bg"
        :style="{
            paddingTop: 'calc(var(--status-bar-height) + var(--navbar-content-height))',
            paddingBottom: '104px'
        }"
    >
        <NavBar title="资料中心" />

        <view class="relative z-10 px-4 py-4 sm:px-5">
            <view class="mx-auto max-w-[720px]">
                <view class="section-label">图鉴概览</view>
                <view class="data-list glass-panel">
                    <ListRow
                        v-for="(item, index) in overviewItems"
                        :key="item.label"
                        :title="item.label"
                        :desc="item.desc"
                        :meta="item.value"
                        :iconClass="item.iconClass"
                        :last="index === overviewItems.length - 1"
                        @click="() => {}"
                    >
                        <template #icon>
                            <svg v-if="item.icon === 'book'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" class="h-6 w-6">
                                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 3H20v18H6.5A2.5 2.5 0 0 1 4 18.5v-13A2.5 2.5 0 0 1 6.5 3z"></path><path d="M9 8h6"></path>
                            </svg>
                            <svg v-else-if="item.icon === 'spark'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" class="h-6 w-6">
                                <path d="m12 2 2.6 6.5L21 11l-6.4 2.5L12 20l-2.6-6.5L3 11l6.4-2.5L12 2z"></path>
                            </svg>
                            <svg v-else-if="item.icon === 'bolt'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" class="h-6 w-6">
                                <polygon points="13 2.5 4 14 12 14 11 21.5 20 10 12 10 13 2.5"></polygon>
                            </svg>
                            <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" class="h-6 w-6">
                                <path d="M12 3.5 19.5 8v8L12 20.5 4.5 16V8L12 3.5z"></path><path d="M12 12 19.5 8M12 12v8.5M12 12 4.5 8"></path>
                            </svg>
                        </template>
                    </ListRow>
                </view>

                <view class="section-label mt-6">热门样本</view>
                <view class="data-list glass-panel">
                    <ListRow
                        v-for="(pokemon, index) in popularPokemons"
                        :key="pokemon.id"
                        :title="pokemon.name"
                        :desc="pokemon.type"
                        meta="详情"
                        :last="index === popularPokemons.length - 1"
                        :iconClass="pokemon.markClass"
                        showChevron
                        @click="goToDetail(pokemon.id)"
                    >
                        <template #icon>
                            <text class="pokemon-mark__text">{{ String(pokemon.id).padStart(3, '0') }}</text>
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

const currentTab = ref(2);

const overviewItems = [
    { value: '1010', label: '宝可梦总数', desc: '当前图鉴记录的全国编号范围。', icon: 'book', iconClass: 'list-row__icon--green', valueClass: 'text-[#34b85a]' },
    { value: '18', label: '属性种类', desc: '用于筛选、克制和组合分析。', icon: 'spark', iconClass: 'list-row__icon--gold', valueClass: 'text-[#d89a1e]' },
    { value: '400+', label: '招式数量', desc: '覆盖对战计算和招式检索。', icon: 'bolt', iconClass: 'list-row__icon--blue', valueClass: 'text-[#357df4]' },
    { value: '300+', label: '特性记录', desc: '包含常见对战特性与说明。', icon: 'cube', iconClass: 'list-row__icon--violet', valueClass: 'text-[#7350d4]' }
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
/* 编号标记的字形；配色 .pokemon-mark--* 在 global.css（经 iconClass 传入 ListRow） */
.pokemon-mark__text {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 12px;
    font-weight: 900;
}
</style>
