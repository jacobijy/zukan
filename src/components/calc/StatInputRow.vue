<template>
    <view class="stat-row">
        <!-- 名称 + 性格倾向 + 种族值 -->
        <view class="stat-row__id">
            <view class="stat-row__name-line">
                <text class="stat-row__name">{{ label }}</text>
                <text
                    class="stat-row__nature"
                    :class="natureClass"
                    v-if="natureMod !== 100"
                >{{ natureMod > 100 ? '▲' : '▼' }}</text>
            </view>
            <text class="stat-row__base">{{ baseLabel }} {{ base }}</text>
        </view>

        <!-- IV -->
        <view class="stat-row__stepper">
            <text class="stat-row__stepper-tag">IV</text>
            <view class="stat-row__btn" @click="emit('update:iv', iv - 1)">−</view>
            <text class="stat-row__stepper-val">{{ iv }}</text>
            <view class="stat-row__btn" @click="emit('update:iv', iv + 1)">+</view>
        </view>

        <!-- EV -->
        <view class="stat-row__stepper">
            <text class="stat-row__stepper-tag">EV</text>
            <view class="stat-row__btn" @click="emit('update:ev', ev - EV_STEP)">−</view>
            <text class="stat-row__stepper-val">{{ ev }}</text>
            <view
                class="stat-row__btn"
                :class="{ 'stat-row__btn--off': evAtCap }"
                @click="emit('update:ev', ev + EV_STEP)"
            >+</view>
        </view>

        <!-- 结果能力值 -->
        <text class="stat-row__result">{{ result }}</text>
    </view>
</template>

<script lang="ts" setup>
import { computed } from 'vue';

/** EV 按 4 一跳（能力值每 4 EV 才涨 1 点），252 能被 4 整除 */
const EV_STEP = 4;

const props = defineProps<{
    label: string;
    baseLabel: string;
    base: number;
    /** 90 / 100 / 110 */
    natureMod: number;
    iv: number;
    ev: number;
    /** EV 已达本项上限或总量 510 上限时置灰 + */
    evAtCap?: boolean;
    result: number;
}>();

const emit = defineEmits<{
    'update:iv': [value: number];
    'update:ev': [value: number];
}>();

const natureClass = computed(() =>
    props.natureMod > 100 ? 'stat-row__nature--up' : 'stat-row__nature--down',
);
</script>

<style lang="scss" scoped>
.stat-row {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 46px;
    padding: 6px 14px;
}

.stat-row__id {
    display: flex;
    flex-direction: column;
    gap: 1px;
    flex: 0 0 72px;
    min-width: 0;
}

.stat-row__name-line {
    display: flex;
    align-items: center;
    gap: 3px;
}

.stat-row__name {
    font-size: 14px;
    font-weight: 800;
    color: #24262b;
}

.stat-row__nature {
    font-size: 9px;
    line-height: 1;
}

.stat-row__nature--up {
    color: #e74c3c;
}

.stat-row__nature--down {
    color: #3498db;
}

.stat-row__base {
    font-size: 10px;
    font-weight: 600;
    color: #b0b5bf;
}

.stat-row__stepper {
    display: flex;
    align-items: center;
    gap: 4px;
    flex: 1 1 0;
    justify-content: flex-end;
}

.stat-row__stepper-tag {
    font-size: 9px;
    font-weight: 800;
    color: #9da2ad;
    width: 14px;
}

.stat-row__btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border-radius: 7px;
    border: 1px solid #e1e4eb;
    background: #f5f6fa;
    color: #6f7682;
    font-size: 14px;
    font-weight: 700;
    line-height: 1;
}

.stat-row__btn--off {
    opacity: 0.35;
}

.stat-row__stepper-val {
    min-width: 26px;
    text-align: center;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 13px;
    font-weight: 800;
    color: #24262b;
}

.stat-row__result {
    flex: 0 0 44px;
    text-align: right;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 19px;
    font-weight: 900;
    color: #24262b;
}
</style>
