<template>
    <view class="specimen-hero mb-3">
        <text class="specimen-hero__number">{{ String(pokemon.id || 0).padStart(3, '0') }}</text>

        <view class="specimen-hero__image-wrap">
            <view class="specimen-hero__image-frame">
                <EncryptedSprite
                    :pokemon-id="pokemon.id"
                    variant="home"
                    eager
                    img-class="relative z-10 h-48 w-48 drop-shadow-[0_18px_18px_rgba(48,55,72,0.16)]"
                    skeleton-class="h-48 w-48"
                />
            </view>
        </view>

        <view v-if="formCount > 1" class="specimen-hero__form-switch">
            <button class="form-switch__arrow" @click="$emit('switch-form', -1)" :aria-label="t('specimen.prevForm')">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5">
                    <polyline points="15 6 9 12 15 18"></polyline>
                </svg>
            </button>
            <view class="form-switch__label">
                <text class="form-switch__form-name">{{ currentFormLabel }}</text>
                <text class="form-switch__form-index">{{ formIndex + 1 }} / {{ formCount }}</text>
            </view>
            <button class="form-switch__arrow" @click="$emit('switch-form', 1)" :aria-label="t('specimen.nextForm')">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5">
                    <polyline points="9 6 15 12 9 18"></polyline>
                </svg>
            </button>
        </view>

        <view class="relative z-10 px-5 pb-5 text-center">
            <view class="mb-2 flex items-center justify-center gap-2">
                <text class="text-[34px] font-black leading-none tracking-[-0.06em] text-[#24262b]">{{ pokemon.name }}</text>
                <text class="rounded-full border border-[#e1e4eb] bg-[#f5f6fa] px-3 py-1 font-mono text-xs font-black text-[#8d929c]">NO.{{ String(pokemon.id || 0).padStart(3, '0') }}</text>
            </view>
            <view class="flex justify-center gap-2">
                <TypeBadge
                    v-for="type in pokemon.types"
                    :key="type"
                    :type="type"
                    size="lg"
                />
            </view>
            <text class="mx-auto mt-3 block max-w-[620px] text-sm font-semibold leading-6 text-[#6f7682]">{{ pokemon.description }}</text>
        </view>
    </view>
</template>

<script lang="ts" setup>
import TypeBadge from '@/components/pokemon/TypeBadge.vue';
import EncryptedSprite from '@/components/sprite/EncryptedSprite.vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

defineProps<{
    pokemon: {
        id: number;
        name: string;
        types: string[];
        description?: string;
        isDefault?: boolean;
        formLabel?: string;
    };
    formIndex: number;
    formCount: number;
    currentFormLabel: string;
}>();

defineEmits<{
    'switch-form': [delta: -1 | 1];
}>();
</script>

<style scoped>
.specimen-hero {
    position: relative;
    overflow: hidden;
    border-radius: 34px;
    border: 1px solid #e5e7ee;
    background: #ffffff;
    box-shadow: 0 14px 34px rgba(48, 55, 72, 0.08);
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

.specimen-hero__form-switch {
    position: relative;
    z-index: 2;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    margin: 0 auto 4px;
    padding: 6px 14px;
}

.form-switch__arrow {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    padding: 0;
    color: #4a5060;
    background: #ffffff;
    border: 1px solid #e5e7ee;
    border-radius: 999px;
    box-shadow: 0 4px 10px rgba(48, 55, 72, 0.08);
    transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.form-switch__arrow:active {
    transform: scale(0.94);
    box-shadow: 0 2px 6px rgba(48, 55, 72, 0.1);
}

.form-switch__label {
    display: flex;
    flex-direction: column;
    align-items: center;
    min-width: 108px;
    line-height: 1.15;
}

.form-switch__form-name {
    font-size: 13px;
    font-weight: 800;
    color: #24262b;
}

.form-switch__form-index {
    margin-top: 2px;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.06em;
    color: #8d929c;
}
</style>