<template>
    <!--
        分享码导出居中弹窗：内容摘要（默认插槽）+ 可长按选择的码 + 复制按钮。
        复制动作（uni.setClipboardData）由父页面执行，组件只 emit，方便统一 toast。
        v-if visible 关闭即卸载，只做入场动画（与 ShareImportDialog / LoginModal 一致）。
    -->
    <view v-if="visible" class="export-dialog-root">
        <view class="export-dialog-mask" @click="close" @touchmove.stop="preventTouchMove"></view>

        <view class="export-dialog-panel" @touchmove.stop>
            <view class="export-dialog-header">
                <text class="export-dialog-title">{{ title }}</text>
                <view class="export-dialog-close" @click="close">
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

            <slot />

            <text class="export-dialog-hint">{{ hint }}</text>

            <scroll-view scroll-y class="export-code-box">
                <!-- selectable：小程序 / H5 长按均可选中复制；主路径仍是下方按钮一键复制 -->
                <text selectable class="export-code-box__text">{{ code }}</text>
            </scroll-view>

            <button class="export-primary-btn" @click="emit('copy')">{{ copyLabel }}</button>
        </view>
    </view>
</template>

<script lang="ts" setup>
import { glyph } from '@/components/icon/glyphs';
import { preventTouchMove } from '@/utils/touch';

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
.export-dialog-root {
    position: fixed;
    inset: 0;
    z-index: 1500;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 28px 20px;
    pointer-events: none;
}

.export-dialog-mask {
    position: absolute;
    inset: 0;
    pointer-events: auto;
    background: rgba(36, 38, 43, 0.42);
    backdrop-filter: blur(6px);
    animation: export-fade 0.25s ease-out;
}

.export-dialog-panel {
    position: relative;
    display: flex;
    flex-direction: column;
    width: 100%;
    max-width: 360px;
    max-height: 82vh;
    padding: 20px 18px 18px;
    pointer-events: auto;
    background: #ffffff;
    border-radius: 24px;
    box-shadow: 0 24px 60px rgba(48, 55, 72, 0.28);
    animation: export-pop 0.3s cubic-bezier(0.22, 1, 0.36, 1);
}

@keyframes export-fade {
    from {
        background: rgba(36, 38, 43, 0);
        backdrop-filter: blur(0);
    }
}

@keyframes export-pop {
    from {
        opacity: 0;
        transform: translateY(14px) scale(0.95);
    }
}

.export-dialog-header {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 32px;
}

.export-dialog-title {
    font-size: 16px;
    font-weight: 900;
    color: #24262b;
}

.export-dialog-close {
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

.export-dialog-hint {
    flex-shrink: 0;
    margin: 12px 2px 10px;
    font-size: 12px;
    font-weight: 600;
    line-height: 1.55;
    color: #9aa0ab;
}

.export-code-box {
    flex-shrink: 1;
    min-height: 54px;
    max-height: 96px;
    margin-bottom: 14px;
    padding: 10px 12px;
    border-radius: 14px;
    background: #f6f7fa;
}

.export-code-box__text {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 12px;
    line-height: 1.6;
    color: #4a4f5a;
    word-break: break-all;
}

.export-primary-btn {
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
