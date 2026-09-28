<template>
    <view class="member-card">
        <view class="member-card__head" @click="toggle">
            <EncryptedSprite
                :pokemon-id="formId"
                variant="front"
                :preview="false"
                :has-sprite="speciesModel?.hasSprite"
                img-class="h-12 w-12"
                skeleton-class="h-12 w-12"
            />
            <view class="member-card__main">
                <view class="flex items-baseline gap-1.5">
                    <text class="member-card__name">{{ displayName }}</text>
                    <text v-if="member.form_id" class="member-card__form">{{ formText }}</text>
                </view>
                <text v-if="collapsedSummary" class="member-card__meta">{{ collapsedSummary }}</text>
            </view>
            <view class="member-card__ops">
                <view class="member-card__trash" @click.stop="emit('remove')">
                    <!-- #ifdef MP-WEIXIN -->
                    <text class="ic text-[18px]">{{ glyph('trash') }}</text>
                    <!-- #endif -->
                    <!-- #ifndef MP-WEIXIN -->
                    <svg data-ic="trash" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-[18px] w-[18px]">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6l-1 14H6L5 6m3 0V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"></path>
                    </svg>
                    <!-- #endif -->
                </view>
                <!-- #ifdef MP-WEIXIN -->
                <text class="ic chevron text-[16px]">{{ glyph('chevron-down') }}</text>
                <!-- #endif -->
                <!-- #ifndef MP-WEIXIN -->
                <svg data-ic="chevron-down" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" class="chevron h-4 w-4" :class="{ 'chevron--open': expanded }">
                    <path d="m6 9 6 6 6-6"></path>
                </svg>
                <!-- #endif -->
            </view>
        </view>

        <view v-if="expanded" class="member-card__body">
            <button class="popular-btn" @click="applyPopular">
                <!-- #ifdef MP-WEIXIN -->
                <text class="ic text-[16px]">{{ glyph('sparkle') }}</text>
                <!-- #endif -->
                <!-- #ifndef MP-WEIXIN -->
                <svg data-ic="sparkle" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4">
                    <path d="m12 2 2.6 6.5L21 11l-6.4 2.5L12 20l-2.6-6.5L3 11l6.4-2.5L12 2z"></path>
                </svg>
                <!-- #endif -->
                <text>{{ popularBusy ? t('teams.saving') : t('teams.popularApply') }}</text>
            </button>

            <view class="field-row" @click="openSheet('ability')">
                <text class="field-row__label">{{ t('teams.fieldAbility') }}</text>
                <view class="field-row__value">
                    <text :class="{ 'field-row__text--empty': !member.ability_id }">{{ abilityText }}</text>
                    <chevron-icon />
                </view>
            </view>

            <view class="field-row" @click="openSheet('item')">
                <text class="field-row__label">{{ t('teams.fieldItem') }}</text>
                <view class="field-row__value">
                    <text :class="{ 'field-row__text--empty': !member.item_id }">{{ itemText }}</text>
                    <chevron-icon />
                </view>
            </view>

            <view class="field-row" @click="openSheet('nature')">
                <text class="field-row__label">{{ t('teams.fieldNature') }}</text>
                <view class="field-row__value">
                    <text>{{ natureText }}</text>
                    <chevron-icon />
                </view>
            </view>

            <view class="moves-block">
                <view class="moves-block__head">
                    <text class="field-row__label">{{ t('teams.fieldMoves') }}</text>
                    <text class="moves-block__count">{{ member.moves.length }}/4</text>
                </view>
                <view class="moves-block__chips">
                    <SelectedMoveChip
                        v-for="m in member.moves"
                        :key="m"
                        :move-id="m"
                        :type="typeOfMove(m)"
                        removable
                        @remove="removeMove(m)"
                    />
                    <view v-if="member.moves.length < 4" class="moves-block__add" @click="openSheet('moves')">
                        <!-- #ifdef MP-WEIXIN -->
                        <text class="ic text-[14px]">{{ glyph('plus') }}</text>
                        <!-- #endif -->
                        <!-- #ifndef MP-WEIXIN -->
                        <svg data-ic="plus" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" class="h-3.5 w-3.5"><path d="M12 5v14M5 12h14"></path></svg>
                        <!-- #endif -->
                        <text>{{ t('teams.fieldMoves') }}</text>
                    </view>
                </view>
            </view>

            <view class="spread-block">
                <text class="field-row__label">{{ t('teams.fieldSpread') }}</text>
                <SpreadEditor :model-value="member.spread" @update:model-value="(s: TeamSpread) => update({ spread: s })" />
            </view>
        </view>

        <!-- 特性 -->
        <OptionSheet
            :visible="sheet === 'ability'"
            :title="t('teams.fieldAbility')"
            :options="abilityOptions"
            :model-value="member.ability_id ? String(member.ability_id) : ''"
            @update:visible="onSheetVisible"
            @update:model-value="(id) => update({ ability_id: Number(id) })"
        />
        <!-- 道具 -->
        <OptionSheet
            :visible="sheet === 'item'"
            :title="t('teams.fieldItem')"
            :options="itemOptions"
            :model-value="member.item_id ? String(member.item_id) : '0'"
            @update:visible="onSheetVisible"
            @update:model-value="onPickItem"
        />
        <!-- 性格 -->
        <OptionSheet
            :visible="sheet === 'nature'"
            :title="t('teams.fieldNature')"
            :options="natureOptions"
            :model-value="member.nature"
            :search-threshold="22"
            @update:visible="onSheetVisible"
            @update:model-value="(slug) => update({ nature: slug as string })"
        />
        <!-- 招式 -->
        <OptionSheet
            multi
            :max="MAX_MOVES"
            :visible="sheet === 'moves'"
            :title="t('teams.fieldMoves')"
            :options="moveOptions"
            :model-value="member.moves.map(String)"
            @update:visible="onSheetVisible"
            @update:model-value="onPickMoves"
        />
    </view>
