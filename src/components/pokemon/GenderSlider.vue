<template>
    <!-- 两性皆可（1–7）：左右滑块 -->
    <view v-if="canSwitch" class="gender-slider">
        <view
            class="gender-slider__thumb"
            :class="modelValue === 'female' ? 'gender-slider__thumb--female' : ''"
        />
        <button
            class="gender-slider__segment"
            :class="{ 'gender-slider__segment--active': modelValue === 'male' }"
            :aria-pressed="modelValue === 'male'"
            @click="pick('male')"
        >
            <text>♂</text>
            <text class="gender-slider__label">{{ t('specimen.male') }}</text>
        </button>
        <button
            class="gender-slider__segment"
            :class="{ 'gender-slider__segment--active': modelValue === 'female' }"
            :aria-pressed="modelValue === 'female'"
            @click="pick('female')"
        >
            <text>♀</text>
            <text class="gender-slider__label">{{ t('specimen.female') }}</text>
        </button>
    </view>

    <!-- 恒雄/恒雌（0/8）：只显示锁定性别，不可交互 -->
    <view
        v-else-if="show"
        class="gender-locked"
        :class="modelValue === 'female' ? 'gender-locked--female' : 'gender-locked--male'"
    >
        <text class="gender-locked__symbol">{{ modelValue === 'male' ? '♂' : '♀' }}</text>
        <text class="gender-locked__label">{{ modelValue === 'male' ? t('specimen.male') : t('specimen.female') }}</text>
    </view>
</template>

<script setup lang="ts">
/**
 * 标本图的「性别」切换滑块。
 *
 * 按 `genderRate` 展示/锁定：-1 无性别隐藏开关；0 恒雄 / 8 恒雌只显
 * 对应性别且禁用（不可交互）；1–7 两性皆可，用左右滑块切换。
 *
 * 恒雄/恒雌时本组件通过 watch 把 v-model 同步成锁定值，
 * 父组件拿到的永远是有效性别，无需再算一遍锁规则。
 */
import { computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';

const props = defineProps<{
    /** PokeAPI 性别比例，-1 无性别 / 0 恒雄 / 8 恒雌 */
    genderRate?: number;
    modelValue: 'male' | 'female';
}>();

const emit = defineEmits<{
    'update:modelValue': [v: 'male' | 'female'];
}>();

const { t } = useI18n();

/** rate 缺省或 -1 时隐藏整个性别区 */
const show = computed(() => props.genderRate != null && props.genderRate >= 0);
/** 只有两性皆可（1–7）才可切换 */
const canSwitch = computed(() => props.genderRate != null && props.genderRate >= 1 && props.genderRate <= 7);

const pick = (g: 'male' | 'female') => {
    if (!canSwitch.value) return;
    if (g !== props.modelValue) emit('update:modelValue', g);
};

// 恒雄/恒雌时把 v-model 锁到对应性别 —— 形态切换后父组件立即拿到有效性别，
// 不必在调用方再维护一份「锁定」推导。immediate 覆盖进入页面即恒雌的场景。
watch(
    () => props.genderRate,
    (r) => {
        if (r == null) return;
        const locked: 'male' | 'female' | null = r === 0 ? 'male' : r >= 8 ? 'female' : null;
        if (locked && locked !== props.modelValue) emit('update:modelValue', locked);
    },
    { immediate: true },
);
</script>

<style scoped>
/* ── 性别滑块（两性皆可 1–7） ── */

.gender-slider {
    position: relative;
    display: flex;
    align-items: center;
    gap: 2px;
    background: #f0f2f6;
    border-radius: 999px;
    padding: 3px;
    min-width: 156px;
}

/* 轨道 padding 3px + 段间 gap 2px ⇒ 每段宽 (轨宽-8)/2，即 calc(50% - 4px)。
   位移用 transform 而非 left：走合成层，移动端不掉帧。
   注意这里只是纯视觉过渡，不拿 transitionend 驱动任何状态变更。 */
.gender-slider__thumb {
    position: absolute;
    top: 3px;
    left: 3px;
    width: calc(50% - 4px);
    height: calc(100% - 6px);
    background: #1d63d8;
    border-radius: 999px;
    box-shadow: 0 2px 6px rgba(29, 99, 216, 0.32);
    transform: translateX(0);
    transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), background-color 0.2s ease, box-shadow 0.2s ease;
    z-index: 0;
    pointer-events: none;
}

/* 自身宽 + gap，正好落到第二段左沿 */
.gender-slider__thumb--female {
    transform: translateX(calc(100% + 2px));
    background: #d8395c;
    box-shadow: 0 2px 6px rgba(216, 57, 92, 0.32);
}

.gender-slider__segment {
    flex: 1 1 0;
    position: relative;
    z-index: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    padding: 7px 8px;
    min-width: 78px;
    white-space: nowrap;
    border: none;
    border-radius: 999px;
    background: transparent;
    color: #6f7682;
    font-size: 13px;
    font-weight: 800;
    transition: color 0.15s ease;
    cursor: pointer;
}

.gender-slider__segment:active {
    transform: scale(0.96);
}

.gender-slider__segment--active {
    color: #ffffff;
}

.gender-slider__label {
    font-weight: 800;
}

/* ── 固定性别（恒雄 0 / 恒雌 8） ── */

.gender-locked {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 7px 14px;
    font-size: 13px;
    font-weight: 700;
    line-height: 1;
    border: 1px solid;
    border-radius: 999px;
}

.gender-locked--male {
    color: #1d63d8;
    border-color: #c3d6f6;
    background: #eef4fd;
}

.gender-locked--female {
    color: #d8395c;
    border-color: #f5c6d1;
    background: #fdeef2;
}

.gender-locked__symbol {
    font-weight: 900;
    font-size: 14px;
    line-height: 1;
}

.gender-locked__label {
    font-weight: 800;
}
</style>