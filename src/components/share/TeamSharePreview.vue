<template>
    <!--
        队伍分享缩略卡：队名 + 成员立绘横排（≤6）+ 人数 / 单打双打。
        纯展示：名字经 i18n bundle 解析，立绘走加密图片通道，不发额外请求。
    -->
    <view class="team-preview">
        <text class="team-preview__name">{{ name }}</text>

        <view class="team-preview__sprites">
            <EncryptedSprite
                v-for="(m, i) in payload.members"
                :key="i"
                :pokemon-id="memberFormId(m)"
                variant="front"
                :preview="false"
                :has-sprite="memberHasSprite(m)"
                img-class="h-10 w-10"
                skeleton-class="h-10 w-10"
            />
        </view>

        <text class="team-preview__meta">
            {{ interp('teams.memberCount', { count: payload.members.length }) }}
            ·
            {{ payload.format === 'doubles' ? t('teams.formatDoubles') : t('teams.formatSingles') }}
        </text>
    </view>
</template>

<script lang="ts" setup>
import { useI18n } from 'vue-i18n';
import { interp } from '@/services/i18n/ui-i18n';
import EncryptedSprite from '@/components/sprite/EncryptedSprite.vue';
import { usePokemonStore } from '@/store/pokemon';
import type { TeamMember, TeamPayload } from '@/services/teams/team-model';

defineProps<{
    name: string;
    payload: TeamPayload;
}>();

const { t } = useI18n();
const pokemonStore = usePokemonStore();

function memberFormId(m: TeamMember): number {
    return m.form_id ?? m.species_id;
}

function memberHasSprite(m: TeamMember): boolean | undefined {
    return pokemonStore.getById(memberFormId(m))?.hasSprite;
}
</script>

<style lang="scss" scoped>
.team-preview {
    flex-shrink: 0;
    padding: 14px 12px 12px;
    border-radius: 16px;
    background: #f6f7fa;
}

.team-preview__name {
    display: block;
    overflow: hidden;
    font-size: 15px;
    font-weight: 900;
    color: #24262b;
    text-align: center;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.team-preview__sprites {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 2px 4px;
    margin: 6px 0 4px;
}

.team-preview__meta {
    font-size: 12px;
    font-weight: 700;
    color: #9aa0ab;
    text-align: center;
}
</style>
