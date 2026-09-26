<template>
    <view class="archive-section px-4 py-4">
        <view class="mb-3 flex items-center justify-between gap-2">
            <text class="text-base font-black tracking-[-0.02em] text-[#24262b]">{{ title }}</text>
            <text class="text-[10px] font-black tracking-[0.14em] text-[#8d929c]">TEAM</text>
        </view>

        <view v-if="rows.length" class="grid gap-1">
            <view
                v-for="row in rows"
                :key="row.slug"
                class="flex items-center gap-2.5 rounded-xl px-1 py-1.5 transition-colors active:bg-[#f1f3f8]"
                @click="emit('select', row.slug)"
            >
                <EncryptedSprite
                    v-if="row.speciesId"
                    :pokemon-id="row.speciesId"
                    variant="front"
                    :preview="false"
                    img-class="h-9 w-9"
                    skeleton-class="h-9 w-9"
                />
                <view v-else class="h-9 w-9 rounded-[10px] bg-gradient-to-br from-[#f2f4f8] to-[#e7ebf2]"></view>

                <text class="min-w-0 flex-1 truncate text-[13px] font-bold text-[#24262b]">{{ row.name }}</text>

                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4 text-[#c4c7cf]">
                    <path d="m9 18 6-6-6-6"></path>
                </svg>
            </view>
        </view>

        <text v-else class="block py-2 text-center text-xs font-bold text-[#b6bac3]">{{ t('meta.pokemonEmpty') }}</text>
    </view>
</template>

<script lang="ts" setup>
import { useI18n } from 'vue-i18n';
import EncryptedSprite from '@/components/sprite/EncryptedSprite.vue';
import type { TeammateRowVM } from '@/services/meta';

defineProps<{
    title: string;
    rows: TeammateRowVM[];
}>();

const emit = defineEmits<{ select: [slug: string] }>();
const { t } = useI18n();
</script>
