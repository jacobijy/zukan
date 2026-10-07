<template>
    <view v-if="visible" class="picker-root">
        <view class="picker-mask" @click="close"></view>
        <view class="picker-panel">
            <view class="picker-grip"></view>
            <view class="picker-header">
                <view class="picker-header__top">
                    <text class="picker-title">{{ step === 'form' ? formTitle : title }}</text>
                    <view class="picker-close" @click="close">
                        <!-- #ifdef MP-WEIXIN -->
                        <text class="ic text-[20px]">{{ glyph('x') }}</text>
                        <!-- #endif -->
                        <!-- #ifndef MP-WEIXIN -->
                        <svg data-ic="x" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" class="h-5 w-5">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                        <!-- #endif -->
                    </view>
                </view>
                <SearchBar v-model="keyword" :placeholder="searchPlaceholder" />
            </view>

            <VirtualList
                :items="visibleItems"
                :item-height="ROW_HEIGHT"
                :item-key="keyFor"
                class="picker-list"
            >
                <template #default="{ item }">
                    <view
                        class="picker-row"
                        :class="{ 'picker-row--active': step === 'form' && isActiveForm(item) }"
                        @click="onChoose(item)"
                    >
                        <EncryptedSprite
                            :pokemon-id="item.id"
                            variant="front"
                            :preview="false"
                            :has-sprite="item.hasSprite"
                            img-class="h-10 w-10"
                            skeleton-class="h-10 w-10"
                        />
                        <view class="picker-row__main">
                            <view class="flex items-baseline gap-1.5">
                                <text class="picker-row__title">{{ item.name }}</text>
                                <text v-if="step === 'form' && item.formLabel" class="picker-row__form">{{ item.formLabel }}</text>
                            </view>
                        </view>
                        <text class="picker-row__id">NO.{{ padId(item.id) }}</text>
                    </view>
                </template>
            </VirtualList>
        </view>
    </view>
</template>

<script lang="ts" setup>
import { computed, ref, watch } from 'vue';
import SearchBar from '@/components/shared/SearchBar.vue';
import VirtualList from '@/components/dex/VirtualList.vue';
import EncryptedSprite from '@/components/sprite/EncryptedSprite.vue';
import { usePokemonStore } from '@/store/pokemon';
import { padId } from '@/utils/helpers';
import { glyph } from '@/components/icon/glyphs';

const ROW_HEIGHT = 68;

const props = defineProps<{
    visible: boolean;
    /** 物种步标题（如「选择宝可梦」） */
    title: string;
    /** 形态步标题（如「选择形态」） */
    formTitle: string;
    searchPlaceholder: string;
    /**
     * 打开时直接定位到该宝可梦的形态步（用于「快捷切换形态」）。
     * 传入含形态的 pokemon id；缺省从物种步开始。
     */
    activePokemonId?: number;
}>();
const emit = defineEmits<{
    'update:visible': [value: boolean];
    /** speciesId = 物种号；formId 缺省表示默认形态 */
    pick: [speciesId: number, formId?: number];
}>();

const pokemonStore = usePokemonStore();

const keyword = ref('');
const step = ref<'species' | 'form'>('species');
const activeSpecies = ref<number | null>(null);

// 打开时重置；若指定 activePokemonId 则直接进入其形态步（快捷切换形态）
watch(
    () => props.visible,
    async (open) => {
        if (!open) return;
        keyword.value = '';
        step.value = 'species';
        activeSpecies.value = null;
        if (props.activePokemonId) {
            const pkm = pokemonStore.getById(props.activePokemonId);
            if (pkm) {
                activeSpecies.value = pkm.speciesId ?? pkm.id;
                step.value = 'form';
            }
        }
        if (pokemonStore.defaultPokemons.length === 0) {
            try {
                await pokemonStore.fetchPokemon();
            } catch {
                close();
            }
        }
    },
);

const filteredSpecies = computed<IPokemonBaseModel[]>(() => {
    const list = pokemonStore.defaultPokemons;
    const kw = keyword.value.trim().toLowerCase().replace(/^no\./, '');
    if (!kw) return list;
    return list.filter((p) => p.name.toLowerCase().includes(kw) || padId(p.id).includes(kw));
});

