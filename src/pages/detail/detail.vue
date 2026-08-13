<template>
    <view class="detail-page min-h-screen page-bg" :style="{ paddingTop: 'var(--status-bar-height)', paddingBottom: '100px' }">
        <DetailNavbar :title="pokemon.name || '宝可梦详情'" @back="goBack">
            <template #right>
                <FavoriteButton :active="isFavorite" @toggle="toggleFavorite" />
            </template>
        </DetailNavbar>

        <scroll-view scroll-y class="relative z-10 h-[calc(100vh-var(--status-bar-height)-100px)] mt-[calc(var(--status-bar-height)+64px)] px-4 pb-4">
            <view class="mx-auto max-w-[1000px]">
                <SpecimenHero
                    :pokemon="pokemon"
                    :formIndex="formIndex"
                    :formCount="formCount"
                    :currentFormLabel="currentFormLabel"
                    @switch-form="switchForm"
                />

                <InfoGrid>
                    <InfoCard v-for="item in infoItems" :key="item.label" :label="item.label" :value="item.value" :icon-class="item.iconClass">
                        <template #icon>
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
                        </template>
                    </InfoCard>
                </InfoGrid>

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
import FavoriteButton from '@/components/shared/FavoriteButton.vue'
import SpecimenHero from '@/components/pokemon/SpecimenHero.vue'
import InfoGrid from '@/components/pokemon/InfoGrid.vue'
import InfoCard from '@/components/pokemon/InfoCard.vue'
import { usePokemonStore } from '@/store/pokemon'
import { useI18nStore } from '@/store/i18n'
import { genForPokemonId, loadMovesForPokemon } from '@/services/pokemon'
import { onLoad } from '@dcloudio/uni-app'
import { storeToRefs } from 'pinia'
import { computed, ref } from 'vue'

const pokemonStore = usePokemonStore()
const i18nStore = useI18nStore()
// 确保招式/特性名称表已加载：深链进入时 boot 可能尚未跑完，
// MoveCard 会响应式地在名称到达后刷新。
void i18nStore.ensureLoaded()
// favorites 走 storeToRefs 拿响应式引用；toggleFavorite 是 action 可以直接解构
const { favorites } = storeToRefs(pokemonStore)
const { toggleFavorite: storeToggleFavorite } = pokemonStore

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
    return pokemon.value.id ? favorites.value.includes(pokemon.value.id) : false
})

const infoItems = computed(() => [
    { label: '身高', value: `${pokemon.value.height || 0}m`, icon: 'height', iconClass: 'info-card__icon--green' },
    { label: '体重', value: `${pokemon.value.weight || 0}kg`, icon: 'weight', iconClass: 'info-card__icon--gold' },
    { label: '特性', value: pokemon.value.abilities?.[0] || '-', icon: 'star', iconClass: 'info-card__icon--red' },
    { label: '分类', value: pokemon.value.category || '种子宝可梦', icon: 'book', iconClass: 'info-card__icon--paper' }
])

// ── 形态切换 ──────────────────────────────────────────────
// 同 species 的所有形态；单形态时数组只有一条，切换器不渲染。
const forms = computed<IPokemonBaseModel[]>(() => {
    const sid = pokemon.value.speciesId ?? pokemon.value.id
    if (!sid) return []
    const list = pokemonStore.getFormsBySpecies(sid)
    return list.length > 0 ? list : [pokemon.value]
})
const formCount = computed(() => forms.value.length)
const formIndex = computed(() =>
    Math.max(0, forms.value.findIndex(f => f.id === pokemon.value.id))
)
const currentFormLabel = computed(() => {
    const p = pokemon.value
    if (p.isDefault) return '默认形态'
    return p.formLabel || `形态 #${p.id}`
})
const switchForm = (delta: 1 | -1) => {
    if (formCount.value <= 1) return
    const next = (formIndex.value + delta + formCount.value) % formCount.value
    pokemon.value = forms.value[next]
    loadMoves(pokemon.value.id)
}

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

const onTabChange = (_index: number) => {
    // 预留：需要时在这里响应 tab 切换
};

onLoad(async (options: any) => {
    const id = Number(options?.id)
    if (!Number.isFinite(id) || id <= 0) return
    await loadPokemonById(id)
})

/**
 * 从 store 拉真实数据；深链或跨代访问时兜底切换到目标 gen。
 * 拉不到就静默显示空态 + toast，不再 fallback 到硬编码 Bulbasaur。
 */
const loadPokemonById = async (id: number) => {
    try {
        // 1. store 首次访问兜底（正常从首页进入时 store 已 fetch）
        if (pokemonStore.allPokemons.length === 0) {
            await pokemonStore.fetchPokemon()
        }

        let found = pokemonStore.getById(id)
        if (found) {
            pokemon.value = found
            loadMoves(id)
            return
        }

        // 2. 跨代深链：按 id 号段推算 gen 并切换
        const gen = genForPokemonId(id)
        if (gen && gen !== pokemonStore.currentGenId) {
            await pokemonStore.fetchPokemon(gen)
            found = pokemonStore.getById(id)
            if (found) {
                pokemon.value = found
                loadMoves(id)
                return
            }
        }

        // 3. 兜底失败
        uni.showToast({ title: '未找到该宝可梦', icon: 'none' })
    } catch (error) {
        console.error('获取宝可梦详情失败:', error)
        uni.showToast({ title: '获取详情失败', icon: 'none' })
    }
}

/**
 * 按 form id 拉招式表并回填 pokemon.moves。竞态守卫：
 * 加载完成时 pokemon 已切到别处则丢弃结果。
 */
async function loadMoves(pokemonId: number) {
    try {
        const moves = await loadMovesForPokemon(pokemonId)
        if (pokemon.value.id === pokemonId) {
            pokemon.value = { ...pokemon.value, moves }
        }
    } catch (err) {
        console.warn('[detail] moves load failed', err)
    }
}
</script>

<style scoped>
/* 所有样式已移至组件内 */
</style>
