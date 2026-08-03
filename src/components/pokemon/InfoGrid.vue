<template>
    <view class="info-grid mb-3">
        <slot />
    </view>
</template>

<style scoped>
.info-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
}
</style>