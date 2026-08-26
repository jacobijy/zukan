<template>
    <view v-if="visible" class="sheet-root">
        <view class="sheet-mask" @click="onMaskClick" @touchmove.stop.prevent></view>

        <view class="sheet-panel" @touchmove.stop>
            <view class="sheet-grip"></view>

            <view class="sheet-header">
                <text class="sheet-title">{{ title }}</text>
                <view class="sheet-header__actions">
                    <button class="sheet-text-btn sheet-text-btn--cancel" @click="close">
                        {{ t('common.cancel') }}
                    </button>
                    <button class="sheet-text-btn sheet-text-btn--confirm" @click="confirm">
                        {{ t('common.confirm') }}
                    </button>
                </view>
            </view>

            <view v-if="searchable" class="relative mb-1 flex shrink-0 items-center px-1 pt-2">
                <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2.2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    class="pointer-events-none absolute left-4 top-1/2 h-[17px] w-[17px] -translate-y-1/2 text-[#9da2ad]"
                >
                    <circle cx="11" cy="11" r="7"></circle>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
                <input
                    :value="query"
                    @input="onQueryInput"
                    type="text"
                    class="h-11 w-full rounded-[14px] bg-[#f2f3f7] pl-10 pr-10 text-[15px] font-semibold text-[#24262b] outline-none placeholder:font-medium placeholder:text-[#b0b5bf] focus:bg-white focus:shadow-[0_0_0_3px_rgba(53,125,244,0.14)]"
                    :placeholder="t('common.search')"
                    confirm-type="search"
                />
                <button
                    v-if="query"
                    class="absolute right-3 top-1/2 flex h-[24px] w-[24px] -translate-y-1/2 items-center justify-center rounded-full bg-[#c4c7cf] p-0 text-white [&::after]:border-none active:scale-90"
                    @click="query = ''"
                >
                    <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2.6"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        class="h-3 w-3"
                    >
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
            </view>

            <scroll-view scroll-y class="sheet-options">
                <view
                    v-for="opt in visibleOptions"
                    :key="opt.id"
                    class="sheet-option"
                    :class="{
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
                </view>

                <view v-if="visibleOptions.length === 0" class="sheet-empty">
                    <text class="sheet-empty__text">{{ t('common.noResult') }}</text>
                </view>
                <view v-else-if="filteredOptions.length > visibleOptions.length" class="sheet-more">
                    <text class="sheet-more__text">{{
                        t('common.narrowSearch', { count: filteredOptions.length })
                    }}</text>
                </view>
            </scroll-view>
        </view>
    </view>
</template>

<script lang="ts" setup>
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

export interface SheetOption {
    id: string;
    label: string;
    subtitle?: string;
    disabled?: boolean;
}

interface Props {
    /** 面板是否展开（v-model:visible）；关闭即卸载，入场动画见样式 */
    visible: boolean;
    title: string;
    options: readonly SheetOption[];
    /** 单选为 id，多选为 id 数组；多选时未提供则初始为空集 */
    modelValue?: string | string[];
    multi?: boolean;
    /** 正在加载的选项 id（右侧显示 spinner，并禁用其他选项点击） */
    loadingId?: string | null;
    maskClosable?: boolean;
    /** 显示搜索框的选项数阈值；选项数 ≥ 该值才出现搜索框（短列表不打扰） */
    searchThreshold?: number;
    /** 无搜索词时最多渲染多少项（防上千选项一次性铺 DOM）；搜索后不限 */
    renderLimit?: number;
}

const props = withDefaults(defineProps<Props>(), {
    multi: false,
    loadingId: null,
    maskClosable: true,
    searchThreshold: 12,
    renderLimit: 200,
});

const emit = defineEmits<{
    'update:visible': [value: boolean];
    'update:modelValue': [value: string | string[]];
    confirm: [];
}>();

const { t } = useI18n();

// ── 选择草稿：点选项只标记，确定才 emit（与 iOS 选择器一致，取消可放弃） ──
const singleDraft = ref<string>(typeof props.modelValue === 'string' ? props.modelValue : '');
const multiDraft = ref<string[]>(Array.isArray(props.modelValue) ? [...props.modelValue] : []);

// ── 搜索过滤 ──────────────────────────────────────────────
const query = ref('');

/** 选项数达到阈值才显示搜索框 */
const searchable = computed(() => props.options.length >= props.searchThreshold);

/** 归一化：去空格、转小写，便于中英文/编号模糊匹配 */
function normalize(s: string): string {
    return s.toLowerCase().replace(/\s+/g, '');
}

const filteredOptions = computed<SheetOption[]>(() => {
    const q = normalize(query.value);
    if (!q) return [...props.options];
    return props.options.filter((o) => {
        if (normalize(o.label).includes(q)) return true;
        if (o.subtitle && normalize(o.subtitle).includes(q)) return true;
        return false;
    });
});

/**
 * 无搜索词时限渲染 renderLimit 项（长列表性能兜底）；
 * 一旦输入搜索词，匹配结果通常已很少，全量渲染。
 */
const visibleOptions = computed<SheetOption[]>(() => {
    if (query.value) return filteredOptions.value;
    return filteredOptions.value.slice(0, props.renderLimit);
});

