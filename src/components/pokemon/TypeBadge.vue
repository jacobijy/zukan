<template>
    <text class="type-badge" :class="badgeClass" :style="badgeStyle">{{ label }}</text>
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import { getTypeMeta } from '@/constants/pokemonTypes';

interface Props {
    /** 属性 slug：'fire' / 'grass' / ... */
    type: string;
    /** sm 用于紧凑行内（计算器），md 为列表/招式卡默认，lg 用于详情页 */
    size?: 'xs' | 'sm' | 'md' | 'lg';
    /** pill = 圆角胶囊 + 渐变；chip = 小方角 + 纯色（计算器行内） */
    variant?: 'pill' | 'chip';
    /** 文案用全名还是单字；默认 chip 用单字、pill 用全名 */
    labelStyle?: 'name' | 'short';
}

const props = withDefaults(defineProps<Props>(), {
    size: 'md',
    variant: 'pill',
});

const meta = computed(() => getTypeMeta(props.type));

const label = computed(() => {
    const style = props.labelStyle ?? (props.variant === 'chip' ? 'short' : 'name');
    return style === 'short' ? meta.value.short : meta.value.name;
});

const badgeClass = computed(() => [
    `type-badge--${props.size}`,
    `type-badge--${props.variant}`,
    // chip 用 inline style 上纯色，不叠渐变 class
    props.variant === 'pill' ? meta.value.gradient : '',
]);

const badgeStyle = computed(() =>
    props.variant === 'chip' ? { background: meta.value.color } : undefined
);
</script>

<style scoped>
.type-badge {
    display: inline-flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    color: #fff;
    font-weight: 900;
    text-align: center;
    line-height: 1;
}

/* ── pill：圆角胶囊 + 渐变，列表卡 / 详情页 / 招式卡 ── */
.type-badge--pill {
    border-radius: 999px;
    box-shadow: 0 6px 12px rgba(0, 0, 0, 0.12);
}

.type-badge--pill.type-badge--md {
    min-width: 44px;
    padding: 5px 9px;
    font-size: 10px;
    letter-spacing: 0.06em;
}

.type-badge--pill.type-badge--lg {
    padding: 7px 16px;
    font-size: 14px;
    box-shadow: 0 8px 16px rgba(0, 0, 0, 0.12);
}

/* ── chip：小方角 + 纯色，计算器行内 ── */
.type-badge--chip.type-badge--sm {
    min-width: 22px;
    height: 18px;
    padding: 0 5px;
    border-radius: 4px;
    font-size: 10px;
    font-weight: 800;
}

.type-badge--chip.type-badge--xs {
    min-width: 20px;
    height: 16px;
    padding: 0 4px;
    border-radius: 3px;
    font-size: 9px;
    font-weight: 800;
}
</style>
