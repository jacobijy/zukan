<template>
    <view>
        <!-- 规则版本分段 -->
        <view class="sc-mode">
            <view
                class="sc-mode__seg"
                :class="{ 'sc-mode__seg--active': ruleset === 'standard' }"
                @click="setRuleset('standard')"
            >{{ t('statcalc.modeClassic') }}</view>
            <view
                class="sc-mode__seg"
                :class="{ 'sc-mode__seg--active': ruleset === 'champions' }"
                @click="setRuleset('champions')"
            >{{ t('statcalc.modeChampion') }}</view>
        </view>

        <!-- 宝可梦 / 等级 / 性格 -->
        <CalcCard :title="t('statcalc.pokemon')" iconClass="calc-head__icon--green">
            <template #icon>
                <!-- #ifdef MP-WEIXIN -->
                <text class="ic text-[16px]">{{ glyph('user') }}</text>
                <!-- #endif -->
                <!-- #ifndef MP-WEIXIN -->
                <svg data-ic="user" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4">
                    <circle cx="12" cy="8" r="4"></circle>
                    <path d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6"></path>
                </svg>
                <!-- #endif -->
            </template>

            <view class="sc-row" @click="openPokemonPicker(false)">
                <view v-if="!selected" class="sc-row__main">
                    <text class="sc-placeholder">{{ t('statcalc.selectPokemon') }}</text>
                </view>
                <view v-else class="sc-row__main">
                    <view class="flex items-center gap-2">
                        <text class="sc-name">{{ selected.name }}</text>
                        <TypeBadge v-for="ty in selected.types" :key="ty" :type="ty" size="xs" variant="chip" />
                    </view>
                    <text class="sc-sub">NO.{{ String(selected.id).padStart(3, '0') }}{{ selectedFormLabel ? ' · ' + selectedFormLabel : '' }}</text>
                </view>
                <view v-if="canSwitchForm" class="sc-form-switch" @click.stop="openPokemonPicker(true)">
                    <text class="sc-form-switch__text">{{ t('templates.formSwitch') }}</text>
                </view>
                <!-- #ifdef MP-WEIXIN -->
                <text class="ic text-[20px] text-[#c4c7cf] flex-shrink-0">{{ glyph('chevron-right') }}</text>
                <!-- #endif -->
                <!-- #ifndef MP-WEIXIN -->
                <svg data-ic="chevron-right" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5 flex-shrink-0">
                    <path d="m9 18 6-6-6-6"></path>
                </svg>
                <!-- #endif -->
            </view>

            <view class="sc-divider"></view>

            <view class="sc-row">
                <text class="sc-row__label">{{ t('statcalc.level') }}</text>
                <LevelStepper v-if="ruleset === 'standard'" v-model="level" :min="1" :max="100" label="Lv" />
                <text v-else class="sc-locked">Lv {{ CHAMPION_LEVEL }} · {{ t('statcalc.champLevelLock') }}</text>
            </view>

            <view class="sc-divider"></view>

            <view class="sc-row" @click="natureSheetOpen = true">
                <text class="sc-row__label">{{ ruleset === 'champions' ? t('statcalc.alignment') : t('statcalc.nature') }}</text>
                <view class="sc-row__value">
                    <text class="sc-value-text">{{ currentNatureName }}</text>
                    <!-- #ifdef MP-WEIXIN -->
                    <text class="ic text-[20px] text-[#c4c7cf] flex-shrink-0">{{ glyph('chevron-right') }}</text>
                    <!-- #endif -->
                    <!-- #ifndef MP-WEIXIN -->
                    <svg data-ic="chevron-right" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5 flex-shrink-0">
                        <path d="m9 18 6-6-6-6"></path>
                    </svg>
                    <!-- #endif -->
                </view>
            </view>
        </CalcCard>

        <!-- 六维输入 + 结果 -->
        <CalcCard :title="t('statcalc.statsCard')" iconClass="calc-head__icon--violet">
            <template #icon>
                <!-- #ifdef MP-WEIXIN -->
                <text class="ic text-[16px]">{{ glyph('bar-chart') }}</text>
                <!-- #endif -->
                <!-- #ifndef MP-WEIXIN -->
                <svg data-ic="bar-chart" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4">
                    <path d="M4 19V5"></path><path d="M8.5 19v-6"></path><path d="M13 19V8"></path><path d="M17.5 19v-9"></path><path d="M3.5 19h17"></path>
                </svg>
                <!-- #endif -->
            </template>

            <view v-if="!selected" class="sc-empty">
                <text class="sc-placeholder">{{ t('statcalc.emptyHint') }}</text>
            </view>

            <template v-else>
                <StatInputRow
                    v-for="(key, i) in STAT_KEYS"
                    :key="key"
                    :mode="mode"
                    :label="statLabel(key)"
                    :baseLabel="t('statcalc.base')"
                    :base="baseOf(key)"
                    :natureMod="currentMod(key)"
                    :iv="ivOf(key)"
                    :ev="evOf(key)"
                    :evAtCap="evRowCap(key)"
                    :sp="spOf(key)"
                    :spAtCap="spRowCap(key)"
                    :result="results[key]"
                    :class="{ 'sc-stat--divider': i > 0 }"
                    @update:iv="(v: number) => setIv(key, v)"
                    @update:ev="(v: number) => setEv(key, v)"
                    @update:sp="(v: number) => setSp(key, v)"
                />

                <view class="sc-divider"></view>
                <view class="sc-footer">
                    <text class="sc-ev-total" :class="{ 'sc-ev-total--full': pointsFull }">
                        {{ ruleset === 'champions'
                            ? interp('statcalc.spTotal', { used: spTotal, max: MAX_SP_TOTAL })
                            : interp('statcalc.evTotal', { used: evTotal, max: MAX_EV_TOTAL }) }}
                    </text>
                    <view class="sc-quick">
                        <template v-if="ruleset === 'standard'">
                            <view class="sc-chip" @click="setAllIv(31)">{{ t('statcalc.ivMax') }}</view>
                            <view class="sc-chip" @click="setAllIv(0)">{{ t('statcalc.ivZero') }}</view>
                            <view class="sc-chip" @click="clearEv">{{ t('statcalc.evClear') }}</view>
                        </template>
                        <view v-else class="sc-chip" @click="clearSp">{{ t('statcalc.spClear') }}</view>
                    </view>
                </view>
            </template>
        </CalcCard>

        <!-- 宝可梦 / 形态选择（两段式，同物种聚合） -->
        <PokemonPicker
            v-model:visible="pokemonPickerOpen"
            :title="t('statcalc.pokemon')"
            :form-title="t('templates.pickForm')"
            :search-placeholder="t('templates.pickerSearch')"
            :active-pokemon-id="quickFormId"
            @pick="onPokemonPicked"
        />

        <!-- 性格 / Stat Alignment 选择 -->
        <OptionSheet
            v-model:visible="natureSheetOpen"
            :title="ruleset === 'champions' ? t('statcalc.alignment') : t('statcalc.nature')"
            :options="natureOptions"
            :model-value="currentNatureValue"
            @update:model-value="onNaturePick"
        />
    </view>
