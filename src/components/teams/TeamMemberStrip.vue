<template>
    <!--
        队伍成员缩略条：固定 6 个槽位，已选成员渲染精灵图，其余留虚线空槽。
        纯展示：精灵走加密图片通道（front 小图），hasSprite 由 pokemon store 三态透传。
    -->
    <view class="team-member-strip">
        <EncryptedSprite
            v-for="(m, i) in visibleMembers"
            :key="`${memberFormId(m)}-${i}`"
            :pokemon-id="memberFormId(m)"
            variant="front"
            :preview="false"
            :has-sprite="memberHasSprite(m)"
            img-class="h-8 w-8"
            skeleton-class="h-8 w-8"
        />
        <view v-for="n in emptySlots" :key="`slot-${n}`" class="team-member-strip__slot"></view>
    </view>
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import EncryptedSprite from '@/components/sprite/EncryptedSprite.vue';
import { usePokemonStore } from '@/store/pokemon';
import { LIMITS, type TeamMember } from '@/services/teams/team-model';

const props = defineProps<{
    members: readonly TeamMember[];
}>();

const pokemonStore = usePokemonStore();

const visibleMembers = computed(() => props.members.slice(0, LIMITS.maxMembers));
const emptySlots = computed(() => Math.max(0, LIMITS.maxMembers - visibleMembers.value.length));

function memberFormId(m: TeamMember): number {
    return m.form_id ?? m.species_id;
}

function memberHasSprite(m: TeamMember): boolean | undefined {
    return pokemonStore.getById(memberFormId(m))?.hasSprite;
}
</script>

<style lang="scss" scoped>
.team-member-strip {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    gap: 2px;
}

.team-member-strip__slot {
    box-sizing: border-box;
    width: 32px;
    height: 32px;
    border: 1.5px dashed #d5d9e1;
    border-radius: 10px;
    background: #fafbfc;
}
</style>
