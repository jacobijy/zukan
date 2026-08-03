<template>
    <view class="sim-page min-h-screen page-bg" :style="{ paddingTop: 'var(--status-bar-height)', paddingBottom: '40px' }">
        <DetailNavbar title="对战模拟器" @back="goBack" />

        <scroll-view scroll-y class="relative z-10 h-[calc(100vh-var(--status-bar-height))] mt-[calc(var(--status-bar-height)+52px)] px-4 pb-6">
            <view class="mx-auto max-w-[720px] flex flex-col gap-3 pt-3">
                <view class="sim-card">
                    <view class="sim-head">
                        <view class="sim-head__badge sim-head__badge--blue">我方</view>
                        <text class="sim-head__hint">已选 0 / 3</text>
                    </view>
                    <view class="team-slots">
                        <view v-for="i in 3" :key="`mine-${i}`" class="team-slot" @click="noop">
                            <view class="team-slot__portrait">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5">
                                    <path d="M12 5v14M5 12h14"></path>
                                </svg>
                            </view>
                            <text class="team-slot__name">空位</text>
                        </view>
                    </view>
                </view>

                <view class="sim-card">
                    <view class="sim-head">
                        <view class="sim-head__badge sim-head__badge--red">对手</view>
                        <text class="sim-head__hint">已选 0 / 3</text>
                    </view>
                    <view class="team-slots">
                        <view v-for="i in 3" :key="`foe-${i}`" class="team-slot" @click="noop">
                            <view class="team-slot__portrait">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5">
                                    <path d="M12 5v14M5 12h14"></path>
                                </svg>
                            </view>
                            <text class="team-slot__name">空位</text>
                        </view>
                    </view>
                </view>

                <view class="sim-card">
                    <view class="sim-row">
                        <text class="sim-row__title">规则</text>
                        <view class="rule-chip-group">
                            <view v-for="r in rules" :key="r" class="rule-chip" :class="r === '单打' ? 'rule-chip--active' : ''" @click="noop">{{ r }}</view>
                        </view>
                    </view>
                    <view class="sim-row sim-row--last">
                        <text class="sim-row__title">等级</text>
                        <view class="calc-stepper">
                            <view class="calc-stepper__btn" @click="noop">−</view>
                            <text class="calc-stepper__value">50</text>
                            <view class="calc-stepper__btn" @click="noop">+</view>
                        </view>
                    </view>
                </view>

                <view class="log-card">
                    <view class="log-empty">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="h-7 w-7">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                            <polyline points="14 2 14 8 20 8"></polyline>
                            <path d="M8 13h8M8 17h5"></path>
                        </svg>
                        <text class="log-empty__text">尚未开始模拟</text>
                    </view>
                </view>

                <view class="sim-actions">
                    <button class="sim-action sim-action--ghost" @click="noop">重置</button>
                    <button class="sim-action" @click="noop">开始模拟</button>
                </view>
            </view>
        </scroll-view>
    </view>
</template>

<script lang="ts" setup>
import { ref } from 'vue';
import DetailNavbar from '@/components/shared/DetailNavbar.vue';

const rules = ref(['单打', '双打']);
const noop = () => {};

const goBack = () => {
    // DetailNavbar 已处理返回导航
};
</script>

<style scoped>
.sim-card,
.log-card {
    border: 1px solid #e5e7ee;
    border-radius: 20px;
    background: #ffffff;
    box-shadow: 0 10px 24px rgba(48, 55, 72, 0.06);
    overflow: hidden;
}

.sim-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 14px;
    border-bottom: 1px solid #eef0f5;
    background: #fafbfd;
}

.sim-head__badge {
    padding: 4px 11px;
    border-radius: 999px;
    color: #ffffff;
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.04em;
}

.sim-head__badge--blue {
    background: linear-gradient(135deg, #73b7ff, #357df4);
}

.sim-head__badge--red {
    background: linear-gradient(135deg, #ff7b6e, #e04f47);
}

.sim-head__hint {
    color: #9da2ad;
    font-size: 11px;
    font-weight: 700;
}

.team-slots {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
    padding: 12px;
}

.team-slot {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 10px 6px;
    border: 1px dashed #c9ced8;
    border-radius: 14px;
    background: #f5f6fa;
}

.team-slot__portrait {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    border-radius: 12px;
    background: #ffffff;
    border: 1px solid #e5e7ee;
    color: #b4b8c0;
}

.team-slot__name {
    font-size: 11px;
    font-weight: 700;
    color: #9da2ad;
}

.sim-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: 44px;
    padding: 0 14px;
}

.sim-row + .sim-row {
    border-top: 1px solid #f1f2f6;
}

.sim-row__title {
    font-size: 14px;
    font-weight: 600;
    color: #24262b;
}

.rule-chip-group {
    display: flex;
    gap: 6px;
}

.rule-chip {
    padding: 5px 12px;
    border-radius: 999px;
    border: 1px solid #e1e4eb;
    background: #f5f6fa;
    color: #6f7682;
    font-size: 12px;
    font-weight: 700;
}

.rule-chip--active {
    color: #ffffff;
    background: linear-gradient(135deg, #73b7ff, #357df4);
    border-color: transparent;
}

.calc-stepper {
    display: flex;
    align-items: center;
    gap: 8px;
}

.calc-stepper__btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    border-radius: 8px;
    border: 1px solid #e1e4eb;
    background: #f5f6fa;
    color: #6f7682;
    font-size: 15px;
    font-weight: 700;
}

.calc-stepper__value {
    min-width: 26px;
    text-align: center;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 14px;
    font-weight: 800;
    color: #24262b;
}

.log-card {
    padding: 22px 16px;
}

.log-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    color: #c4c7cf;
}

.log-empty__text {
    margin-top: 2px;
    font-size: 13px;
    font-weight: 700;
    color: #8d929c;
}

.sim-actions {
    display: flex;
    gap: 10px;
}

.sim-action {
    flex: 1;
    height: 46px;
    line-height: 46px;
    border-radius: 16px;
    color: #ffffff;
    font-size: 15px;
    font-weight: 800;
    background: linear-gradient(135deg, #73b7ff, #357df4);
    box-shadow: 0 10px 22px rgba(53, 125, 244, 0.22);
}

.sim-action--ghost {
    color: #6f7682;
    background: #f5f6fa;
    border: 1px solid #e1e4eb;
    box-shadow: none;
}

.sim-action::after {
    border: none !important;
}
</style>