</template>

<script lang="ts" setup>
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { interp } from '@/services/i18n/ui-i18n';
import { glyph } from '@/components/icon/glyphs';
import { usePokemonStore } from '@/store/pokemon';
import { useI18nStore } from '@/store/i18n';
import CalcCard from '@/components/calc/CalcCard.vue';
import LevelStepper from '@/components/calc/LevelStepper.vue';
import StatInputRow from '@/components/calc/StatInputRow.vue';
import OptionSheet, { type SheetOption } from '@/components/shared/OptionSheet.vue';
import PokemonPicker from '@/components/shared/PokemonPicker.vue';
import TypeBadge from '@/components/pokemon/TypeBadge.vue';
import {
    STAT_KEYS,
    NATURES,
    CHAMPION_ALIGNMENTS,
    natureModFor,
    champAlignmentMod,
    getChampAlignment,
    DEFAULT_CHAMP_ALIGNMENT_ID,
} from '@/pages/statcalc/statcalc-options';
import {
    calcStat,
    calcChampStat,
    getBaseStat,
    clampIv,
    clampEv,
    clampSp,
    MAX_EV_TOTAL,
    MAX_EV_PER_STAT,
    MAX_SP_TOTAL,
    MAX_SP_PER_STAT,
    CHAMPION_LEVEL,
    type StatKey,
} from '@/pages/statcalc/statcalc-engine';
import {
    emptyTemplate,
    switchRuleset,
    naturePokeIdFromInternal,
    natureInternalFromPokeId,
    isNaturePokeIdValid,
    type Ruleset,
    type StandardTemplate,
    type ChampionsTemplate,
    type TemplatePayload,
} from '@/services/templates/template-model';