</template>

<script lang="ts" setup>
import { computed, ref, shallowRef, watch, h } from 'vue';
import { hostPlatform } from '@/infra/platform/host';
import { useI18n } from 'vue-i18n';
import EncryptedSprite from '@/components/sprite/EncryptedSprite.vue';
import OptionSheet, { type SheetOption } from '@/components/shared/OptionSheet.vue';
import SpreadEditor from '@/components/teams/SpreadEditor.vue';
import SelectedMoveChip from '@/components/teams/SelectedMoveChip.vue';
import { useI18nStore } from '@/store/i18n';
import { usePokemonStore } from '@/store/pokemon';
import {
    loadAbilityIdsForForm,
    loadMovePoolForForm,
    type AbilityIds,
} from '@/services/teams/member-options';
import { buildPopularPatch } from '@/services/teams/popular';
import { CHAMPION_ALIGNMENTS } from '@/pages/statcalc/statcalc-options';
import { LIMITS, type TeamSpread, type TeamMember, type TeamFormat } from '@/services/teams/team-model';
import { glyph } from '@/components/icon/glyphs';

type Alignment = (typeof CHAMPION_ALIGNMENTS)[number];
type SheetKind = '' | 'ability' | 'item' | 'nature' | 'moves';

const props = defineProps<{
    member: TeamMember;
    format: TeamFormat;
}>();
const emit = defineEmits<{
    change: [member: TeamMember];
    remove: [];
}>();

const { t } = useI18n();
const i18nStore = useI18nStore();
const pokemonStore = usePokemonStore();

const MAX_MOVES = LIMITS.maxMoves;

const expanded = ref(false);
const sheet = ref<SheetKind>('');
const popularBusy = ref(false);

const formId = computed(() => props.member.form_id ?? props.member.species_id);

// ── 选项数据（按形态懒加载，缓存在 service 模块） ──
const pool = shallowRef<MoveRecord[]>([]);
const abilityIds = shallowRef<AbilityIds>({ ability1: null, ability2: null, hidden: null });
let loadedFor: number | null = null;

async function ensureOptions(id: number): Promise<void> {
    if (loadedFor === id) return;
    loadedFor = id;
    pool.value = [];
    abilityIds.value = { ability1: null, ability2: null, hidden: null };
    try {
        const [moves, abilities] = await Promise.all([
            loadMovePoolForForm(id),
            loadAbilityIdsForForm(id),
        ]);
        if (loadedFor !== id) return; // 期间已切形态
        pool.value = moves;
        abilityIds.value = abilities;
    } catch {
        if (loadedFor === id) loadedFor = null; // 允许下次重试
    }
}

