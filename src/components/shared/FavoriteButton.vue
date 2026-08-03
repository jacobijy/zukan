<template>
    <button
        class="detail-icon-button"
        :class="{ 'detail-icon-button--active': active }"
        @click="$emit('toggle')"
    >
        <svg viewBox="0 0 24 24" :fill="active ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5">
            <polygon points="12 2.8 14.9 8.7 21.4 9.65 16.7 14.25 17.8 20.75 12 17.68 6.2 20.75 7.3 14.25 2.6 9.65 9.1 8.7 12 2.8"></polygon>
        </svg>
    </button>
</template>

<script lang="ts" setup>
defineProps<{
    active: boolean;
}>();

defineEmits<{
    toggle: [];
}>();
</script>

<style scoped>
.detail-icon-button {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    padding: 0;
    margin: 0;
    color: #8d929c;
    background: transparent;
    border: 0;
}

.detail-icon-button--active {
    color: #e04f47;
}
</style>