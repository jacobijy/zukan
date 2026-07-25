<template>
    <view class="detail-page min-h-screen page-bg" :style="{ paddingTop: 'var(--status-bar-height)', paddingBottom: '100px' }">
        <DetailNavbar :title="pokemon.name || '宝可梦详情'" @back="goBack">
            <template #right>
                <button class="detail-icon-button" :class="isFavorite ? 'detail-icon-button--active' : ''" @click="toggleFavorite">
                    <svg viewBox="0 0 24 24" :fill="isFavorite ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5">
                        <polygon points="12 2.8 14.9 8.7 21.4 9.65 16.7 14.25 17.8 20.75 12 17.68 6.2 20.75 7.3 14.25 2.6 9.65 9.1 8.7 12 2.8"></polygon>
                    </svg>
                </button>
            </template>
        </DetailNavbar>

        <scroll-view scroll-y class="relative z-10 h-[calc(100vh-var(--status-bar-height)-100px)] mt-[calc(var(--status-bar-height)+64px)] px-4 pb-4">
            <view class="mx-auto max-w-[1000px]">
                <view class="specimen-hero mb-3">
                    <text class="specimen-hero__number">{{ String(pokemon.id || 0).padStart(3, '0') }}</text>
                    <view class="specimen-hero__image-wrap">
                        <view class="specimen-hero__image-frame">
                            <view class="absolute inset-3 rounded-[26px] border border-dashed border-[#c9ced8]"></view>
                            <EncryptedSprite
                              :pokemon-id="pokemon.id"
                              variant="default"
                              img-class="relative z-10 h-48 w-48 drop-shadow-[0_18px_18px_rgba(48,55,72,0.16)]"
                              skeleton-class="h-48 w-48"
                            />
                        </view>
                    </view>

                    <view class="relative z-10 px-5 pb-5 text-center">
                        <view class="mb-2 flex items-center justify-center gap-2">
                            <text class="text-[34px] font-black leading-none tracking-[-0.06em] text-[#24262b]">{{ pokemon.name }}</text>
                            <text class="rounded-full border border-[#e1e4eb] bg-[#f5f6fa] px-3 py-1 font-mono text-xs font-black text-[#8d929c]">NO.{{ String(pokemon.id || 0).padStart(3, '0') }}</text>
                        </view>
                        <view class="flex justify-center gap-2">
                            <view
                                v-for="type in pokemon.types"
                                :key="type"
                                class="rounded-full px-4 py-1.5 text-sm font-black text-white shadow-[0_8px_16px_rgba(0,0,0,0.12)]"
                                :class="getTypeClass(type)"
                            >
                                {{ getTypeName(type) }}
                            </view>
                        </view>
                        <text class="mx-auto mt-3 block max-w-[620px] text-sm font-semibold leading-6 text-[#6f7682]">{{ pokemon.description }}</text>
                    </view>
                </view>

                <view class="info-grid mb-3">
                    <view v-for="item in infoItems" :key="item.label" class="info-card">
                        <view class="info-card__icon" :class="item.iconClass">
                            <svg v-if="item.icon === 'height'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5">
                                <path d="M6 21V3"></path>
                                <path d="M3 6l3-3 3 3"></path>
                                <path d="M3 18l3 3 3-3"></path>
                                <path d="M13 6h8"></path>
                                <path d="M13 12h5"></path>
                                <path d="M13 18h8"></path>
                            </svg>
                            <svg v-else-if="item.icon === 'weight'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5">
                                <path d="M7 8a5 5 0 0 1 10 0"></path>
                                <path d="M5 8h14l-1.5 13h-11L5 8z"></path>
                            </svg>
                            <svg v-else-if="item.icon === 'star'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5">
                                <polygon points="12 2.8 14.9 8.7 21.4 9.65 16.7 14.25 17.8 20.75 12 17.68 6.2 20.75 7.3 14.25 2.6 9.65 9.1 8.7 12 2.8"></polygon>
                            </svg>
                            <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5">
                                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
                                <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
                            </svg>
                        </view>
                        <view class="min-w-0">
                            <text class="block text-[10px] font-black tracking-[0.14em] text-[#8d929c]">{{ item.label }}</text>
                            <text class="mt-1 block truncate text-base font-black text-[#24262b]">{{ item.value }}</text>
                        </view>
                    </view>
                </view>

                <StatsChart :stats="pokemon.stats" :types="pokemon.types" />
                <EvolutionChain :chain="pokemon.evolutionChain" />
                <MovesList :moves="pokemon.moves" />
                <view class="h-4"></view>
            </view>
        </scroll-view>

        <TabBar v-model="currentTab" @change="onTabChange" />
    </view>
</template>

<script lang="ts" setup>
import EvolutionChain from '@/components/pokemon/EvolutionChain.vue'
import MovesList from '@/components/pokemon/MovesList.vue'
import StatsChart from '@/components/pokemon/StatsChart.vue'
import TabBar from '@/components/TabBar.vue'
import DetailNavbar from '@/components/shared/DetailNavbar.vue'
import EncryptedSprite from '@/components/sprite/EncryptedSprite.vue'
import { usePokemonStore } from '@/store/pokemon'
import { onLoad } from '@dcloudio/uni-app'
import { computed, ref } from 'vue'