watch(expanded, (open) => {
    if (open) void ensureOptions(formId.value);
});
watch(formId, (id) => {
    loadedFor = null;
    if (expanded.value) void ensureOptions(id);
});

function toggle(): void {
    expanded.value = !expanded.value;
}
function openSheet(kind: Exclude<SheetKind, ''>): void {
    sheet.value = kind;
}
function onSheetVisible(v: boolean): void {
    if (!v) sheet.value = '';
}

function update(patch: Partial<TeamMember>): void {
    emit('change', { ...props.member, ...patch });
}

async function applyPopular(): Promise<void> {
    popularBusy.value = true;
    try {
        const patch = await buildPopularPatch(props.member.species_id, props.format);
        if (patch) update(patch);
        else uni.showToast({ title: t('teams.popularUnavailable'), icon: 'none' });
    } catch {
        uni.showToast({ title: t('teams.errorGeneric'), icon: 'none' });
    } finally {
        popularBusy.value = false;
    }
}

// ── 展示文本 ──
const displayName = computed(
    () => i18nStore.speciesName(props.member.species_id) ?? `#${props.member.species_id}`,
);
const formText = computed(
    () => (props.member.form_id ? i18nStore.formLabel(props.member.form_id) : null) ?? '',
);
const speciesModel = computed(() => pokemonStore.getById(formId.value));

const abilityText = computed(() =>
    props.member.ability_id ? i18nStore.abilityName(props.member.ability_id) : t('teams.none'),
);
const itemText = computed(() =>
    props.member.item_id ? i18nStore.itemName(props.member.item_id) : t('teams.none'),
);
const natureText = computed(() => {
    const align = CHAMPION_ALIGNMENTS.find((a) => a.slug === props.member.nature);
    return align ? i18nStore.natureName(align.pokeId) ?? cap(align.slug) : t('teams.none');
});

const collapsedSummary = computed(() => {
    const parts: string[] = [natureText.value];
    if (props.member.ability_id) parts.push(i18nStore.abilityName(props.member.ability_id) ?? '');
    if (props.member.item_id) parts.push(i18nStore.itemName(props.member.item_id) ?? '');
    return parts.filter(Boolean).join(' · ');
});

function typeOfMove(id: number): string | undefined {
    return pool.value.find((r) => r.id === id)?.type;
}
function removeMove(id: number): void {
    update({ moves: props.member.moves.filter((m) => m !== id) });
}

// ── sheet 选项 ──
const abilityOptions = computed<SheetOption[]>(() => {
    const a = abilityIds.value;
    const out: SheetOption[] = [];
    const push = (id: number | null, hidden = false) => {
        if (id === null) return;
        out.push({
            id: String(id),
            label: i18nStore.abilityName(id) ?? `#${id}`,
            ...(hidden ? { subtitle: t('teams.hidden') } : {}),
        });
    };
    push(a.ability1);
    push(a.ability2);
    push(a.hidden, true);
    return out;
});

const itemOptions = computed<SheetOption[]>(() => [
    { id: '0', label: t('teams.none') },
    ...[...(i18nStore.lookup?.items.keys() ?? [])]
        .toSorted((a, b) => a - b)
        .map((id) => ({ id: String(id), label: i18nStore.itemName(id) ?? `#${id}` })),
]);

function onPickItem(id: string | string[]): void {
    const value = typeof id === 'string' ? id : '';
    update({ item_id: value === '0' ? undefined : Number(value) });
}

function natureSubtitle(mods: Alignment['mods']): string | undefined {
    let up: string | undefined;
    let down: string | undefined;
    for (const [key, val] of Object.entries(mods)) {
        if (val === 110) up = key;
        if (val === 90) down = key;
    }
    const parts: string[] = [];
    if (up) parts.push(`${t(`teams.sp.${up}`)}↑`);
    if (down) parts.push(`${t(`teams.sp.${down}`)}↓`);
    return parts.length ? parts.join(' · ') : undefined;
}

const natureOptions = computed<SheetOption[]>(() =>
    CHAMPION_ALIGNMENTS.map((a) => ({
        id: a.slug,
        label: i18nStore.natureName(a.pokeId) ?? cap(a.slug),
        subtitle: natureSubtitle(a.mods),
    })),
);

const METHOD_LABEL: Record<MoveRecord['learnMethod'], string> = {
    'level-up': 'Lv',
    machine: '机器',
    egg: '蛋',
    tutor: '教授',
};

