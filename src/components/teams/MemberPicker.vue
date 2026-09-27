<template>
    <view v-if="visible" class="picker-root">
        <view class="picker-panel">
            <view class="picker-header">
                <view class="picker-header__top">
                    <text class="picker-title">{{ step === 'form' ? t('teams.pickForm') : t('teams.title') }}</text>
                    <view class="picker-close" @click="close">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" class="h-5 w-5">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </view>
                </view>
                <SearchBar v-model="keyword" :placeholder="t('teams.pickerSearch')" />
            </view>

            <VirtualList
                :items="visibleItems"
                :item-height="ROW_HEIGHT"
                :item-key="keyFor"
                class="picker-list"
            >
                <template #default="{ item }">
                    <view class="picker-row" @click="onChoose(item)">
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
import { useI18n } from 'vue-i18n';
import SearchBar from '@/components/shared/SearchBar.vue';
import VirtualList from '@/components/dex/VirtualList.vue';
import EncryptedSprite from '@/components/sprite/EncryptedSprite.vue';
import { usePokemonStore } from '@/store/pokemon';
import { padId } from '@/utils/helpers';

const ROW_HEIGHT = 68;

const props = defineProps<{ visible: boolean }>();
const emit = defineEmits<{
    'update:visible': [value: boolean];
    pick: [speciesId: number, formId?: number];
}>();

const { t } = useI18n();
const pokemonStore = usePokemonStore();

const keyword = ref('');
const step = ref<'species' | 'form'>('species');
const activeSpecies = ref<number | null>(null);

// 打开时重置；图鉴数据未加载则拉取（走 DEK；用户关闭登录层 → 关选择器，静默）
watch(
    () => props.visible,
    async (open) => {
        if (!open) return;
        keyword.value = '';
        step.value = 'species';
        activeSpecies.value = null;
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
    z-index: 1400;
}

/* 全屏面板：只做入场动画、关闭即 v-if 卸载（不做退出过渡，避免遮罩残留） */
.picker-panel {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    background: #f5f6fa;
    animation: picker-in 0.28s ease-out;
}

@keyframes picker-in {
    from {
        opacity: 0.4;
        transform: translateY(24px);
    }
}

.picker-header {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: calc(var(--status-bar-height, 0px) + 10px) 16px 12px;
    background: #ffffff;
    box-shadow: 0 1px 0 #eef0f5;
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
}

.picker-row {
    display: flex;
    align-items: center;
    box-sizing: border-box;
    height: 100%;
    padding: 0 16px;
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