const pokemonStore = usePokemonStore()
const { toggleFavorite: storeToggleFavorite, favorites } = pokemonStore

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

const isFavorite = computed(() => {
    return pokemon.value.id ? favorites.includes(pokemon.value.id) : false
})

const infoItems = computed(() => [
    { label: '身高', value: `${pokemon.value.height || 0}m`, icon: 'height', iconClass: 'info-card__icon--green' },
    { label: '体重', value: `${pokemon.value.weight || 0}kg`, icon: 'weight', iconClass: 'info-card__icon--gold' },
    { label: '特性', value: pokemon.value.abilities?.[0] || '-', icon: 'star', iconClass: 'info-card__icon--red' },
    { label: '分类', value: pokemon.value.category || '种子宝可梦', icon: 'book', iconClass: 'info-card__icon--paper' }
])

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

const currentTab = ref(0);

const onTabChange = (index: number) => {
    console.log('Tab changed to:', index);
};

onLoad((options: any) => {
    if (options && options.id) {
        fetchPokemonDetail(Number(options.id))
    }
})

const fetchPokemonDetail = async (id: number) => {
    try {
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

const getTypeClass = (type: string) => {
    const typeColors: Record<string, string> = {
        normal: 'bg-gradient-to-br from-[#A8A77A] to-[#72714d]',
        fire: 'bg-gradient-to-br from-[#f58b38] to-[#c84b22]',
        water: 'bg-gradient-to-br from-[#5b95f0] to-[#2763c8]',
        electric: 'bg-gradient-to-br from-[#ffd84a] to-[#d99b00] text-[#2f2a12]',
        grass: 'bg-gradient-to-br from-[#83c85a] to-[#3f8f3d]',
        ice: 'bg-gradient-to-br from-[#9adfdc] to-[#50a7aa] text-[#17383a]',
        fighting: 'bg-gradient-to-br from-[#c83a30] to-[#7f211d]',
        poison: 'bg-gradient-to-br from-[#a44ab0] to-[#682672]',
        ground: 'bg-gradient-to-br from-[#e4bf67] to-[#9b7332] text-[#2f2414]',
        flying: 'bg-gradient-to-br from-[#a996f2] to-[#6a55c7]',
        psychic: 'bg-gradient-to-br from-[#ff6794] to-[#c82e63]',
        bug: 'bg-gradient-to-br from-[#a9bd24] to-[#687b11]',
        rock: 'bg-gradient-to-br from-[#bba33d] to-[#756527]',
        ghost: 'bg-gradient-to-br from-[#725799] to-[#3d2b62]',
        dragon: 'bg-gradient-to-br from-[#7042ff] to-[#3519a8]',
        dark: 'bg-gradient-to-br from-[#715847] to-[#35261f]',
        steel: 'bg-gradient-to-br from-[#bfc0d4] to-[#797b96] text-[#242638]',
        fairy: 'bg-gradient-to-br from-[#df8bb6] to-[#a94f7c]'
    };
    return typeColors[type] || 'bg-gradient-to-br from-[#78906a] to-[#43543a]';
};
</script>

<style scoped>


.detail-navbar {
    background: #ffffff;
    border-bottom: 1px solid #e5e7ee;
    box-shadow: 0 4px 18px rgba(48, 55, 72, 0.06);
}

.detail-icon-button {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    padding: 0;
    margin: 0;
    color: #8d929c;
    background: transparent;
    border: 0;
}

.detail-icon-button--active {
    color: #e04f47;
}

.specimen-hero,
.info-card {
    border: 1px solid #e5e7ee;
    background: #ffffff;
    box-shadow: 0 14px 34px rgba(48, 55, 72, 0.08);
}

.specimen-hero {
    position: relative;
    overflow: hidden;
    border-radius: 34px;
}

.specimen-hero::before {
    display: none;
}

.specimen-hero__number {
    position: absolute;
    right: -8px;
    bottom: 2px;
    color: #eef0f5;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 120px;
    font-weight: 900;
    line-height: 1;
    letter-spacing: -0.08em;
}

.specimen-hero__image-wrap {
    position: relative;
    z-index: 1;
    display: flex;
    justify-content: center;
    padding: 28px 0 8px;
}

.specimen-hero__image-frame {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 230px;
    height: 230px;
    border: 1px solid #e5e7ee;
    border-radius: 38px;
    background: #f5f6fa;
    box-shadow: inset 0 1px 0 #ffffff, 0 18px 34px rgba(48, 55, 72, 0.08);
}

.info-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
}

.info-card {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 0;
    padding: 13px;
    border-radius: 22px;
}

.info-card__icon {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    width: 42px;
    height: 42px;
    border-radius: 15px;
}

.info-card__icon--green {
    color: #ffffff;
    background: linear-gradient(135deg, #68cc67, #34b85a);
}

.info-card__icon--gold {
    color: #3b2c0d;
    background: linear-gradient(135deg, #f4d06f, #d89a1e);
}

.info-card__icon--red {
    color: #ffffff;
    background: linear-gradient(135deg, #ff7b6e, #e04f47);
}

.info-card__icon--paper {
    color: #ffffff;
    background: linear-gradient(135deg, #73b7ff, #357df4);
}
</style>