const props = defineProps<{
    /** 当前配置；null = 未选择宝可梦（编辑中） */
    modelValue: TemplatePayload | null;
    /** 预览等级（仅标准版使用；默认 50，不持久化） */
    level?: number;
}>();
const emit = defineEmits<{
    (e: 'update:modelValue', value: TemplatePayload | null): void;
    (e: 'update:level', value: number): void;
}>();

const { t } = useI18n();
const pokemonStore = usePokemonStore();
const i18nStore = useI18nStore();
// 性格/倾向名走 i18n 内容 bundle；深链进入时 boot 可能未跑完，确保加载后选项响应式刷新。
void i18nStore.ensureLoaded();

const ruleset = computed<Ruleset>(() => props.modelValue?.ruleset ?? 'standard');
const mode = computed(() => (ruleset.value === 'champions' ? 'champion' : 'classic'));

const level = computed({
    get: () => props.level ?? 50,
    set: (v: number) => emit('update:level', v),
});

interface SelectedMon {
    id: number;
    name: string;
    types: string[];
    stats: { name: string; value: number }[];
    formLabel?: string;
}

const selected = computed<SelectedMon | null>(() => {
    const id = props.modelValue?.pokemon_id;
    if (!id) return null;
    const pkm = pokemonStore.getById(id);
    if (!pkm) return null;
    return { id: pkm.id, name: pkm.name, types: pkm.types, stats: pkm.stats, formLabel: pkm.formLabel };
});

const selectedFormLabel = computed(() => selected.value?.formLabel ?? '');

function setRuleset(r: Ruleset): void {
    if (r === ruleset.value) return;
    if (!props.modelValue) {
        emit('update:modelValue', emptyTemplate(r));
        return;
    }
    emit('update:modelValue', switchRuleset(props.modelValue, r));
}

// ── 宝可梦 / 形态选择（两段式，同物种聚合） ──
const pokemonPickerOpen = ref(false);
/** 快捷切换形态：打开时直接定位到当前宝可梦的形态步 */
const quickFormId = ref<number | undefined>(undefined);

const openPokemonPicker = (quick: boolean) => {
    if (pokemonStore.allPokemons.length === 0) {
        uni.showToast({ title: t('statcalc.toast.noData'), icon: 'none' });
        return;
    }
    quickFormId.value = quick ? props.modelValue?.pokemon_id : undefined;
    pokemonPickerOpen.value = true;
};

const onPokemonPicked = (speciesId: number, formId?: number) => {
    const id = formId ?? speciesId;
    // 未选宝可梦时：用默认结构起一个配置，再写入 pokemon_id
    const base = props.modelValue ?? emptyTemplate(ruleset.value);
    emit('update:modelValue', { ...base, pokemon_id: id });
};

/** 当前物种是否存在多个形态（决定是否显示「切换形态」入口） */
const canSwitchForm = computed(() => {
    const id = props.modelValue?.pokemon_id;
    if (!id) return false;
    const pkm = pokemonStore.getById(id);
    if (!pkm) return false;
    return pokemonStore.getFormsBySpecies(pkm.speciesId ?? pkm.id).length > 1;
});

// ── 性格 / Stat Alignment ──
const natureSheetOpen = ref(false);

const natureInternal = computed(() =>
    natureInternalFromPokeId(props.modelValue?.nature ?? 0, ruleset.value),
);

const statLabel = (key: StatKey) => t(`statcalc.stats.${key}`);

/** 名称统一走内容 bundle，缺失回落英文 slug */
const nameOf = (x: { pokeId: number; slug: string }) =>
    i18nStore.natureName(x.pokeId) ?? x.slug.charAt(0).toUpperCase() + x.slug.slice(1);

function subtitleOf(mods: Partial<Record<StatKey, number>>): string {
    const up = (Object.entries(mods) as [StatKey, number][]).find(([, m]) => m === 110);
    const down = (Object.entries(mods) as [StatKey, number][]).find(([, m]) => m === 90);
    if (!up || !down) return t('statcalc.neutral');
    return `${statLabel(up[0])}↑ · ${statLabel(down[0])}↓`;
}

