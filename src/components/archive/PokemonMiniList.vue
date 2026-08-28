<template>
    <view v-if="speciesIds.length > 0" class="glass-panel">
        <PokemonMiniRow
            v-for="(id, index) in speciesIds"
            :key="id"
            :species-id="id"
            :last="index === speciesIds.length - 1"
        />
    </view>
    <view v-else class="glass-panel px-5 py-6">
        <text class="block text-center text-[13px] font-medium text-[#9da2ad]">{{ t('archive.noPokemon') }}</text>
    </view>
</template>

<script lang="ts" setup>
import { useI18n } from 'vue-i18n';
import PokemonMiniRow from './PokemonMiniRow.vue';

defineProps<{
    /** 默认形态 speciesId 列表 */
    speciesIds: number[];
}>();

const { t } = useI18n();
</script>
