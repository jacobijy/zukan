<template>
    <view class="team-list-row">
        <view
            v-if="selecting"
            class="team-list-row__check"
            :class="{ 'team-list-row__check--on': selected }"
            @click.stop="emit('toggleSelect')"
        >
            <!-- #ifdef MP-WEIXIN -->
            <text v-if="selected" class="ic text-[14px]">{{ glyph('check') }}</text>
            <!-- #endif -->
            <!-- #ifndef MP-WEIXIN -->
            <svg v-if="selected" data-ic="check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" class="h-3.5 w-3.5">
                <path d="m5 12.5 4.5 4.5L19 7.5"></path>
            </svg>
            <!-- #endif -->
        </view>
        <view class="team-list-row__main" @click="emit('select')">
            <view class="team-list-row__head">
                <text class="team-list-row__name">{{ name }}</text>
                <text class="team-list-row__time">{{ updatedText }}</text>
                <!-- #ifdef MP-WEIXIN -->
                <text v-if="!selecting" class="ic team-list-row__chevron text-[16px]">{{ glyph('chevron-right') }}</text>
                <!-- #endif -->
                <!-- #ifndef MP-WEIXIN -->
                <svg v-if="!selecting" data-ic="chevron-right" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" class="team-list-row__chevron h-4 w-4">
                    <path d="m9 18 6-6-6-6"></path>
                </svg>
                <!-- #endif -->
            </view>
            <view class="team-list-row__body">
                <TeamMemberStrip :members="members" />
                <!-- 预取未到时不显示 0/6，避免误导；管理态窄屏也不占位 -->
                <text v-if="metaText && !selecting" class="team-list-row__meta">{{ metaText }}</text>
            </view>
        </view>
    </view>
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { TeamSummary } from '@/services/api/teams';
import type { TeamMember, TeamPayload } from '@/services/teams/team-model';
import { interp } from '@/services/i18n/ui-i18n';
import TeamMemberStrip from '@/components/teams/TeamMemberStrip.vue';
import { glyph } from '@/components/icon/glyphs';

const props = withDefaults(
    defineProps<{
        team: TeamSummary;
        /** 列表缩略预览；null/缺省 = 尚未预取（只渲染虚线空槽） */
        preview?: TeamPayload | null;
        /** 管理态：行前显示勾选圈 */
        selecting?: boolean;
        selected?: boolean;
    }>(),
    { preview: null, selecting: false, selected: false },
);

const emit = defineEmits<{
    select: [];
    toggleSelect: [];
}>();

const { t } = useI18n();

const name = computed(() => props.team.name);
// RFC3339/UTC → 紧凑展示（YYYY-MM-DD HH:mm，UTC）
const updatedText = computed(() => props.team.updated_at.replace('T', ' ').slice(0, 16) + ' UTC');

const members = computed<readonly TeamMember[]>(() => props.preview?.members ?? []);

const metaText = computed(() => {
    const preview = props.preview;
    if (!preview) return '';
    const count = interp('teams.memberCount', { count: preview.members.length });
    const format = preview.format === 'doubles' ? t('teams.formatDoubles') : t('teams.formatSingles');
    return `${count} · ${format}`;
});
</script>

<style lang="scss" scoped>
.team-list-row {
    display: flex;
    align-items: stretch;
    box-sizing: border-box;
    height: 92px;
    padding: 0 6px 0 14px;
}

.team-list-row__main {
    display: flex;
    flex: 1;
    flex-direction: column;
    justify-content: center;
    gap: 6px;
    min-width: 0;
}

.team-list-row__head {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
}

.team-list-row__name {
    overflow: hidden;
    flex: 1;
    min-width: 0;
    font-size: 15px;
    font-weight: 800;
    color: #24262b;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.team-list-row__time {
    flex-shrink: 0;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 11px;
    font-weight: 700;
    color: #9aa0ab;
}

.team-list-row__body {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
}

.team-list-row__meta {
    overflow: hidden;
    min-width: 0;
    font-size: 11px;
    font-weight: 700;
    color: #9aa0ab;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.team-list-row__chevron {
    flex-shrink: 0;
    color: #c4c7cf;
}

.team-list-row__check {
    display: flex;
    flex-shrink: 0;
    align-self: center;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    margin-right: 10px;
    border-radius: 999px;
    border: 1.8px solid #c9ced8;
    color: #ffffff;
    background: #ffffff;

    &:active {
        transform: scale(0.88);
    }
}

.team-list-row__check--on {
    border-color: transparent;
    background: linear-gradient(135deg, #ff8a7e, #e04f47);
}
</style>
