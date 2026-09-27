<template>
    <view class="team-list-row">
        <view class="team-list-row__main" @click="emit('select')">
            <view class="team-list-row__icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                    <circle cx="9" cy="7" r="4"></circle>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                    <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                </svg>
            </view>
            <view class="team-list-row__text">
                <text class="team-list-row__name">{{ name }}</text>
                <text class="team-list-row__time">{{ updatedText }}</text>
            </view>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" class="team-list-row__chevron h-4 w-4">
                <path d="m9 18 6-6-6-6"></path>
            </svg>
        </view>
        <view class="team-list-row__menu" @click.stop="emit('menu')">
            <svg viewBox="0 0 24 24" fill="currentColor" class="h-5 w-5">
                <circle cx="12" cy="5" r="1.8"></circle>
                <circle cx="12" cy="12" r="1.8"></circle>
                <circle cx="12" cy="19" r="1.8"></circle>
            </svg>
        </view>
    </view>
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import type { TeamSummary } from '@/services/api/teams';

const props = defineProps<{ team: TeamSummary }>();
const emit = defineEmits<{
    select: [];
    menu: [];
}>();

const name = computed(() => props.team.name);
// RFC3339/UTC → 紧凑展示（YYYY-MM-DD HH:mm，UTC）
const updatedText = computed(() => props.team.updated_at.replace('T', ' ').slice(0, 16) + ' UTC');
</script>

<style lang="scss" scoped>
.team-list-row {
    display: flex;
    align-items: stretch;
    box-sizing: border-box;
    height: 68px;
    padding: 0 6px 0 14px;
}

.team-list-row__main {
    display: flex;
    flex: 1;
    align-items: center;
    gap: 12px;
    min-width: 0;
}

.team-list-row__icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border-radius: 12px;
    background: linear-gradient(135deg, #ff8a7e, #e04f47);
    color: #ffffff;
    flex-shrink: 0;
}

.team-list-row__text {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 3px;
    min-width: 0;
}

.team-list-row__name {
    overflow: hidden;
    font-size: 15px;
    font-weight: 800;
    color: #24262b;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.team-list-row__time {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 11px;
    font-weight: 700;
    color: #9aa0ab;
}

.team-list-row__chevron {
    flex-shrink: 0;
    color: #c4c7cf;
}

.team-list-row__menu {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    color: #b0b5bf;

    &:active {
        color: #6f7682;
    }
}
</style>
