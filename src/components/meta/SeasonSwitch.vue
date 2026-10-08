<template>
    <view class="season-picker">
        <view class="season-picker__trigger" @click="open = !open">
            <text class="season-picker__label">{{ modelValue }}{{ isCurrent ? ` · ${t('meta.seasonCurrent')}` : '' }}</text>
            <!-- #ifdef MP-WEIXIN -->
            <text class="ic season-picker__chevron text-[16px]">{{ glyph('chevron-down') }}</text>
            <!-- #endif -->
            <!-- #ifndef MP-WEIXIN -->
            <svg data-ic="chevron-down" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" class="season-picker__chevron h-4 w-4">
                <path d="m6 9 6 6 6-6"></path>
            </svg>
            <!-- #endif -->
        </view>

        <!-- 点击外部关闭 -->
        <view v-if="open" class="season-picker__mask" @click="open = false"></view>

        <!-- 就地向下展开的赛季列表 -->
        <view v-if="open" class="season-picker__dropdown">
            <view
                v-for="s in seasons"
                :key="s"
                class="season-picker__option"
                :class="{ 'season-picker__option--active': s === modelValue }"
                @click="onPick(s)"
            >
                <view class="season-picker__option-main">
                    <text class="season-picker__option-label">{{ s }}</text>
                    <text v-if="s === currentSeason" class="season-picker__option-cur">{{ t('meta.seasonCurrent') }}</text>
                </view>
                <!-- #ifdef MP-WEIXIN -->
                <text v-if="s === modelValue" class="ic season-picker__check text-[16px]">{{ glyph('check') }}</text>
                <!-- #endif -->
                <!-- #ifndef MP-WEIXIN -->
                <svg v-if="s === modelValue" data-ic="check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" class="season-picker__check h-4 w-4">
                    <path d="m5 12.5 4.5 4.5L19 7.5"></path>
                </svg>
                <!-- #endif -->
            </view>
        </view>
    </view>
</template>

<script lang="ts" setup>
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { glyph } from '@/components/icon/glyphs';

const props = defineProps<{
    /** 可切换的赛季列表（meta.seasons） */
    seasons: string[];
    /** 当前赛季（meta.season），用于标注「当前」 */
    currentSeason: string;
    /** 当前选中的赛季 */
    modelValue: string;
}>();
const emit = defineEmits<{ 'update:modelValue': [value: string] }>();

const { t } = useI18n();

const open = ref(false);

const isCurrent = computed(() => props.modelValue === props.currentSeason);

const onPick = (value: string) => {
    open.value = false;
    if (value !== props.modelValue) emit('update:modelValue', value);
};
</script>

<style lang="scss" scoped>
.season-picker {
    position: relative;
    display: inline-flex;
}

.season-picker__trigger {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 34px;
    padding: 0 12px;
    border: 1px solid #e1e4eb;
    border-radius: 999px;
    background: #ffffff;
    box-shadow: 0 8px 16px rgba(48, 55, 72, 0.06);
    transition: all 0.15s ease;

    &:active {
        transform: scale(0.97);
    }
}

.season-picker__label {
    font-size: 13px;
    font-weight: 800;
    color: #24262b;
}

.season-picker__chevron {
    flex-shrink: 0;
    color: #9aa0ab;
    transition: transform 0.15s ease;
}

/* 点击外部关闭：透明遮罩覆盖全屏，层级低于下拉列表 */
.season-picker__mask {
    position: fixed;
    inset: 0;
    z-index: 600;
}

.season-picker__dropdown {
    position: absolute;
    top: calc(100% + 6px);
    left: 0;
    z-index: 601;
    min-width: 170px;
    padding: 6px;
    background: #ffffff;
    border: 1px solid #e8eaf0;
    border-radius: 14px;
    box-shadow: 0 16px 40px rgba(48, 55, 72, 0.16);
    animation: season-in 0.12s ease-out;
}

@keyframes season-in {
    from {
        opacity: 0;
        transform: translateY(-4px);
    }
}

.season-picker__option {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 9px 12px;
    border-radius: 10px;
    transition: background 0.12s ease;

    &:active {
        background: #f2f3f7;
    }

    &--active {
        background: #eef4ff;

        .season-picker__option-label {
            color: #357df4;
        }
    }
}

.season-picker__option-main {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
}

.season-picker__option-label {
    font-size: 13px;
    font-weight: 800;
    color: #24262b;
}

.season-picker__option-cur {
    font-size: 10px;
    font-weight: 700;
    color: #9aa0ab;
}

.season-picker__check {
    flex-shrink: 0;
    color: #357df4;
}
</style>
