<template>
    <view class="spread-editor">
        <view v-for="key in STAT_KEYS" :key="key" class="spread-editor__row">
            <LevelStepper
                :model-value="modelValue[key]"
                :min="SP_MIN"
                :max="SP_MAX"
                :label="t(`teams.sp.${key}`)"
                @update:model-value="(n: number) => update(key, n)"
            />
        </view>
        <view class="spread-editor__total">
            <text class="spread-editor__total-label">{{ t('teams.sp.total') }}</text>
            <text class="spread-editor__total-value">{{ total }}</text>
        </view>
    </view>
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import LevelStepper from '@/components/calc/LevelStepper.vue';
import { STAT_KEYS } from '@/pages/statcalc/statcalc-options';
import { LIMITS, type TeamSpread } from '@/services/teams/team-model';

type StatKey = (typeof STAT_KEYS)[number];

const props = defineProps<{ modelValue: TeamSpread }>();
const emit = defineEmits<{ 'update:modelValue': [value: TeamSpread] }>();

const { t } = useI18n();

const SP_MIN = LIMITS.spMin;
const SP_MAX = LIMITS.spMax;

const total = computed(() => STAT_KEYS.reduce((sum, key) => sum + props.modelValue[key], 0));

function update(key: StatKey, value: number): void {
    emit('update:modelValue', { ...props.modelValue, [key]: value });
}
</script>

<style lang="scss" scoped>
.spread-editor {
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.spread-editor__row {
    display: flex;
    align-items: center;
}

.spread-editor__total {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 4px;
    padding-top: 10px;
    border-top: 1px solid #eef0f5;
}

.spread-editor__total-label {
    font-size: 13px;
    font-weight: 700;
    color: #6f7682;
}

.spread-editor__total-value {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 15px;
    font-weight: 800;
    color: #24262b;
}
</style>
