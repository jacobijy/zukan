<template>
    <scroll-view scroll-x class="season-switch" :show-scrollbar="false">
        <view class="season-switch__row">
            <view
                v-for="s in seasons"
                :key="s"
                class="season-switch__chip"
                :class="{ 'season-switch__chip--active': s === modelValue }"
                @click="select(s)"
            >
                <text class="season-switch__label">{{ s }}</text>
                <text v-if="s === currentSeason" class="season-switch__cur">{{ t('meta.seasonCurrent') }}</text>
            </view>
        </view>
    </scroll-view>
</template>

<script lang="ts" setup>
import { useI18n } from 'vue-i18n';

const props = defineProps<{
    /** 可切换的赛季列表（meta.seasons，按新旧排） */
    seasons: string[];
    /** 当前赛季（meta.season），用于标注「当前」 */
    currentSeason: string;
    /** 当前选中的赛季 */
    modelValue: string;
}>();
const emit = defineEmits<{ 'update:modelValue': [value: string] }>();

const { t } = useI18n();

const select = (value: string) => {
    if (value !== props.modelValue) emit('update:modelValue', value);
};
</script>

<style lang="scss" scoped>
.season-switch {
    width: 100%;
    white-space: nowrap;
}

.season-switch__row {
    display: inline-flex;
    gap: 8px;
    padding: 2px;
}

.season-switch__chip {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    height: 32px;
    padding: 0 14px;
    border: 1px solid #e1e4eb;
    border-radius: 999px;
    background: #ffffff;
    box-shadow: 0 8px 16px rgba(48, 55, 72, 0.06);
    transition: all 0.15s ease;

    &:active {
        transform: scale(0.97);
    }

    &--active {
        border-color: #357df4;
        background: #357df4;
        box-shadow: 0 8px 16px rgba(53, 125, 244, 0.24);

        .season-switch__label {
            color: #ffffff;
        }

        .season-switch__cur {
            color: rgba(255, 255, 255, 0.8);
        }
    }
}

.season-switch__label {
    font-size: 12px;
    font-weight: 800;
    color: #4a5060;
}

.season-switch__cur {
    font-size: 10px;
    font-weight: 700;
    color: #9aa0ab;
}
</style>
