<template>
    <button class="filter-chip" :class="{ 'filter-chip--active': active }" @click="emit('click')">
        <!-- 类型筛选：属性色圆点；分类筛选：漏斗图标 -->
        <span v-if="dotColor" class="filter-chip__dot" :style="{ background: dotColor }"></span>
        <svg
            v-else
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.4"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="h-3.5 w-3.5"
        >
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
        </svg>
        <text class="filter-chip__label">{{ label }}</text>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" class="h-3.5 w-3.5 opacity-60">
            <path d="m6 9 6 6 6-6"></path>
        </svg>
    </button>
</template>

<script lang="ts" setup>
defineProps<{
    label: string;
    active: boolean;
    /** 类型筛选时传属性色，渲染为圆点；不传则显示漏斗图标 */
    dotColor?: string;
}>();

const emit = defineEmits<{ click: [] }>();
</script>

<style lang="scss" scoped>
.filter-chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 36px;
    padding: 0 12px;
    margin: 0;
    font-size: 12px;
    font-weight: 800;
    color: #6f7480;
    white-space: nowrap;
    background: #fff;
    border: 1px solid #e1e4eb;
    border-radius: 999px;
    box-shadow: 0 8px 16px rgba(48, 55, 72, 0.06);
    transition:
        transform 0.18s ease,
        background 0.18s ease,
        color 0.18s ease,
        border-color 0.18s ease;

    &:active {
        transform: scale(0.96);
    }

    &--active {
        color: #fff;
        background: linear-gradient(135deg, #73b7ff, #357df4);
        border-color: transparent;
        box-shadow: 0 10px 20px rgba(53, 125, 244, 0.22);
    }
}

.filter-chip__label {
    max-width: 140px;
    overflow: hidden;
    text-overflow: ellipsis;
}

.filter-chip__dot {
    flex-shrink: 0;
    width: 12px;
    height: 12px;
    border-radius: 999px;
    box-shadow:
        inset 0 0 0 1.5px rgba(255, 255, 255, 0.65),
        0 1px 2px rgba(0, 0, 0, 0.2);
}
</style>
