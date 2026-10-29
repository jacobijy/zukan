<template>
    <!--
        分享码导出底部弹层：展示可长按选择的码 + 复制按钮。
        复制动作（uni.setClipboardData）由父页面执行，组件只 emit，方便统一 toast。
        v-if visible 关闭即卸载，只做入场动画（与 OptionSheet / LoginModal 一致）。
    -->
    <view v-if="visible" class="share-sheet-root">
        <view class="share-sheet-mask" @click="close" @touchmove.stop.prevent></view>

        <view class="share-sheet-panel" @touchmove.stop>
            <view class="share-sheet-grip"></view>

            <view class="share-sheet-header">
                <text class="share-sheet-title">{{ title }}</text>
                <view class="share-sheet-close" @click="close">
                    <!-- #ifdef MP-WEIXIN -->
                    <text class="ic text-[15px]">{{ glyph('x') }}</text>
                    <!-- #endif -->
                    <!-- #ifndef MP-WEIXIN -->
                    <svg data-ic="x" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" class="h-4 w-4">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                    <!-- #endif -->
                </view>
            </view>

            <text class="share-sheet-hint">{{ hint }}</text>

            <scroll-view scroll-y class="share-code-box">
                <!-- selectable：小程序 / H5 长按均可选中复制；主路径仍是下方按钮一键复制 -->
                <text selectable class="share-code-box__text">{{ code }}</text>
            </scroll-view>

            <button class="share-primary-btn" @click="emit('copy')">{{ copyLabel }}</button>
        </view>
    </view>
</template>

<script lang="ts" setup>
import { glyph } from '@/components/icon/glyphs';

defineProps<{
    visible: boolean;
    title: string;
    hint: string;
    code: string;
    copyLabel: string;
}>();

const emit = defineEmits<{
    (e: 'update:visible', value: boolean): void;
    (e: 'copy'): void;
}>();

function close(): void {
    emit('update:visible', false);
}
</script>

<style lang="scss" scoped>
.share-sheet-root {
    position: fixed;
    inset: 0;
    z-index: 1500;
    pointer-events: none;
}

.share-sheet-mask {
    position: absolute;
    inset: 0;
    pointer-events: auto;
    background: rgba(36, 38, 43, 0.42);
    backdrop-filter: blur(6px);
    animation: share-fade 0.28s ease-out;
}

.share-sheet-panel {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    flex-direction: column;
    max-height: 84vh;
    padding: 8px 16px calc(env(safe-area-inset-bottom, 0) + 14px);
    pointer-events: auto;
    background: #ffffff;
    border-radius: 26px 26px 0 0;
    box-shadow: 0 -24px 60px rgba(48, 55, 72, 0.22);
    animation: share-slide-up 0.34s cubic-bezier(0.22, 1, 0.36, 1);
}

@keyframes share-fade {
    from {
        background: rgba(36, 38, 43, 0);
        backdrop-filter: blur(0);
    }
}

@keyframes share-slide-up {
    from {
        transform: translateY(100%);
    }
}

.share-sheet-grip {
    align-self: center;
    width: 38px;
    height: 4px;
    margin: 6px 0 10px;
    border-radius: 2px;
    background: #e3e5ea;
}

.share-sheet-header {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 32px;
}

.share-sheet-title {
    font-size: 16px;
    font-weight: 900;
    color: #24262b;
}

.share-sheet-close {
    position: absolute;
    right: 0;
    top: 50%;
    transform: translateY(-50%);
    display: flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    border-radius: 999px;
    color: #9da2ad;
    background: #f2f3f7;

    &:active {
        background: #e6e8ee;
    }
}

.share-sheet-hint {
    margin: 10px 2px 12px;
    font-size: 13px;
    font-weight: 600;
    line-height: 1.55;
    color: #8d929c;
}

.share-code-box {
    flex-shrink: 1;
    max-height: 200px;
    margin-bottom: 14px;
    padding: 12px 14px;
    border-radius: 14px;
    background: #f6f7fa;
}

.share-code-box__text {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 12px;
    line-height: 1.6;
    color: #4a4f5a;
    word-break: break-all;
}

.share-primary-btn {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    gap: 8px;
    height: 48px;
    border-radius: 16px;
    color: #ffffff;
    font-size: 15px;
    font-weight: 800;
    background: linear-gradient(135deg, #ff8a7e, #e04f47);
    box-shadow: 0 12px 24px rgba(224, 79, 71, 0.22);

    &::after {
        border: none !important;
    }

    &:active {
        transform: scale(0.98);
    }
}
</style>