const natureOptions = computed<SheetOption[]>(() => {
    if (ruleset.value === 'champions') {
        return CHAMPION_ALIGNMENTS.map((a) => ({
            id: String(a.id),
            label: nameOf(a),
            subtitle: subtitleOf(a.mods),
        }));
    }
    return NATURES.map((n) => ({ id: String(n.id), label: nameOf(n), subtitle: subtitleOf(n.mods) }));
});

const currentNatureValue = computed(() =>
    ruleset.value === 'champions' ? String(natureInternal.value) : String(natureInternal.value),
);

const currentNatureName = computed(() => {
    if (ruleset.value === 'champions') return nameOf(getChampAlignment(natureInternal.value));
    return nameOf(NATURES.find((n) => n.id === natureInternal.value) ?? NATURES[0]);
});

const onNaturePick = (value: string | string[]) => {
    const idStr = Array.isArray(value) ? value[0] : value;
    const id = Number(idStr) || 0;
    if (!props.modelValue) return;
    const nature = naturePokeIdFromInternal(id, ruleset.value);
    if (isNaturePokeIdValid(nature, ruleset.value)) {
        emit('update:modelValue', { ...props.modelValue, nature });
    }
};

// ── 能力值计算 ──
const baseOf = (key: StatKey) => (selected.value ? getBaseStat(selected.value.stats, key) : 0);

const currentMod = (key: StatKey) =>
    ruleset.value === 'champions'
        ? champAlignmentMod(natureInternal.value, key)
        : natureModFor(natureInternal.value, key);

const ivOf = (key: StatKey) => (asStandard(props.modelValue)?.ivs[key] ?? 31);
const evOf = (key: StatKey) => (asStandard(props.modelValue)?.evs[key] ?? 0);
const spOf = (key: StatKey) => (asChampions(props.modelValue)?.sp[key] ?? 0);

function asStandard(p: TemplatePayload | null): StandardTemplate | null {
    return p && p.ruleset === 'standard' ? p : null;
}
function asChampions(p: TemplatePayload | null): ChampionsTemplate | null {
    return p && p.ruleset === 'champions' ? p : null;
}

const results = computed<Record<StatKey, number>>(() => {
    const out = {} as Record<StatKey, number>;
    if (!selected.value) return out;
    for (const key of STAT_KEYS) {
        const base = getBaseStat(selected.value.stats, key);
        out[key] =
            ruleset.value === 'champions'
                ? calcChampStat(key, base, spOf(key), champAlignmentMod(natureInternal.value, key))
                : calcStat(key, base, level.value, ivOf(key), evOf(key), natureModFor(natureInternal.value, key));
    }
    return out;
});

// ── IV / EV 编辑（标准版） ──
const setIv = (key: StatKey, v: number) => {
    const p = asStandard(props.modelValue);
    if (!p) return;
    emit('update:modelValue', { ...p, ivs: { ...p.ivs, [key]: clampIv(v) } });
};

const evTotal = computed(() =>
    STAT_KEYS.reduce((sum, k) => sum + (asStandard(props.modelValue)?.evs[k] ?? 0), 0),
);

const setEv = (key: StatKey, raw: number) => {
    const p = asStandard(props.modelValue);
    if (!p) return;
    let allowed = clampEv(raw);
    const others = evTotal.value - p.evs[key];
    if (others + allowed > MAX_EV_TOTAL) allowed = MAX_EV_TOTAL - others;
    // EV 只在 4 的倍数上影响能力值，对齐到 4
    allowed = Math.max(0, allowed - (allowed % 4));
    emit('update:modelValue', { ...p, evs: { ...p.evs, [key]: allowed } });
};

const evRowCap = (key: StatKey) =>
    evTotal.value >= MAX_EV_TOTAL || (asStandard(props.modelValue)?.evs[key] ?? 0) >= MAX_EV_PER_STAT;

const setAllIv = (v: number) => {
    const p = asStandard(props.modelValue);
    if (!p) return;
    const ivs = {} as Record<StatKey, number>;
    for (const k of STAT_KEYS) ivs[k] = clampIv(v);
    emit('update:modelValue', { ...p, ivs } as StandardTemplate);
};

