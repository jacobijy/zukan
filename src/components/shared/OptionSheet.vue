<template>
    <view v-if="mounted" class="sheet-root">
        <view
            class="sheet-mask"
            :class="{ 'sheet-mask--show': visible }"
            @click="onMaskClick"
            @touchmove.stop.prevent
        ></view>

        <view
            class="sheet-panel"
            :class="{ 'sheet-panel--show': visible }"
            @touchmove.stop
            @transitionend="onPanelTransitionEnd"
        >
            <view class="sheet-grip"></view>

            <view class="sheet-header">
                <text class="sheet-title">{{ title }}</text>
                <button class="sheet-close" @click="close">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
            </view>

            <scroll-view scroll-y class="sheet-options">
                <view
                    v-for="opt in options"
                    :key="opt.id"
                    class="sheet-option"
                    :class="{
                        'sheet-option--active': isSelected(opt.id),
                        'sheet-option--disabled': isOptionDisabled(opt),
                    }"
                    @click="onSelect(opt)"
                >
                    <view class="min-w-0 flex-1">
                        <text class="sheet-option__label">{{ opt.label }}</text>
                        <text v-if="opt.subtitle" class="sheet-option__subtitle">{{ opt.subtitle }}</text>
                    </view>

                    <view v-if="opt.id === loadingId" class="sheet-spinner"></view>
                    <svg
                        v-else-if="isSelected(opt.id)"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="3"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        class="sheet-check"
                    >
                        <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                    <view v-else-if="multi" class="sheet-box"></view>
                </view>
            </scroll-view>

            <view v-if="multi" class="sheet-actions">
                <button class="sheet-btn sheet-btn--ghost" @click="close">{{ t('common.cancel') }}</button>
                <button class="sheet-btn sheet-btn--primary" @click="confirm">{{ t('common.confirm') }}</button>
            </view>
        </view>
    </view>
</template>

<script lang="ts" setup>
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

export interface SheetOption {
    id: string;
    label: string;
    subtitle?: string;
    disabled?: boolean;
}

interface Props {
    /** 面板是否展开（v-model:visible） */
    visible: boolean;
    title: string;
    options: readonly SheetOption[];
    /** 单选为 id，多选为 id 数组；多选时未提供则初始为空集 */
    modelValue?: string | string[];
    multi?: boolean;
    /** 正在加载的选项 id（右侧显示 spinner，并禁用其他选项点击） */
    loadingId?: string | null;
    maskClosable?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
    multi: false,
    loadingId: null,
    maskClosable: true,
});

const emit = defineEmits<{
    'update:visible': [value: boolean];
    'update:modelValue': [value: string | string[]];
    confirm: [];
}>();

const { t } = useI18n();

// 保留在 DOM 中，让退出过渡能播完再卸载
const mounted = ref(props.visible);

/** 多选的本地草稿，每次打开时从 modelValue 同步 */
const draft = ref<string[]>([]);

watch(
    () => props.visible,
    (v) => {
        if (v) {
            mounted.value = true;
            if (props.multi) {
                draft.value = Array.isArray(props.modelValue) ? [...props.modelValue] : [];
            }
        }
    },
    { immediate: true }
);

function isSelected(id: string): boolean {
    if (props.multi) return draft.value.includes(id);
    return props.modelValue === id;
}

function isOptionDisabled(opt: SheetOption): boolean {
    if (opt.disabled) return true;
    // 加载中：除正在加载的项外全部禁用（正在加载的项允许点击以沿用组件既有行为）
    if (props.loadingId !== null && props.loadingId !== undefined && opt.id !== props.loadingId) {
        return true;
    }
    return false;
}

function onSelect(opt: SheetOption) {
    if (isOptionDisabled(opt)) return;

    if (props.multi) {
        const idx = draft.value.indexOf(opt.id);
        if (idx >= 0) draft.value.splice(idx, 1);
        else draft.value.push(opt.id);
        return;
    }

    if (opt.id === props.modelValue) {
        close();
        return;
    }
    emit('update:modelValue', opt.id);
    close();
}

function confirm() {
    if (props.multi) emit('update:modelValue', [...draft.value]);
    emit('confirm');
    close();
}

function close() {
    emit('update:visible', false);
}

function onMaskClick() {
    if (props.maskClosable) close();
}

