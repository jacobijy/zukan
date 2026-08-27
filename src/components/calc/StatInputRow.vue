<template>
    <view class="stat-row">
        <!-- 名称 + 性格倾向 + 种族值 -->
        <view class="stat-row__id">
            <view class="stat-row__name-line">
                <text class="stat-row__name">{{ label }}</text>
                <text class="stat-row__nature" :class="natureClass" v-if="natureMod !== 100">{{
                    natureMod > 100 ? '▲' : '▼'
                }}</text>
            </view>
            <text class="stat-row__base">{{ baseLabel }} {{ base }}</text>
        </view>

        <!-- 标准模式：个体值 IV + 努力值 EV（EV 每 4 点涨 1 能力） -->
        <template v-if="mode === 'classic'">
            <view class="stat-row__stepper stat-row__stepper--lead">
                <text class="stat-row__stepper-tag">IV</text>
                <view class="stat-row__btn" @click="emit('update:iv', (iv ?? 31) - 1)">−</view>
                <text class="stat-row__stepper-val">{{ iv }}</text>
                <view class="stat-row__btn" @click="emit('update:iv', (iv ?? 31) + 1)">+</view>
            </view>

            <view class="stat-row__stepper stat-row__stepper--ev">
                <text class="stat-row__stepper-tag">EV</text>
                <view class="stat-row__btn" @click="emit('update:ev', (ev ?? 0) - EV_STEP)">−</view>
                <text class="stat-row__stepper-val">{{ ev }}</text>
                <view
                    class="stat-row__btn"
                    :class="{ 'stat-row__btn--off': evAtCap }"
                    @click="emit('update:ev', (ev ?? 0) + EV_STEP)"
                >+</view>
            </view>
        </template>

        <!-- Champions 模式：单列能力点 SP（1 SP 在 Lv50 直接 +1 能力） -->
        <view v-else class="stat-row__stepper stat-row__stepper--lead stat-row__stepper--sp">
            <text class="stat-row__stepper-tag">{{ spTag }}</text>
            <view class="stat-row__btn" @click="emit('update:sp', (sp ?? 0) - SP_STEP)">−</view>
            <text class="stat-row__stepper-val">{{ sp }}</text>
            <view
                class="stat-row__btn"
                :class="{ 'stat-row__btn--off': spAtCap }"
                @click="emit('update:sp', (sp ?? 0) + SP_STEP)"
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
/** Champions 能力点 1:1 加能力，步进为 1 */
const SP_STEP = 1;

const props = withDefaults(
    defineProps<{
        mode?: 'classic' | 'champion';
        label: string;
        baseLabel: string;
        base: number;
        /** 90 / 100 / 110 */
        natureMod: number;
        /* 标准模式 */
        iv?: number;
        ev?: number;
        evAtCap?: boolean;
        /* Champions 模式 */
        sp?: number;
        spAtCap?: boolean;
        result: number;
    }>(),
    { mode: 'classic' },
);

const emit = defineEmits<{
    'update:iv': [value: number];
    'update:ev': [value: number];
    'update:sp': [value: number];
}>();

const spTag = computed(() => (props.mode === 'champion' ? 'SP' : ''));

const natureClass = computed(() =>
    props.natureMod > 100 ? 'stat-row__nature--up' : 'stat-row__nature--down',
);
</script>

<style lang="scss" scoped>
.stat-row {
    display: flex;
    align-items: center;
    gap: 5px;
    min-height: 46px;
    padding: 6px 14px;
}

.stat-row__id {
    display: flex;
    flex-direction: column;
    gap: 1px;
    flex: 0 0 56px;
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
    gap: 3px;
    flex: 0 0 auto;
}

/* IV 组（或 champion 的 SP 组）把自身往左推、把后面的控件往右推，吃掉整行富余宽度。 */
.stat-row__stepper--lead {
    margin-left: auto;
}

/* 标准模式下 IV 组与 EV 组之间额外留白，把两组输入分开 */
.stat-row__stepper--ev {
    margin-left: 12px;
}

.stat-row__stepper-tag {
    font-size: 9px;
    font-weight: 800;
    color: #9da2ad;
    width: 12px;
}

.stat-row__btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 21px;
    height: 21px;
    border-radius: 7px;
    border: 1px solid #e1e4eb;
    background: #f5f6fa;
    color: #6f7682;
    font-size: 13px;
    font-weight: 700;
    line-height: 1;
}

.stat-row__btn--off {
    opacity: 0.35;
}

.stat-row__stepper-val {
    min-width: 20px;
    text-align: center;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 13px;
    font-weight: 800;
    color: #24262b;
}

.stat-row__result {
    flex: 0 0 auto;
    /* 结果列也吃一份富余宽度，与 lead 组的 margin-left:auto 平分自由空间，
       于是输入列收到行中偏左、输入「+」与结果之间留出空隙；窄屏 auto 收缩到 0，不溢出。 */
    margin-left: auto;
    min-width: 32px;
    text-align: right;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 19px;
    font-weight: 900;
    letter-spacing: 0.02em;
    color: #24262b;
}
</style>
