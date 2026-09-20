<template>
    <view class="pokedex-versions">
        <view
            v-for="opt in options"
            :key="opt.version"
            class="pokedex-versions__slot"
            :class="{ 'pokedex-versions__slot--active': opt.version === modelValue }"
            role="button"
            :aria-label="i18nStore.versionName(opt.version) ?? String(opt.version)"
            @click="emit('update:modelValue', opt.version)"
        >
            <image
                :src="opt.iconPath"
                mode="aspectFit"
                class="pokedex-versions__icon"
                aria-hidden="true"
            />
        </view>
    </view>
</template>

<script lang="ts" setup>
import { useI18nStore } from '@/store/i18n';
import type { VersionIconOption } from '@/constants/versionIcons';

/**
 * 图鉴描述的版本选择器：每个有描述、且有软件图标的版本一枚图标。
 * 纯展示/选择闭环——选项与当前版本由 PokedexEntry 计算后传入，自身不取数。
 * 只覆盖 X/Y 起（图标集边界），gen1–5 版本由父组件走无选择器的兜底文案。
 */
defineProps<{
    /** 可切换版本（已按 version 升序、只含有图标的版本） */
    options: readonly VersionIconOption[];
    /** 当前选中 version（v-model） */
    modelValue: number | null;
}>();

const emit = defineEmits<{
    'update:modelValue': [version: number];
}>();

const i18nStore = useI18nStore();
</script>

<style lang="scss" scoped>
.pokedex-versions {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
}

.pokedex-versions__slot {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    padding: 3px;
    background: #ffffff;
    border-radius: 9px;
    box-shadow: inset 0 0 0 1px #e9ebf2;
    transition:
        transform 0.18s ease,
        box-shadow 0.18s ease,
        background 0.18s ease;
}

.pokedex-versions__slot:active {
    transform: scale(0.92);
}

.pokedex-versions__slot--active {
    background: #eef4ff;
    box-shadow: inset 0 0 0 1.5px #357df4;
}

.pokedex-versions__icon {
    width: 100%;
    height: 100%;
}
</style>
