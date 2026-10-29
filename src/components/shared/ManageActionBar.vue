<template>
    <!--
        列表管理态底部操作条：全选切换 + 批量删除。v-if 挂载即做入场动画。
        删除闸门（确认框 / 登录）由父页面负责；count 为 0 时按钮禁用。
    -->
    <view class="manage-bar">
        <button class="manage-bar__all" @click="emit('toggleAll')">
            {{ allSelected ? deselectAllLabel : selectAllLabel }}
        </button>
        <button class="manage-bar__delete" :disabled="count === 0" @click="emit('delete')">
            {{ deleteLabel }}
        </button>
    </view>
</template>

<script lang="ts" setup>
defineProps<{
    count: number;
    allSelected: boolean;
    selectAllLabel: string;
    deselectAllLabel: string;
    deleteLabel: string;
}>();

const emit = defineEmits<{
    (e: 'toggleAll'): void;
    (e: 'delete'): void;
}>();
</script>

<style lang="scss" scoped>
.manage-bar {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 900;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 16px calc(env(safe-area-inset-bottom, 0) + 10px);
    background: rgba(255, 255, 255, 0.96);
    border-top: 1px solid #e8eaf0;
    box-shadow: 0 -8px 24px rgba(48, 55, 72, 0.08);
    animation: manage-bar-in 0.22s ease-out;
}

@keyframes manage-bar-in {
    from {
        transform: translateY(100%);
    }
}

.manage-bar__all {
    flex-shrink: 0;
    height: 40px;
    margin: 0;
    padding: 0 16px;
    line-height: 40px;
    border-radius: 999px;
    color: #5d6470;
    font-size: 14px;
    font-weight: 800;
    background: #f1f3f8;

    &::after {
        border: none !important;
    }

    &:active {
        background: #e6e8ee;
    }
}

.manage-bar__delete {
    display: flex;
    flex: 1;
    align-items: center;
    justify-content: center;
    height: 40px;
    margin: 0;
    padding: 0;
    border-radius: 999px;
    color: #ffffff;
    font-size: 14px;
    font-weight: 800;
    background: linear-gradient(135deg, #ff8a7e, #e04f47);
    box-shadow: 0 8px 18px rgba(224, 79, 71, 0.22);

    &::after {
        border: none !important;
    }

    &:active:not([disabled]) {
        transform: scale(0.98);
    }

    &[disabled] {
        color: #ffffff;
        background: #d3d6dd;
        box-shadow: none;
    }
}
</style>
