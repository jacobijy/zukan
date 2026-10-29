<template>
    <!--
        队伍成员只读卡（观察模式）：立绘 + 名/形态 + 性格·特性·道具 + 招式 chips + SP 分配。
        名称全部走 i18n bundle 本地解析；招式池按形态懒加载（service 层缓存，与 MemberCard 共用）。
    -->
    <view class="member-ro">
        <view class="member-ro__head">
            <EncryptedSprite
                :pokemon-id="formId"
                variant="front"
                :preview="false"
                :has-sprite="speciesModel?.hasSprite"
                img-class="h-12 w-12"
                skeleton-class="h-12 w-12"
            />
            <view class="member-ro__main">
                <view class="flex items-baseline gap-1.5">
                    <text class="member-ro__name">{{ displayName }}</text>
                    <text v-if="formText" class="member-ro__form">{{ formText }}</text>
                </view>
                <text class="member-ro__meta">{{ metaText }}</text>
            </view>
        </view>

        <view class="member-ro__body">
            <view class="member-ro__section">
                <text class="member-ro__label">{{ t('teams.fieldMoves') }}</text>
                <view v-if="member.moves.length" class="member-ro__chips">
                    <SelectedMoveChip v-for="m in member.moves" :key="m" :move-id="m" :type="typeOfMove(m)" />
                </view>
                <text v-else class="member-ro__empty">{{ t('teams.none') }}</text>
            </view>

            <view class="member-ro__section">
                <text class="member-ro__label">{{ t('teams.fieldSpread') }}</text>
                <text v-if="spreadText" class="member-ro__spread">{{ spreadText }}</text>
                <text v-else class="member-ro__empty">{{ t('teams.none') }}</text>
            </view>
        </view>
    </view>
</template>

<script lang="ts" setup>
import { computed, shallowRef, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import EncryptedSprite from '@/components/sprite/EncryptedSprite.vue';
import SelectedMoveChip from '@/components/teams/SelectedMoveChip.vue';
import { useI18nStore } from '@/store/i18n';
import { usePokemonStore } from '@/store/pokemon';
import { loadMovePoolForForm } from '@/services/teams/member-options';
import { CHAMPION_ALIGNMENTS } from '@/pages/statcalc/statcalc-options';
import type { TeamMember } from '@/services/teams/team-model';

const props = defineProps<{ member: TeamMember }>();

const { t } = useI18n();
const i18nStore = useI18nStore();
const pokemonStore = usePokemonStore();

const formId = computed(() => props.member.form_id ?? props.member.species_id);
const speciesModel = computed(() => pokemonStore.getById(formId.value));
const displayName = computed(
    () => i18nStore.speciesName(props.member.species_id) ?? `#${props.member.species_id}`,
);
const formText = computed(
    () => (props.member.form_id ? i18nStore.formLabel(props.member.form_id) : null) ?? '',
);

const natureText = computed(() => {
    const align = CHAMPION_ALIGNMENTS.find((a) => a.slug === props.member.nature);
    return align ? i18nStore.natureName(align.pokeId) ?? '' : '';
});
const abilityText = computed(() =>
    props.member.ability_id ? i18nStore.abilityName(props.member.ability_id) ?? '' : '',
);
const itemText = computed(() =>
    props.member.item_id ? i18nStore.itemName(props.member.item_id) ?? '' : '',
);
const metaText = computed(
    () => [natureText.value, abilityText.value, itemText.value].filter(Boolean).join(' · ') || '—',
);

// ── 招式池（只读卡挂载即加载，展开 MemberCard 时命中缓存） ──
const pool = shallowRef<MoveRecord[]>([]);
let loadedFor: number | null = null;

async function ensurePool(id: number): Promise<void> {
    if (loadedFor === id) return;
    loadedFor = id;
    try {
        pool.value = await loadMovePoolForForm(id);
    } catch {
        loadedFor = null;
    }
}
watch(formId, (id) => void ensurePool(id), { immediate: true });

function typeOfMove(id: number): string | undefined {
    return pool.value.find((r) => r.id === id)?.type;
}

// ── SP 分配（只列非零项） ──
const SP_KEYS = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'] as const;
const spreadText = computed(() =>
    SP_KEYS.filter((k) => props.member.spread[k] > 0)
        .map((k) => `${t(`teams.sp.${k}`)} ${props.member.spread[k]}`)
        .join(' · '),
);
</script>

<style lang="scss" scoped>
.member-ro {
    border: 1px solid #e8eaf0;
    border-radius: 18px;
    background: #ffffff;
    box-shadow: 0 10px 24px rgba(48, 55, 72, 0.05);
    overflow: hidden;
}

.member-ro__head {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px;
}

.member-ro__main {
    flex: 1;
    min-width: 0;
}

.member-ro__name {
    font-size: 15px;
    font-weight: 800;
    color: #24262b;
}

.member-ro__form {
    overflow: hidden;
    font-size: 11px;
    font-weight: 700;
    color: #9aa0ab;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.member-ro__meta {
    margin-top: 2px;
    font-size: 11px;
    font-weight: 700;
    color: #9aa0ab;
}

.member-ro__body {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 2px 14px 14px;
    border-top: 1px solid #f1f2f6;
}

.member-ro__section {
    display: flex;
    flex-direction: column;
    gap: 7px;
    padding-top: 10px;
}

.member-ro__label {
    font-size: 13px;
    font-weight: 700;
    color: #6f7682;
}

.member-ro__chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
}

.member-ro__spread {
    font-size: 12px;
    font-weight: 700;
    color: #24262b;
}

.member-ro__empty {
    font-size: 12px;
    font-weight: 600;
    color: #b0b5bf;
}
</style>
