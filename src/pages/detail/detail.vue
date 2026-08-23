<template>
    <view class="detail-page min-h-screen page-bg" :style="{ paddingTop: 'var(--status-bar-height)', paddingBottom: '100px' }">
        <DetailNavbar :title="pokemon.name || t('detail.titleFallback')" fallback-url="/pages/index/index" @back="goBack">
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
                    <InfoCard :label="t('detail.info.height')" :value="`${pokemon.height || 0}m`" icon-class="info-card__icon--green">
                        <template #icon>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5">
                                <path d="M6 21V3"></path>
                                <path d="M3 6l3-3 3 3"></path>
                                <path d="M3 18l3 3 3-3"></path>
                                <path d="M13 6h8"></path>
                                <path d="M13 12h5"></path>
                                <path d="M13 18h8"></path>
                            </svg>
                        </template>
                    </InfoCard>
                    <InfoCard :label="t('detail.info.weight')" :value="`${pokemon.weight || 0}kg`" icon-class="info-card__icon--gold">
                        <template #icon>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5">
                                <path d="M7 8a5 5 0 0 1 10 0"></path>
                                <path d="M5 8h14l-1.5 13h-11L5 8z"></path>
                            </svg>
                        </template>
                    </InfoCard>
                    <InfoCard :label="t('detail.info.eggGroup')" :value="eggGroupText" icon-class="info-card__icon--paper">
                        <template #icon>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5">
                                <path d="M12 3c-3.5 0-7 4.5-7 9.5A7 7 0 0 0 12 20a7 7 0 0 0 7-7.5C19 7.5 15.5 3 12 3z"></path>
                            </svg>
                        </template>
                    </InfoCard>
                    <InfoCard :label="t('detail.info.category')" :value="pokemon.category || t('detail.info.categoryFallback')" icon-class="info-card__icon--paper">
                        <template #icon>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5">
                                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
                                <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
                            </svg>
                        </template>
                    </InfoCard>

                    <InfoCard
                        wide
                        :label="t('detail.info.ability')"
                        value=""
                        icon-class="info-card__icon--red"
                    >
                        <template #icon>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5">
                                <polygon points="12 2.8 14.9 8.7 21.4 9.65 16.7 14.25 17.8 20.75 12 17.68 6.2 20.75 7.3 14.25 2.6 9.65 9.1 8.7 12 2.8"></polygon>
                            </svg>
                        </template>
                        <template #value>
                            <view v-if="abilityEntries.length" class="mt-1.5 flex flex-wrap gap-1.5">
                                <view
                                    v-for="(ab, i) in abilityEntries"
                                    :key="i"
                                    class="flex items-center gap-1 rounded-full px-2.5 py-1"
                                    :class="ab.hidden ? 'bg-[#f3e8ff]' : 'bg-[#f1f3f8]'"
                                >
                                    <text class="text-xs font-bold leading-tight" :class="ab.hidden ? 'text-[#9333ea]' : 'text-[#24262b]'">{{ ab.name }}</text>
                                </view>
                            </view>
                            <text v-else class="mt-1 block text-base font-black text-[#24262b]">-</text>
                        </template>
                    </InfoCard>
                </InfoGrid>

                <StatsChart :stats="pokemon.stats" :types="pokemon.types" />
                <EvolutionChain :chain="evolutionChain" :loading="evolutionLoading" />
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
import { useI18n } from 'vue-i18n'
import { genForPokemonId, loadMovesForPokemon, loadEvolutionChain } from '@/services/pokemon'
import { onLoad } from '@dcloudio/uni-app'
import { storeToRefs } from 'pinia'
import { computed, ref } from 'vue'

const pokemonStore = usePokemonStore()
const i18nStore = useI18nStore()
const { t } = useI18n()
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
    eggGroups: [],
    image: '',
    stats: [],
    description: '',
    moves: [],
    evolutionChain: []
})

const isFavorite = computed(() => {
    return pokemon.value.id ? favorites.value.includes(pokemon.value.id) : false
})

