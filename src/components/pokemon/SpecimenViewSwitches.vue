<template>
    <view class="specimen-view-switches">
        <button
            class="view-switch__chip"
            :class="{ 'view-switch__chip--shiny view-switch__chip--active': shiny }"
            :aria-pressed="shiny"
            @click="$emit('update:shiny', !shiny)"
        >
            <text>⚡</text>
            <text class="view-switch__chip-label">{{ t('specimen.shiny') }}</text>
        </button>

        <!-- 无性别（gender_rate=-1）隐藏；固定性别只渲染对应性别钮且锁定 -->
        <template v-if="showGender">
            <button
                v-if="canSwitchGender || gender === 'male'"
                class="view-switch__chip view-switch__chip--gender"
                :class="{ 'view-switch__chip--active': gender === 'male' }"
                :disabled="!canSwitchGender"
                :aria-pressed="gender === 'male'"
                @click="setGender('male')"
            >
                <text class="view-switch__chip-symbol">♂</text>
                <text class="view-switch__chip-label">{{ t('specimen.male') }}</text>
            </button>
            <button
                v-if="canSwitchGender || gender === 'female'"
                class="view-switch__chip view-switch__chip--gender"
                :class="{ 'view-switch__chip--active': gender === 'female' }"
                :disabled="!canSwitchGender"
                :aria-pressed="gender === 'female'"
                @click="setGender('female')"
            >
                <text class="view-switch__chip-symbol">♀</text>
                <text class="view-switch__chip-label">{{ t('specimen.female') }}</text>
            </button>
        </template>
    </view>
</template>

<script setup lang="ts">
/**
 * 详情页标本图的「闪光 / 性别」切换条。
 *
 * 只负责开关 UI 与性别门禁，不含图片加载：
 * - 性别按钮按 `genderRate` 展示/锁定：-1 无性别隐藏开关；0 恒雄 / 8 恒雌只显
 *   对应性别钮且禁用（点击不生效）；1–7 两性皆可自由切换。
 * - 父组件用 `v-model:gender` 拿到的**永远是有效性别**：形态切到固定性别时本组件
 *   watch `genderRate` 把 model 同步成锁定值，调用的 hero 无需再算一遍锁规则。
 *
 * 开关状态（shiny/gender）由父组件持有、跨形态保持；本组件是不可有业务逻辑的纯 UI。
 */
import { computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';

const props = defineProps<{
    /** PokeAPI 性别比例，-1 无性别 / 0 恒雄 / 8 恒雌（见 IPokemonBaseModel.genderRate） */
    genderRate?: number;
    shiny: boolean;
    gender: 'male' | 'female';
}>();

const emit = defineEmits<{
    'update:shiny': [v: boolean];
    'update:gender': [v: 'male' | 'female'];
}>();

const { t } = useI18n();

/** rate 缺省（数据未就绪）按「隐藏性别」处理，开关只留闪光 */
const showGender = computed(() => props.genderRate != null && props.genderRate >= 0);
/** 只有两性皆可（1–7）才可点；其余锁定 */
const canSwitchGender = computed(() => props.genderRate != null && props.genderRate >= 1 && props.genderRate <= 7);

const setGender = (g: 'male' | 'female') => {
    if (!canSwitchGender.value) return;
    if (g !== props.gender) emit('update:gender', g);
};

// 恒雄/恒雌时把 v-model 锁到对应性别 —— 形态切换后父组件立即拿到有效性别，
// 不必在调用方再维护一份「锁定」推导。immediate 覆盖进入页面即恒雌的场景。
watch(
    () => props.genderRate,
    (r) => {
        if (r == null) return;
        const locked: 'male' | 'female' | null = r === 0 ? 'male' : r >= 8 ? 'female' : null;
        if (locked && locked !== props.gender) emit('update:gender', locked);
    },
    { immediate: true },
);
</script>

<style scoped>
.specimen-view-switches {
    position: relative;
    z-index: 2;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    margin: 0 auto 6px;
    padding: 6px 14px 0;
}

.view-switch__chip {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 7px 14px;
    color: #4a5060;
    font-size: 13px;
    font-weight: 700;
    line-height: 1;
    background: #ffffff;
    border: 1px solid #e5e7ee;
    border-radius: 999px;
    box-shadow: 0 4px 10px rgba(48, 55, 72, 0.08);
    transition: transform 0.15s ease, box-shadow 0.15s ease, color 0.15s ease, border-color 0.15s ease, background-color 0.15s ease;
}

.view-switch__chip:active:not([disabled]) {
    transform: scale(0.94);
}

.view-switch__chip--active {
    color: #24262b;
    border-color: #c9cfdb;
    background: #f2f4f8;
}

.view-switch__chip--shiny.view-switch__chip--active {
    color: #a16207;
    border-color: #fcd34d;
    background: #fdf6d8;
}

.view-switch__chip--gender.view-switch__chip--active {
    color: #1d63d8;
    border-color: #b7d0f7;
    background: #e9f1fd;
}

.view-switch__chip[disabled] {
    opacity: 0.55;
    box-shadow: none;
}

.view-switch__chip-label {
    font-weight: 800;
}

.view-switch__chip-symbol {
    font-weight: 900;
    font-size: 14px;
    line-height: 1;
}
</style>