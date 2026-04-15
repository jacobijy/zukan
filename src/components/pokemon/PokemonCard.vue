<template>
    <view class="w-full cursor-pointer" @click="onClick">
        <view class="relative flex items-center bg-white rounded-2xl p-4 mb-2 shadow-[0_2px_12px_rgba(0,0,0,0.08)] overflow-hidden border border-black/4 active:scale-98 group">
            <!-- 背景装饰 -->
            <view class="absolute -top-1/2 -right-1/5 w-[200px] h-[200px] bg-[radial-gradient(circle,rgba(255,107,107,0.08)_0%,transparent_70%)] rounded-full pointer-events-none"></view>
            
            <!-- 头像区域 -->
            <view class="relative mr-4 flex-shrink-0">
                <image :src="'/static/default.png'" class="relative w-20 h-20 rounded-full bg-gradient-to-br from-[#f5f7fa] to-[#c3cfe2] p-1 z-10" mode="aspectFit" />
                <!-- 收藏按钮 -->
                <view class="absolute -top-1 -right-1 w-7 h-7 bg-white rounded-full flex items-center justify-center shadow-[0_2px_8px_rgba(0,0,0,0.15)] cursor-pointer transition-all duration-300 z-20 hover:scale-110 active:scale-95" @click.stop="toggleFavorite">
                    <!-- 未收藏 - 空心星 -->
                    <svg v-if="!isFavorite" viewBox="0 0 24 24" fill="none" stroke="#FFD700" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                    </svg>
                    <!-- 已收藏 - 实心星 -->
                    <svg v-else viewBox="0 0 24 24" fill="#FFD700" stroke="#FFD700" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                    </svg>
                </view>
            </view>

            <!-- 信息区域 -->
            <view class="flex-1 flex flex-col gap-2.5 z-10">
                <!-- 编号和名称 -->
                <view class="flex flex-col gap-1">
                    <text class="text-xs text-[#999] font-medium tracking-wide">No.{{ String(props.pokemon.id).padStart(3, '0') }}</text>
                    <text class="text-lg font-bold text-[#333] leading-tight">{{ props.pokemon.name }}</text>
                </view>

                <!-- 类型区域 -->
                <view class="flex gap-2 flex-wrap">
                    <view 
                        v-for="(type, index) in props.pokemon.types"
                        :key="index"
                        class="px-3 py-1 rounded-xl text-xs font-semibold text-white shadow-[0_2px_6px_rgba(0,0,0,0.1)]"
                        :class="getTypeClass(type)"
                    >
                        {{ getTypeName(type) }}
                    </view>
                </view>
            </view>
        </view>
    </view>
</template>

<script lang="ts" setup>
import { usePokemonStore } from '@/store/pokemon';
import { storeToRefs } from 'pinia';
import { computed } from 'vue';

interface Props {
    pokemon: IPokemonCardModel;
    key: number;
}

const props = defineProps<Props>();
const pokemonStore = usePokemonStore();
const { favorites } = storeToRefs(pokemonStore);

// 检查是否收藏
const isFavorite = computed(() => {
    return favorites.value.includes(props.pokemon.id);
});

// 方法
const typeNames: { [key: string]: string } = {
    normal: '一般',
    fire: '火',
    water: '水',
    electric: '电',
    grass: '草',
    ice: '冰',
    fighting: '格斗',
    poison: '毒',
    ground: '地面',
    flying: '飞行',
    psychic: '超能力',
    bug: '虫',
    rock: '岩石',
    ghost: '幽灵',
    dragon: '龙',
    dark: '恶',
    steel: '钢',
    fairy: '妖精'
};

const getTypeName = (type: string) => {
    return typeNames[type] || type;
};

// 获取类型样式类名
const getTypeClass = (type: string) => {
    const typeColors: { [key: string]: string } = {
        normal: 'bg-gradient-to-br from-[#A8A77A] to-[#8B8A6A]',
        fire: 'bg-gradient-to-br from-[#EE8130] to-[#D96E28]',
        water: 'bg-gradient-to-br from-[#6390F0] to-[#4A7BD9]',
        electric: 'bg-gradient-to-br from-[#F7D02C] to-[#E5BE1A] text-[#333]',
        grass: 'bg-gradient-to-br from-[#7AC74C] to-[#6BB33D]',
        ice: 'bg-gradient-to-br from-[#96D9D6] to-[#7EC5C2] text-[#333]',
        fighting: 'bg-gradient-to-br from-[#C22E28] to-[#A82620]',
        poison: 'bg-gradient-to-br from-[#A33EA1] to-[#8E358C]',
        ground: 'bg-gradient-to-br from-[#E2BF65] to-[#CFAA52] text-[#333]',
        flying: 'bg-gradient-to-br from-[#A98FF3] to-[#9478E0]',
        psychic: 'bg-gradient-to-br from-[#F95587] to-[#E64073]',
        bug: 'bg-gradient-to-br from-[#A6B91A] to-[#92A316]',
        rock: 'bg-gradient-to-br from-[#B6A136] to-[#A18D2E]',
        ghost: 'bg-gradient-to-br from-[#735797] to-[#614880]',
        dragon: 'bg-gradient-to-br from-[#6F35FC] to-[#5C23E0]',
        dark: 'bg-gradient-to-br from-[#705746] to-[#5C4739]',
        steel: 'bg-gradient-to-br from-[#B7B7CE] to-[#A3A3BA] text-[#333]',
        fairy: 'bg-gradient-to-br from-[#D685AD] to-[#C27098]'
    };
    return typeColors[type] || '';
};

const onClick = () => {
    uni.navigateTo({
        url: `/pages/detail/detail?id=${props.pokemon.id}`
    });
};

const toggleFavorite = () => {
    pokemonStore.toggleFavorite(props.pokemon.id);
};
</script>

<style lang="scss" scoped>
/* 所有样式已迁移至 Tailwind CSS */
</style>