const formsOfActive = computed<IPokemonBaseModel[]>(() =>
    activeSpecies.value !== null ? pokemonStore.getFormsBySpecies(activeSpecies.value) : [],
);

const visibleItems = computed<IPokemonBaseModel[]>(() =>
    step.value === 'form' ? formsOfActive.value : filteredSpecies.value,
);

const keyFor = (p: IPokemonBaseModel): number => p.id;

/** 当前选中的含形态 pokemon id（用于形态步高亮） */
const activeFormId = computed(() => props.activePokemonId);

function isActiveForm(p: IPokemonBaseModel): boolean {
    return activeFormId.value !== undefined && p.id === activeFormId.value;
}

function onChoose(p: IPokemonBaseModel): void {
    if (step.value === 'species') {
        const sid = p.speciesId ?? p.id;
        if (pokemonStore.getFormsBySpecies(sid).length > 1) {
            activeSpecies.value = sid;
            step.value = 'form';
            keyword.value = '';
            return;
        }
        emit('pick', sid); // 默认形态不带 formId
        close();
        return;
    }

    const sid = activeSpecies.value!;
    const formId = p.id === sid ? undefined : p.id;
    emit('pick', sid, formId);
    close();
}

function close(): void {
    emit('update:visible', false);
}
</script>

<style lang="scss" scoped>
.picker-root {
    position: fixed;
    inset: 0;
    z-index: 1500;
    pointer-events: none;
}

/* 底部抽屉：只做入场动画、关闭即 v-if 卸载（不做退出过渡，避免遮罩残留） */
.picker-mask {
    position: absolute;
    inset: 0;
    pointer-events: auto;
    background: rgba(36, 38, 43, 0.42);
    backdrop-filter: blur(6px);
    animation: picker-fade 0.28s ease-out;
}

.picker-panel {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    flex-direction: column;
    max-height: 84vh;
    padding: 0 16px calc(env(safe-area-inset-bottom, 0) + 12px);
    pointer-events: auto;
    background: #ffffff;
    border-radius: 26px 26px 0 0;
    box-shadow: 0 -24px 60px rgba(48, 55, 72, 0.22);
    animation: picker-slide-up 0.34s cubic-bezier(0.22, 1, 0.36, 1);
}

@keyframes picker-fade {
    from {
        background: rgba(36, 38, 43, 0);
        backdrop-filter: blur(0);
    }
}

@keyframes picker-slide-up {
    from {
        transform: translateY(100%);
    }
}

.picker-grip {
    flex-shrink: 0;
    align-self: center;
    width: 38px;
    height: 5px;
    margin: 8px 0 4px;
    border-radius: 999px;
    background: #e6e8ee;
}

.picker-header {
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
    gap: 10px;
    padding: 6px 2px 12px;
}

.picker-header__top {
    display: flex;
    align-items: center;
    justify-content: space-between;
}

.picker-title {
    font-size: 18px;
    font-weight: 900;
    letter-spacing: -0.02em;
    color: #1a1d24;
}

.picker-close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    border-radius: 999px;
    background: #f2f3f7;
    color: #6f7682;
}

.picker-list {
    flex: 1;
    min-height: 0;
    max-height: 60vh;
}

.picker-row {
    display: flex;
    align-items: center;
    box-sizing: border-box;
    height: 100%;
    padding: 0 6px;
    border-bottom: 1px solid #eef0f4;

    &--active {
        background: #eef4ff;

        .picker-row__title {
            color: #357df4;
        }
    }
}

.picker-row__main {
    flex: 1;
    min-width: 0;
}

.picker-row__title {
    overflow: hidden;
    font-size: 15px;
    font-weight: 700;
    color: #24262b;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.picker-row__form {
    overflow: hidden;
    font-size: 11px;
    font-weight: 700;
    color: #9aa0ab;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.picker-row__id {
    flex-shrink: 0;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 11px;
    font-weight: 800;
    color: #b6bac3;
}
</style>
