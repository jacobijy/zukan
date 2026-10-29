<template>
    <!--
        分享码导入弹窗（屏幕居中）：单行输入（不用 textarea，规避小程序原生 textarea 弹层层级问题）
        + 一键读剪贴板 + 确认。解析在父页面执行，错误文案经 error prop 回填。
        v-if visible 关闭即卸载（输入态随之重置），只做入场动画。
    -->
    <view v-if="visible" class="import-dialog-root">
        <view class="import-dialog-mask" @click="close" @touchmove.stop="preventTouchMove"></view>

        <view class="import-dialog-panel" @touchmove.stop>
            <view class="import-dialog-header">
                <text class="import-dialog-title">{{ title }}</text>
                <view class="import-dialog-close" @click="close">
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

            <text class="import-dialog-hint">{{ hint }}</text>

            <view class="import-input-row" :class="{ 'import-input-row--error': !!error }">
                <input
                    :value="code"
                    @input="onInput"
                    @confirm="emit('confirm', code.trim())"
                    type="text"
                    class="import-input"
                    :placeholder="placeholder"
                    :placeholder-style="'color:#b0b5bf;font-weight:500'"
                    confirm-type="done"
                />
                <button v-if="code" class="import-clear" @click="code = ''">
                    <!-- #ifdef MP-WEIXIN -->
                    <text class="ic text-[12px]">{{ glyph('x') }}</text>
                    <!-- #endif -->
                    <!-- #ifndef MP-WEIXIN -->
                    <svg data-ic="x" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" class="h-3 w-3">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                    <!-- #endif -->
                </button>
                <button class="import-paste" @click="pasteFromClipboard">{{ pasteLabel }}</button>
            </view>

            <text v-if="error" class="import-error">{{ error }}</text>

            <button class="import-primary-btn" @click="emit('confirm', code.trim())">{{ confirmLabel }}</button>
        </view>
    </view>
</template>

<script lang="ts" setup>
import { ref } from 'vue';
import { preventTouchMove } from '@/utils/touch';
import { glyph } from '@/components/icon/glyphs';

defineProps<{
    visible: boolean;
    title: string;
    hint: string;
    placeholder: string;
    confirmLabel: string;
    pasteLabel: string;
    error?: string;
}>();

const emit = defineEmits<{
    (e: 'update:visible', value: boolean): void;
    (e: 'confirm', code: string): void;
}>();

const code = ref('');

// uni <input> H5 是原生 Event，小程序值在 e.detail.value
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function onInput(e: any): void {
    code.value = e.detail?.value ?? e.target?.value ?? '';
}

/** 一键读取剪贴板填入（全端 uni.getClipboardData；无内容 / 拒绝时静默）。 */
function pasteFromClipboard(): void {
    uni.getClipboardData({
        success: (res) => {
            if (res.data) code.value = res.data;
        },
    });
}

function close(): void {
    emit('update:visible', false);
}
</script>

<style lang="scss" scoped>
.import-dialog-root {
    position: fixed;
    inset: 0;
    z-index: 1500;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 28px 20px;
    pointer-events: none;
}

.import-dialog-mask {
    position: absolute;
    inset: 0;
    pointer-events: auto;
    background: rgba(36, 38, 43, 0.42);
    backdrop-filter: blur(6px);
    animation: import-dialog-fade 0.25s ease-out;
}

.import-dialog-panel {
    position: relative;
    display: flex;
    flex-direction: column;
    width: 100%;
    max-width: 360px;
    padding: 20px 18px 18px;
    pointer-events: auto;
    background: #ffffff;
    border-radius: 24px;
    box-shadow: 0 24px 60px rgba(48, 55, 72, 0.28);
    animation: import-dialog-pop 0.3s cubic-bezier(0.22, 1, 0.36, 1);
}

@keyframes import-dialog-fade {
    from {
        background: rgba(36, 38, 43, 0);
        backdrop-filter: blur(0);
    }
}

@keyframes import-dialog-pop {
    from {
        opacity: 0;
        transform: translateY(14px) scale(0.95);
    }
}

.import-dialog-header {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 32px;
}

.import-dialog-title {
    font-size: 16px;
    font-weight: 900;
    color: #24262b;
}

.import-dialog-close {
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

.import-dialog-hint {
    margin: 12px 2px 12px;
    font-size: 13px;
    font-weight: 600;
    line-height: 1.55;
    color: #8d929c;
}

.import-input-row {
    display: flex;
    align-items: center;
    gap: 8px;
    height: 46px;
    margin-bottom: 8px;
    padding: 0 6px 0 14px;
    border-radius: 14px;
    background: #f2f3f7;
    border: 1.5px solid transparent;

    &:focus-within {
        background: #ffffff;
        border-color: rgba(53, 125, 244, 0.35);
    }

    &--error {
        border-color: rgba(224, 79, 71, 0.55);
        background: #fdf3f2;
    }
}

.import-input {
    flex: 1;
    min-width: 0;
    height: 100%;
    font-size: 14px;
    font-weight: 600;
    color: #24262b;
}

.import-clear {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: 24px;
    height: 24px;
    padding: 0;
    border-radius: 999px;
    color: #ffffff;
    background: #c4c7cf;

    &::after {
        border: none !important;
    }

    &:active {
        transform: scale(0.9);
    }
}

.import-paste {
    flex-shrink: 0;
    height: 32px;
    line-height: 32px;
    margin: 0;
    padding: 0 14px;
    border-radius: 10px;
    color: #e04f47;
    font-size: 13px;
    font-weight: 800;
    background: #fde7e5;

    &::after {
        border: none !important;
    }

    &:active {
        background: #fbd8d4;
    }
}

.import-error {
    margin: 0 2px 12px;
    font-size: 12px;
    font-weight: 600;
    color: #e04f47;
}

.import-primary-btn {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    height: 48px;
    margin-top: 4px;
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
