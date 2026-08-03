<template>
    <!--
        精灵球图标。原本在 LoginModal（56px 金色）与 mine 页 trainer-card
        （60px 蓝色）各写了一套，几何结构完全同构，只差尺寸与配色。

        内部几何按 size 等比缩放（比例取自 60px 那版），border-radius 不缩放
        —— 两处原本都是写死的 18px。
    -->
    <view
        class="pokeball-logo"
        :class="`pokeball-logo--${variant}`"
        :style="{ '--pb-size': `${size}px` }"
    >
        <view class="pokeball-logo__cap"></view>
    </view>
</template>

<script lang="ts" setup>
withDefaults(
    defineProps<{
        /** 外框边长（px），内部圆/帽檐随之等比缩放 */
        size?: number;
        variant?: 'blue' | 'gold';
    }>(),
    { size: 60, variant: 'blue' }
);
</script>

<style scoped>
.pokeball-logo {
    position: relative;
    display: flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    width: var(--pb-size);
    height: var(--pb-size);
    overflow: hidden;
    border-radius: 18px;
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.42),
                0 10px 20px rgba(63, 70, 86, 0.12);
}

.pokeball-logo--blue {
    background: linear-gradient(135deg, #73b7ff 0%, #357df4 58%, #275bd8 100%);
}

.pokeball-logo--gold {
    background: linear-gradient(135deg, #ffe7a8 0%, #f4c849 54%, #e99a24 100%);
}

.pokeball-logo::before,
.pokeball-logo::after {
    position: absolute;
    content: '';
}

/* 上半白圆 */
.pokeball-logo::before {
    top: calc(var(--pb-size) * 0.2);
    width: calc(var(--pb-size) * 0.4333);
    height: calc(var(--pb-size) * 0.4333);
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.94);
}

/* 下半白底座 */
.pokeball-logo::after {
    bottom: calc(var(--pb-size) * -0.1667);
    width: calc(var(--pb-size) * 0.7667);
    height: calc(var(--pb-size) * 0.4667);
    border-radius: 999px 999px calc(var(--pb-size) * 0.2667) calc(var(--pb-size) * 0.2667);
    background: rgba(255, 255, 255, 0.94);
}

/* 红色帽檐 */
.pokeball-logo__cap {
    position: absolute;
    z-index: 1;
    top: calc(var(--pb-size) * 0.15);
    width: calc(var(--pb-size) * 0.5167);
    height: calc(var(--pb-size) * 0.1667);
    border-radius: 999px 999px 4px 4px;
    background: #f05245;
}
</style>