const clearEv = () => {
    const p = asStandard(props.modelValue);
    if (!p) return;
    const evs = {} as Record<StatKey, number>;
    for (const k of STAT_KEYS) evs[k] = 0;
    emit('update:modelValue', { ...p, evs } as StandardTemplate);
};

// ── SP 编辑（Champions，1:1 加能力，总量 66 / 单项 32） ──
const spTotal = computed(() =>
    STAT_KEYS.reduce((sum, k) => sum + (asChampions(props.modelValue)?.sp[k] ?? 0), 0),
);
const pointsFull = computed(() =>
    ruleset.value === 'champions' ? spTotal.value >= MAX_SP_TOTAL : evTotal.value >= MAX_EV_TOTAL,
);

const setSp = (key: StatKey, raw: number) => {
    const p = asChampions(props.modelValue);
    if (!p) return;
    let allowed = clampSp(raw);
    const others = spTotal.value - p.sp[key];
    if (others + allowed > MAX_SP_TOTAL) allowed = MAX_SP_TOTAL - others;
    allowed = Math.max(0, allowed);
    emit('update:modelValue', { ...p, sp: { ...p.sp, [key]: allowed } });
};

const spRowCap = (key: StatKey) =>
    spTotal.value >= MAX_SP_TOTAL || (asChampions(props.modelValue)?.sp[key] ?? 0) >= MAX_SP_PER_STAT;

const clearSp = () => {
    const p = asChampions(props.modelValue);
    if (!p) return;
    const sp = {} as Record<StatKey, number>;
    for (const k of STAT_KEYS) sp[k] = 0;
    emit('update:modelValue', { ...p, sp } as ChampionsTemplate);
};
</script>

<style scoped>
.sc-mode {
    display: flex;
    gap: 4px;
    padding: 4px;
    border-radius: 14px;
    background: #eef0f5;
    margin-bottom: 12px;
}

.sc-mode__seg {
    flex: 1;
    text-align: center;
    padding: 9px 0;
    border-radius: 11px;
    font-size: 13px;
    font-weight: 800;
    color: #6f7682;
    transition: all 0.15s ease;
}

.sc-mode__seg--active {
    background: #ffffff;
    color: #24262b;
    box-shadow: 0 4px 12px rgba(48, 55, 72, 0.1);
}

.sc-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    min-height: 48px;
    padding: 6px 14px;
}

.sc-row__label {
    font-size: 14px;
    font-weight: 600;
    color: #24262b;
}

.sc-row__main {
    display: flex;
    flex-direction: column;
    gap: 1px;
    min-width: 0;
    flex: 1;
}

.sc-row__value {
    display: flex;
    align-items: center;
    gap: 4px;
}

.sc-name {
    font-size: 15px;
    font-weight: 800;
    color: #24262b;
}

.sc-sub {
    font-size: 11px;
    font-weight: 600;
    color: #b0b5bf;
}

.sc-value-text {
    font-size: 14px;
    font-weight: 700;
    color: #24262b;
}

.sc-form-switch {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    padding: 4px 10px;
    border: 1px solid #e1e4eb;
    border-radius: 999px;
    background: #f5f6fa;
}

.sc-form-switch__text {
    font-size: 11px;
    font-weight: 700;
    color: #6f7682;
}

.sc-locked {
    font-size: 13px;
    font-weight: 700;
    color: #9da2ad;
}

.sc-placeholder {
    font-size: 14px;
    font-weight: 600;
    color: #9da2ad;
}

.sc-divider {
    height: 1px;
    margin: 0 14px;
    background: #f1f2f6;
}

.sc-stat--divider {
    border-top: 1px solid #f5f6fa;
}

.sc-empty {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 88px;
    padding: 0 14px;
}

.sc-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 8px;
    padding: 10px 14px 12px;
}

.sc-ev-total {
    font-size: 12px;
    font-weight: 700;
    color: #6f7682;
}

.sc-ev-total--full {
    color: #d89a1e;
}

.sc-quick {
    display: flex;
    gap: 6px;
}

.sc-chip {
    padding: 5px 11px;
    border-radius: 999px;
    border: 1px solid #e1e4eb;
    background: #f5f6fa;
    color: #6f7682;
    font-size: 12px;
    font-weight: 700;
}
</style>