const moveOptions = computed<SheetOption[]>(() =>
    pool.value.map((r) => {
        const typeName = i18nStore.typeName(r.type) ?? r.type;
        const method =
            r.learnMethod === 'level-up'
                ? r.level
                    ? `Lv${r.level}`
                    : METHOD_LABEL['level-up']
                : METHOD_LABEL[r.learnMethod];
        return {
            id: String(r.id),
            label: i18nStore.moveName(r.id) ?? `#${r.id}`,
            ...(typeof r.power === 'number' ? { trailing: String(r.power) } : {}),
            subtitle: `${typeName} · ${method}`,
        };
    }),
);

function onPickMoves(ids: string | string[]): void {
    const list = Array.isArray(ids) ? ids : [];
    const moves = [...new Set(list.map(Number).filter((n) => Number.isInteger(n) && n > 0))].slice(
        0,
        MAX_MOVES,
    );
    update({ moves });
}

const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

// 行内右箭头（纯渲染小组件，就地 h() 避免多一个文件）。
// script 不参与条件编译（模板里的 #ifdef 在 .ts 里不生效），故用 hostPlatform 分支；
// 非 mp 走 svg，glyph() 只在 mp 分支被调用。
const ChevronIcon = () =>
    hostPlatform === 'mp-weixin'
        ? h('text', { class: 'ic text-[16px] text-[#c4c7cf]' }, glyph('chevron-right'))
        : h(
              'svg',
              {
                  viewBox: '0 0 24 24',
                  fill: 'none',
                  stroke: 'currentColor',
                  'stroke-width': '2.6',
                  'stroke-linecap': 'round',
                  'stroke-linejoin': 'round',
                  class: 'field-row__chevron h-4 w-4',
              },
              [h('path', { d: 'm9 18 6-6-6-6' })],
          );
</script>

<style lang="scss" scoped>
.member-card {
    border: 1px solid #e8eaf0;
    border-radius: 18px;
    background: #ffffff;
    box-shadow: 0 10px 24px rgba(48, 55, 72, 0.05);
    overflow: hidden;
}

.member-card__head {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px;
}

.member-card__main {
    flex: 1;
    min-width: 0;
}

.member-card__name {
    font-size: 15px;
    font-weight: 800;
    color: #24262b;
}

.member-card__form {
    overflow: hidden;
    font-size: 11px;
    font-weight: 700;
    color: #9aa0ab;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.member-card__meta {
    display: block;
    margin-top: 2px;
    overflow: hidden;
    font-size: 11px;
    font-weight: 700;
    color: #9aa0ab;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.member-card__ops {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    gap: 10px;
}

.member-card__trash {
    display: flex;
    color: #c0c4cc;

    &:active {
        color: #e04f47;
    }
}

.chevron {
    color: #c4c7cf;
    transition: transform 0.2s ease;
}

.chevron--open {
    transform: rotate(180deg);
}

.member-card__body {
    padding: 4px 14px 14px;
    border-top: 1px solid #f1f2f6;
}

.popular-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    height: 40px;
    margin: 8px 0;
    border: 1px solid #e8eaf0;
    border-radius: 12px;
    background: #fafbfd;
    color: #6f7682;
    font-size: 13px;
    font-weight: 800;

    &::after {
        border: none !important;
    }

    &:active {
        background: #f2f3f7;
    }
}

.field-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: 44px;
}

.field-row + .field-row {
    border-top: 1px solid #f6f7fa;
}

.field-row__label {
    font-size: 13px;
    font-weight: 700;
    color: #6f7682;
}

.field-row__value {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    font-weight: 700;
    color: #24262b;
}

.field-row__text--empty {
    color: #b0b5bf;
}

.field-row__chevron {
    color: #c4c7cf;
}

.moves-block {
    padding: 10px 0;
    border-top: 1px solid #f6f7fa;
}

.moves-block__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
}

.moves-block__count {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 11px;
    font-weight: 800;
    color: #b0b5bf;
}

.moves-block__chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
}

.moves-block__add {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 10px;
    border: 1px dashed #c9ced8;
    border-radius: 10px;
    color: #6f7682;
    font-size: 12px;
    font-weight: 700;
}

.spread-block {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding-top: 10px;
    border-top: 1px solid #f6f7fa;
}
</style>