// 面板 transform 过渡结束后才卸载节点（遮罩过渡时长不同，忽略冒泡上来的其它事件）
function onPanelTransitionEnd(e: TransitionEvent) {
    if (!props.visible && e.propertyName === 'transform') mounted.value = false;
}
</script>

<style lang="scss" scoped>
.sheet-root {
    position: fixed;
    inset: 0;
    z-index: 1500;
    pointer-events: none;
}

.sheet-mask {
    position: absolute;
    inset: 0;
    pointer-events: auto;
    background: rgba(36, 38, 43, 0);
    backdrop-filter: blur(0);
    transition: background 0.3s ease, backdrop-filter 0.3s ease;

    &--show {
        background: rgba(36, 38, 43, 0.42);
        backdrop-filter: blur(6px);
    }
}

.sheet-panel {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    flex-direction: column;
    max-height: 75vh;
    padding: 10px 16px env(safe-area-inset-bottom, 0);
    pointer-events: auto;
    background: #ffffff;
    border-radius: 28px 28px 0 0;
    box-shadow: 0 -24px 60px rgba(48, 55, 72, 0.22);
    transform: translateY(100%);
    transition: transform 0.32s cubic-bezier(0.22, 1, 0.36, 1);

    &--show {
        transform: translateY(0);
    }
}

.sheet-grip {
    flex-shrink: 0;
    align-self: center;
    width: 40px;
    height: 5px;
    margin: 4px 0 8px;
    border-radius: 999px;
    background: #e5e7ee;
}

.sheet-header {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 4px 4px 12px;
}

.sheet-title {
    font-size: 18px;
    font-weight: 900;
    letter-spacing: -0.03em;
    color: #24262b;
}

.sheet-close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    padding: 0;
    color: #8d929c;
    background: #f5f6fa;
    border: 0;
    border-radius: 999px;
    box-shadow: 0 8px 18px rgba(48, 55, 72, 0.08);

    &:active {
        transform: scale(0.94);
    }

    &::after {
        border: none !important;
    }
}

.sheet-options {
    flex: 1;
    min-height: 0;
}

.sheet-option {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 56px;
    padding: 12px 14px;
    margin-bottom: 8px;
    border: 1px solid #e5e7ee;
    border-radius: 18px;
    background: #f5f6fa;
    box-shadow: inset 0 1px 0 #ffffff;
    transition: transform 0.18s ease, background 0.18s ease, border-color 0.18s ease;

    &:active {
        transform: scale(0.985);
    }

    &--active {
        border-color: rgba(53, 125, 244, 0.32);
        background: linear-gradient(135deg, #eef4ff, #fff7dc);
    }

    &--disabled {
        opacity: 0.55;
    }
}

.sheet-option__label {
    display: block;
    font-size: 15px;
    font-weight: 800;
    color: #24262b;
}

.sheet-option__subtitle {
    display: block;
    margin-top: 2px;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 11px;
    font-weight: 700;
    color: #89947e;
}

.sheet-check {
    flex-shrink: 0;
    width: 22px;
    height: 22px;
    color: #357df4;
}

.sheet-box {
    flex-shrink: 0;
    width: 20px;
    height: 20px;
    border: 2px solid #c4c7cf;
    border-radius: 6px;
    background: #ffffff;
}

.sheet-option--active .sheet-box {
    border-color: #357df4;
    background: #357df4;
    box-shadow: inset 0 0 0 3px #ffffff;
}

.sheet-spinner {
    flex-shrink: 0;
    width: 20px;
    height: 20px;
    border: 2.5px solid #e5e7ee;
    border-top-color: #357df4;
    border-radius: 50%;
    animation: sheet-spin 0.7s linear infinite;
}

@keyframes sheet-spin {
    to {
        transform: rotate(360deg);
    }
}

.sheet-actions {
    display: flex;
    flex-shrink: 0;
    gap: 10px;
    padding: 14px 0 4px;
}

.sheet-btn {
    flex: 1;
    height: 46px;
    font-size: 15px;
    font-weight: 800;
    border: 0;
    border-radius: 16px;

    &::after {
        border: none !important;
    }

    &:active {
        transform: scale(0.98);
    }

    &--ghost {
        color: #6f7480;
        background: #f0f2f6;
    }

    &--primary {
        color: #ffffff;
        background: linear-gradient(135deg, #73b7ff, #357df4);
        box-shadow: 0 12px 24px rgba(53, 125, 244, 0.28);
    }
}
</style>