// 1~2 个蛋组用「 / 」连接；i18n 未就绪时数组里是数字占位，过滤掉。
const eggGroupText = computed(() => {
    const groups = (pokemon.value.eggGroups ?? []).filter(s => s && !/^\d+$/.test(s))
    return groups.length ? groups.join(' / ') : '-'
})

// 特性可能有 1~2 个普通特性 + 0/1 个隐藏特性，详情页需全部展示。
// 过滤掉 i18n 未就绪时的数字占位 / 空串，避免渲染无意义值。
const abilityEntries = computed<{ name: string; hidden: boolean }[]>(() => {
    const isPlaceholder = (s: string) => !s || /^\d+$/.test(s)
    const normal = (pokemon.value.abilities ?? []).filter(s => !isPlaceholder(s))
    const entries = normal.map(name => ({ name, hidden: false }))
    const hidden = pokemon.value.hiddenAbility
    if (hidden && !isPlaceholder(hidden)) entries.push({ name: hidden, hidden: true })
    return entries
})

// ── 形态切换 ──────────────────────────────────────────────
// 同 species 的所有形态；单形态时数组只有一条，切换器不渲染。
// 无正面立绘的形态（hasSprite === false）不在左右切换中出现——
// 数据层已判定官方无可展示图，放进来只会裂图/占位，挡在用户和正常形态之间。
// 当前形态自身无立绘时仍保留自身，否则会无形态可显。
const forms = computed<IPokemonBaseModel[]>(() => {
    const sid = pokemon.value.speciesId ?? pokemon.value.id
    if (!sid) return []
    const list = pokemonStore.getFormsBySpecies(sid)
    if (list.length === 0) return [pokemon.value]
    const visible = list.filter(f => f.hasSprite !== false || f.id === pokemon.value.id)
    return visible.length > 0 ? visible : [pokemon.value]
})
const formCount = computed(() => forms.value.length)
const formIndex = computed(() =>
    Math.max(0, forms.value.findIndex(f => f.id === pokemon.value.id))
)
const currentFormLabel = computed(() => {
    const p = pokemon.value
    if (p.isDefault) return t('detail.form.default')
    return p.formLabel || t('detail.form.label', { id: p.id })
})
const switchForm = (delta: 1 | -1) => {
    if (formCount.value <= 1) return
    const next = (formIndex.value + delta + formCount.value) % formCount.value
    pokemon.value = forms.value[next]
    loadMoves(pokemon.value.id)
}

// ── 进化链（按 species，形态切换不重取） ──────────────────
const evolutionChain = ref<EvolutionStage | null>(null)
const evolutionLoading = ref(false)
let evolutionToken = 0

async function loadEvolution(speciesId: number | undefined) {
    const sid = speciesId ?? 0
    if (!sid) {
        evolutionChain.value = null
        evolutionLoading.value = false
        return
    }
    const token = ++evolutionToken
    evolutionLoading.value = true
    evolutionChain.value = null
    try {
        const chain = await loadEvolutionChain(sid)
        if (token === evolutionToken) evolutionChain.value = chain
    } catch (err) {
        console.warn('[detail] evolution load failed', err)
        if (token === evolutionToken) evolutionChain.value = null
    } finally {
        if (token === evolutionToken) evolutionLoading.value = false
    }
}

const toggleFavorite = () => {
    if (pokemon.value.id) {
        storeToggleFavorite(pokemon.value.id)
    }
}

const goBack = () => {
    // DetailNavbar 内部已处理 navigateBack / reLaunch 兜底
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
            loadEvolution(found.speciesId)
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
                loadEvolution(found.speciesId)
                return
            }
        }

        // 3. 兜底失败
        uni.showToast({ title: t('detail.toast.notFound'), icon: 'none' })
    } catch (error) {
        console.error('获取宝可梦详情失败:', error)
        uni.showToast({ title: t('detail.toast.loadFailed'), icon: 'none' })
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
