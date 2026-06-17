<template>
    <view class="specimen-card w-full cursor-pointer" @click="onClick">
        <view class="specimen-card__inner relative overflow-hidden rounded-[22px] border border-[#e5e7ee] bg-white p-2.5 shadow-[0_14px_34px_rgba(48,55,72,0.08)] transition-all duration-300 active:scale-[0.985] sm:p-3">
            <text class="absolute -right-1 bottom-0 font-mono text-[58px] font-black leading-none tracking-[-0.08em] text-[#eef0f5]">{{ String(props.pokemon.id).padStart(3, '0') }}</text>

            <view class="relative z-10 flex items-center gap-3">
                <view class="specimen-card__portrait relative flex h-[76px] w-[76px] shrink-0 items-center justify-center rounded-[20px] border border-[#e5e7ee] bg-[#f5f6fa] shadow-[inset_0_1px_0_#ffffff,0_12px_22px_rgba(48,55,72,0.08)] sm:h-20 sm:w-20">
                    <view class="absolute inset-2 rounded-[15px] border border-dashed border-[#c9ced8]"></view>
                    <image :src="props.pokemon.image || '/static/default.png'" class="relative z-10 h-16 w-16 drop-shadow-[0_10px_10px_rgba(48,55,72,0.14)] sm:h-[70px] sm:w-[70px]" mode="aspectFit" />
                </view>

                <view class="flex min-w-0 flex-1 items-center gap-2">
                    <view class="min-w-0 flex-1">
                        <view class="flex items-center gap-1">
                            <text class="font-mono text-[12px] font-black leading-tight tracking-[0.12em] text-[#9da2ad]">NO.{{ String(props.pokemon.id).padStart(3, '0') }}</text>
                            <button
                                class="favorite-btn favorite-btn--heart flex h-4 w-4 items-center justify-center text-[#b96a52] transition-all duration-200 active:scale-90"
                                @click.stop="toggleFavorite"
                            >
                                <svg viewBox="0 0 24 24" :fill="isFavorite ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" class="h-3.5 w-3.5" :class="isFavorite ? 'text-[#e04f47]' : 'text-[#b96a52]'">
                                    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41 0.81 4.5 2.08C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"></path>
                                </svg>
                            </button>
                        </view>
                        <text class="mt-1 block min-w-0 truncate text-[20px] font-black leading-tight tracking-[-0.03em] text-[#24262b] sm:text-[21px]">{{ props.pokemon.name }}</text>
                    </view>

                    <view class="flex shrink-0 flex-col items-end justify-center gap-1">
                        <view
                            v-for="type in props.pokemon.types"
                            :key="type"
                            class="min-w-[48px] rounded-full px-2.5 py-1 text-center text-[10px] font-black tracking-[0.06em] text-white shadow-[0_6px_12px_rgba(0,0,0,0.12)]"
                            :class="getTypeClass(type)"
                        >
                            {{ getTypeName(type) }}
                        </view>
                    </view>
                </view>
            </view>
        </view>
    </view>
</template>

<script lang="ts" setup>
import { usePokemonStore } from '@/store/pokemon';
import { computed } from 'vue';

interface Props {
    pokemon: IPokemonCardModel;
}

const props = defineProps<Props>();
const pokemonStore = usePokemonStore();

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

const isFavorite = computed(() => pokemonStore.isFavorite(props.pokemon.id));

const getTypeName = (type: string) => {
    return typeNames[type] || type;
};

const getTypeClass = (type: string) => {
    const typeColors: { [key: string]: string } = {
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

const toggleFavorite = () => {
    pokemonStore.toggleFavorite(props.pokemon.id);
};

const onClick = () => {
    uni.navigateTo({
        url: `/pages/detail/detail?id=${props.pokemon.id}`
    });
};
</script>

<style lang="scss" scoped>
.specimen-card__inner {
    isolation: isolate;
}

.specimen-card__inner::before {
    display: none;
}

.specimen-card:active .specimen-card__portrait {
    transform: rotate(-2deg) translateY(2px);
}

.favorite-btn::after {
    border: none !important;
}
</style>
