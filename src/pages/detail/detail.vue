<template>
    <view class="min-h-screen bg-gradient-to-b from-[#f8f9fa] to-[#e9ecef]" :style="{ paddingTop: 'var(--status-bar-height)', paddingBottom: '100px' }">
        <!-- 顶部导航栏 -->
        <view class="fixed top-0 left-0 right-0 z-[1000] bg-white/95 backdrop-blur-lg shadow-[0_2px_12px_rgba(0,0,0,0.08)] px-4 py-3 flex items-center justify-between" :style="{ paddingTop: 'var(--status-bar-height)' }">
            <button class="w-10 h-10 rounded-full bg-white/80 shadow-md flex items-center justify-center transition-all duration-300 hover:scale-110 active:scale-95" @click="goBack">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5 text-[#333]">
                    <path d="M19 12H5"></path>
                    <polyline points="12 19 5 12 12 5"></polyline>
                </svg>
            </button>

            <view class="flex-1 flex justify-center px-3">
                <text class="font-bold text-lg text-[#333] truncate max-w-full">{{ pokemon.name || '宝可梦详情' }}</text>
            </view>

            <button class="w-10 h-10 rounded-full bg-white/80 shadow-md flex items-center justify-center transition-all duration-300 hover:scale-110 active:scale-95" @click="toggleFavorite">
                <svg v-if="!isFavorite" viewBox="0 0 24 24" fill="none" stroke="#EE5A6F" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5">
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                </svg>
                <svg v-else viewBox="0 0 24 24" fill="#EE5A6F" stroke="#EE5A6F" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5">
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                </svg>
            </button>
        </view>

        <!-- 内容区域 -->
        <scroll-view scroll-y class="h-[calc(100vh-var(--status-bar-height)-100px)] mt-[calc(var(--status-bar-height)+64px)]">
            <!-- 宝可梦头部展示区 -->
            <view class="relative overflow-hidden" :class="getGradientClass(pokemon.types)">
                <!-- 背景装饰 -->
                <view class="absolute inset-0 opacity-10">
                    <view class="absolute -right-20 -top-20 w-80 h-80 rounded-full bg-white blur-3xl"></view>
                    <view class="absolute -left-20 -bottom-20 w-60 h-60 rounded-full bg-white blur-3xl"></view>
                </view>
                
                <!-- 宝可梦图片 -->
                <view class="relative z-10 flex justify-center pt-12 pb-8">
                    <view class="relative">
                        <!-- 光晕效果 -->
                        <view class="absolute inset-0 bg-white/20 rounded-full blur-2xl scale-110"></view>
                        <image 
                            :src="pokemon.image || '/static/default.png'" 
                            mode="aspectFit" 
                            class="relative w-56 h-56 drop-shadow-2xl animate-float"
                        ></image>
                    </view>
                </view>
                
                <!-- 宝可梦信息 -->
                <view class="relative z-10 px-6 pb-8 text-center text-white">
                    <view class="flex justify-center items-center gap-3 mb-3">
                        <text class="text-4xl font-bold tracking-wider">{{ pokemon.name }}</text>
                        <text class="text-xl bg-white/25 backdrop-blur-sm px-3 py-1 rounded-full font-semibold">#{{ String(pokemon.id).padStart(3, '0') }}</text>
                    </view>
                    
                    <!-- 宝可梦类型 -->
                    <view class="flex justify-center gap-2 mt-3">
                        <view 
                            v-for="type in pokemon.types" 
                            :key="type" 
                            class="px-4 py-1.5 rounded-full text-sm font-bold bg-white/25 backdrop-blur-sm border border-white/30 shadow-lg"
                        >
                            {{ getTypeName(type) }}
                        </view>
                    </view>
                </view>
            </view>

            <!-- 基本信息卡片 -->
            <view class="mx-4 -mt-4 relative z-20 bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.08)] p-5 mb-4">
                <view class="grid grid-cols-2 gap-4">
                    <view class="flex items-center gap-3">
                        <view class="w-10 h-10 rounded-full bg-gradient-to-br from-[#FF6B6B]/10 to-[#EE5A6F]/10 flex items-center justify-center">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#EE5A6F" stroke-width="2">
                                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                                <line x1="3" y1="9" x2="21" y2="9"></line>
                                <line x1="9" y1="21" x2="9" y2="9"></line>
                            </svg>
                        </view>
                        <view>
                            <text class="text-xs text-[#999] block">身高</text>
                            <text class="text-base font-bold text-[#333]">{{ pokemon.height || 0 }}m</text>
                        </view>
                    </view>
                    
                    <view class="flex items-center gap-3">
                        <view class="w-10 h-10 rounded-full bg-gradient-to-br from-[#4ECDC4]/10 to-[#44A08D]/10 flex items-center justify-center">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4ECDC4" stroke-width="2">
                                <circle cx="12" cy="12" r="10"></circle>
                                <path d="M16 16s-1.5-2-4-2-4 2-4 2"></path>
                                <line x1="9" y1="9" x2="9.01" y2="9"></line>
                                <line x1="15" y1="9" x2="15.01" y2="9"></line>
                            </svg>
                        </view>
                        <view>
                            <text class="text-xs text-[#999] block">体重</text>
                            <text class="text-base font-bold text-[#333]">{{ pokemon.weight || 0 }}kg</text>
                        </view>
                    </view>
                    
                    <view class="flex items-center gap-3">
                        <view class="w-10 h-10 rounded-full bg-gradient-to-br from-[#A78BFA]/10 to-[#8B5CF6]/10 flex items-center justify-center">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#A78BFA" stroke-width="2">
                                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                            </svg>
                        </view>
                        <view>
                            <text class="text-xs text-[#999] block">特性</text>
                            <text class="text-base font-bold text-[#333]">{{ pokemon.abilities?.[0] || '-' }}</text>
                        </view>
                    </view>
                    
                    <view class="flex items-center gap-3">
                        <view class="w-10 h-10 rounded-full bg-gradient-to-br from-[#FBBF24]/10 to-[#F59E0B]/10 flex items-center justify-center">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FBBF24" stroke-width="2">
                                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
                                <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
                            </svg>
                        </view>
                        <view>
                            <text class="text-xs text-[#999] block">分类</text>
                            <text class="text-base font-bold text-[#333]">{{ pokemon.category || '种子宝可梦' }}</text>
                        </view>
                    </view>
                </view>
            </view>

            <!-- 能力值图表 -->
            <StatsChart :stats="pokemon.stats" :types="pokemon.types" />

            <!-- 进化链 -->
            <EvolutionChain :chain="pokemon.evolutionChain" />

            <!-- 招式列表 -->
            <MovesList :moves="pokemon.moves" />
            
            <!-- 底部留白 -->
            <view class="h-4"></view>
        </scroll-view>

        <!-- 底部 TabBar -->
        <TabBar v-model="currentTab" @change="onTabChange" />
    </view>
</template>

<script lang="ts" setup>
import EvolutionChain from '@/components/pokemon/EvolutionChain.vue'
import MovesList from '@/components/pokemon/MovesList.vue'
import StatsChart from '@/components/pokemon/StatsChart.vue'
import TabBar from '@/components/TabBar.vue'
import { usePokemonStore } from '@/store/pokemon'
import { onLoad } from '@dcloudio/uni-app'
import { computed, ref } from 'vue'

const pokemonStore = usePokemonStore()
const { toggleFavorite: storeToggleFavorite, favorites } = pokemonStore

// 计算是否已收藏
const isFavorite = computed(() => {
    return pokemon.value.id ? favorites.includes(pokemon.value.id) : false
})

// 包装收藏切换函数
const toggleFavorite = () => {
    if (pokemon.value.id) {
        storeToggleFavorite(pokemon.value.id)
    }
}

const goBack = () => {
    uni.navigateBack({
        fail: () => {
            uni.reLaunch({ url: '/pages/index/index' })
        }
    })
}

// Tab 状态
const currentTab = ref(0);

const onTabChange = (index: number) => {
    console.log('Tab changed to:', index);
};

// 使用 ref 创建响应式数据
const pokemon = ref<IPokemonBaseModel>({
    id: 0,
    name: '',
    types: [],
    abilities: [],
    hiddenAbility: '',
    image: '',
    stats: [],
    description: '',
    moves: [],
    evolutionChain: []
})

// 使用 onLoad 获取路由参数
onLoad((options: any) => {
    if (options && options.id) {
        fetchPokemonDetail(Number(options.id))
    }
})

const fetchPokemonDetail = async (id: number) => {
    try {
        // TODO: 调用真实 API 获取数据
        // 这里暂时使用模拟数据
        pokemon.value = {
            id: id,
            name: '妙蛙种子',
            types: ['grass', 'poison'],
            abilities: ['茂盛', '叶绿素'],
            hiddenAbility: '',
            image: '/static/default.png',
            height: 0.7,
            weight: 6.9,
            category: '种子宝可梦',
            stats: [
                { name: 'HP', value: 45 },
                { name: '攻击', value: 49 },
                { name: '防御', value: 49 },
                { name: '特攻', value: 65 },
                { name: '特防', value: 65 },
                { name: '速度', value: 45 }
            ],
            description: '妙蛙种子出生时背上就背着种子。种子会随着它的成长而逐渐变大并开花。',
            moves: ['藤鞭', '撞击', '飞叶快刀'],
            evolutionChain: [1, 2, 3]
        }
    } catch (error) {
        console.error('获取宝可梦详情失败:', error)
        uni.showToast({
            title: '获取详情失败',
            icon: 'none'
        })
    }
}

// 获取类型名称
const getTypeName = (type: string): string => {
    const typeNames: Record<string, string> = {
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
    }
    return typeNames[type] || type
}

// 根据类型获取渐变背景
const getGradientClass = (types: string[]): string => {
    const gradients: Record<string, string> = {
        grass: 'bg-gradient-to-br from-[#78C850] to-[#5BA33D]',
        fire: 'bg-gradient-to-br from-[#F08030] to-[#DD6E20]',
        water: 'bg-gradient-to-br from-[#6890F0] to-[#4A7BD9]',
        electric: 'bg-gradient-to-br from-[#F8D030] to-[#E5BE1A]',
        poison: 'bg-gradient-to-br from-[#A040A0] to-[#8A358A]',
        normal: 'bg-gradient-to-br from-[#A8A878] to-[#8B8A6A]',
        flying: 'bg-gradient-to-br from-[#A890F0] to-[#8A7BD9]',
        bug: 'bg-gradient-to-br from-[#A8B820] to-[#8A9A1A]',
        rock: 'bg-gradient-to-br from-[#B8A038] to-[#9A8A2E]',
        ghost: 'bg-gradient-to-br from-[#705898] to-[#5A4A7A]',
        dragon: 'bg-gradient-to-br from-[#7038F8] to-[#5A2AD9]',
        steel: 'bg-gradient-to-br from-[#B8B8D0] to-[#9A9AB0]',
        fairy: 'bg-gradient-to-br from-[#EE99AC] to-[#D97A8E]'
    }
    
    // 使用第一个类型的渐变
    return gradients[types[0]] || 'bg-gradient-to-br from-[#FF6B6B] to-[#EE5A6F]'
}

</script>

<style scoped>
/* 浮动动画 */
@keyframes float {
    0%, 100% {
        transform: translateY(0px);
    }
    50% {
        transform: translateY(-10px);
    }
}

.animate-float {
    animation: float 3s ease-in-out infinite;
}
</style>