// 面板打开时：清空搜索词，并把草稿重置为当前已选（组件实例常驻、面板 v-if）
watch(
    () => props.visible,
    (open) => {
        if (!open) return;
        query.value = '';
        singleDraft.value = typeof props.modelValue === 'string' ? props.modelValue : '';
        multiDraft.value = Array.isArray(props.modelValue) ? [...props.modelValue] : [];
    },
);

function isSelected(id: string): boolean {
    if (props.multi) return multiDraft.value.includes(id);
    return singleDraft.value === id;
}

function isOptionDisabled(opt: SheetOption): boolean {
    if (opt.disabled) return true;
    // 加载中：除正在加载的项外全部禁用
    if (props.loadingId !== null && props.loadingId !== undefined && opt.id !== props.loadingId) {
        return true;
    }
    return false;
}

function onSelect(opt: SheetOption) {
    if (isOptionDisabled(opt)) return;
    if (props.multi) {
        const idx = multiDraft.value.indexOf(opt.id);
        if (idx >= 0) multiDraft.value.splice(idx, 1);
        else multiDraft.value.push(opt.id);
        return;
    }
    singleDraft.value = opt.id;
}

/** 确定：把草稿提交出去（单选未改则不重复 emit），然后关闭 */
function confirm() {
    if (props.multi) {
        emit('update:modelValue', [...multiDraft.value]);
    } else if (singleDraft.value && singleDraft.value !== props.modelValue) {
        emit('update:modelValue', singleDraft.value);
    }
    emit('confirm');
    close();
}

function close() {
    emit('update:visible', false);
}

function onMaskClick() {
    if (props.maskClosable) close();
}

// uni <input> 编译成 uni-input，input 事件值在 e.detail.value（H5 回落 e.target.value）
function onQueryInput(e: any) {
    query.value = e.detail?.value ?? e.target?.value ?? '';
}
</script>

<style lang="scss" scoped>
.sheet-root {
    position: fixed;
    inset: 0;
    z-index: 1500;
    pointer-events: none;
}

/* 关闭即 v-if 卸载，只做入场动画（与 LoginModal 一致）；
 * 不做退出过渡，避免依赖 transitionend 导致遮罩残留挡住返回。 */
.sheet-mask {
    position: absolute;
    inset: 0;
    pointer-events: auto;
    background: rgba(36, 38, 43, 0.42);
    backdrop-filter: blur(6px);
    animation: sheet-fade 0.28s ease-out;
}

.sheet-panel {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    flex-direction: column;
    max-height: 84vh;
    padding: 8px 16px calc(env(safe-area-inset-bottom, 0) + 10px);
    pointer-events: auto;
    background: #ffffff;
    border-radius: 26px 26px 0 0;
    box-shadow: 0 -24px 60px rgba(48, 55, 72, 0.22);
    animation: sheet-slide-up 0.34s cubic-bezier(0.22, 1, 0.36, 1);
}

@keyframes sheet-fade {
    from {
        background: rgba(36, 38, 43, 0);
        backdrop-filter: blur(0);
    }
}

@keyframes sheet-slide-up {
    from {
        transform: translateY(100%);
    }
}

.sheet-grip {
    flex-shrink: 0;
    align-self: center;
    width: 38px;
    height: 5px;
    margin: 2px 0 6px;
    border-radius: 999px;
    background: #e6e8ee;
}

.sheet-header {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 6px 2px 10px;
}

.sheet-title {
    min-width: 0;
    font-size: 20px;
    font-weight: 900;
    letter-spacing: -0.03em;
    color: #1a1d24;
}

.sheet-header__actions {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    gap: 18px;
}

.sheet-text-btn {
    margin: 0;
    padding: 0;
    font-size: 16px;
    font-weight: 800;
    line-height: 1.2;
    background: transparent;
    border: 0;

    &::after {
        border: none !important;
    }

    &:active {
        opacity: 0.6;
    }

    &--cancel {
        color: #8d929c;
        font-weight: 700;
    }

    &--confirm {
        color: #357df4;
    }
}

/* uni <scroll-view> 需要确定高度才会内部滚动：给一个 vh 上限兜底，
 * 短列表不触顶、仍是内容高度；长列表到此内部滚动。 */
.sheet-options {
    flex: 1;
    min-height: 0;
    max-height: 60vh;
    margin-top: 4px;
}

.sheet-option {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 52px;
    padding: 12px 6px;
    border-bottom: 1px solid #eef0f4;
    transition: background 0.15s ease;

    &:active {
        background: #f7f8fb;
    }

    &--disabled {
        opacity: 0.45;
    }
}

.sheet-option__label {
    display: block;
    font-size: 16px;
    font-weight: 700;
    color: #24262b;
}

.sheet-option__subtitle {
    display: block;
    margin-top: 2px;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 11px;
    font-weight: 700;
    color: #9da2ad;
}

.sheet-check {
    flex-shrink: 0;
    width: 22px;
    height: 22px;
    color: #357df4;
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

.sheet-empty,
.sheet-more {
    padding: 22px 14px;
    text-align: center;
}

.sheet-empty__text {
    font-size: 14px;
    font-weight: 600;
    color: #9da2ad;
}

.sheet-more__text {
    font-size: 12px;
    font-weight: 700;
    color: #b0b5bf;
}
</style>
