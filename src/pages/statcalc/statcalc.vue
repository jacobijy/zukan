<template>
    <view
        class="statcalc-page min-h-screen page-bg"
        :style="{ paddingTop: 'var(--status-bar-height)', paddingBottom: '40px' }"
    >
        <DetailNavbar :title="t('statcalc.title')" @back="goBack" />

        <scroll-view
            scroll-y
            class="relative z-10 h-[calc(100vh-var(--status-bar-height))] mt-[calc(var(--status-bar-height)+52px)] px-4 pb-6"
        >
            <view class="mx-auto max-w-[720px] flex flex-col gap-3 pt-3">
                <!-- 宝可梦 / 等级 / 性格 -->
                <CalcCard :title="t('statcalc.pokemon')" iconClass="calc-head__icon--green">
                    <template #icon>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4">
                            <circle cx="12" cy="8" r="4"></circle>
                            <path d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6"></path>
                        </svg>
                    </template>

                    <view class="sc-row" @click="showPokemonPicker">
                        <view v-if="!selected" class="sc-row__main">
                            <text class="sc-placeholder">{{ t('statcalc.selectPokemon') }}</text>
                        </view>
                        <view v-else class="sc-row__main">
                            <view class="flex items-center gap-2">
                                <text class="sc-name">{{ selected.name }}</text>
                                <TypeBadge v-for="ty in selected.types" :key="ty" :type="ty" size="xs" variant="chip" />
                            </view>
                            <text class="sc-sub">NO.{{ String(selected.id).padStart(3, '0') }}</text>
                        </view>
                        <svg viewBox="0 0 24 24" fill="none" stroke="#c4c7cf" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5 flex-shrink-0">
                            <polyline points="9 18 15 12 9 6"></polyline>
                        </svg>
                    </view>

                    <view class="sc-divider"></view>

                    <view class="sc-row">
                        <text class="sc-row__label">{{ t('statcalc.level') }}</text>
                        <LevelStepper v-model="level" :min="1" :max="100" label="Lv" />
                    </view>

                    <view class="sc-divider"></view>

                    <view class="sc-row" @click="natureSheetOpen = true">
                        <text class="sc-row__label">{{ t('statcalc.nature') }}</text>
                        <view class="sc-row__value">
                            <text class="sc-value-text">{{ currentNatureName }}</text>
                            <svg viewBox="0 0 24 24" fill="none" stroke="#c4c7cf" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5 flex-shrink-0">
                                <polyline points="9 18 15 12 9 6"></polyline>
                            </svg>
                        </view>
                    </view>
                </CalcCard>

                <!-- 个体值 / 努力值 / 结果 -->
                <CalcCard :title="t('statcalc.statsCard')" iconClass="calc-head__icon--violet">
                    <template #icon>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4">
                            <path d="M4 19V5M8.5 19v-6M13 19V8M17.5 19v-9M3.5 19h17"></path>
                        </svg>
                    </template>

                    <view v-if="!selected" class="sc-empty">
                        <text class="sc-placeholder">{{ t('statcalc.emptyHint') }}</text>
                    </view>

                    <template v-else>
                        <StatInputRow
                            v-for="(key, i) in STAT_KEYS"
                            :key="key"
                            :label="statLabel(key)"
                            :baseLabel="t('statcalc.base')"
                            :base="baseOf(key)"
                            :natureMod="natureModFor(natureId, key)"
                            :iv="ivs[key]"
                            :ev="evs[key]"
                            :evAtCap="evRowCap(key)"
                            :result="results[key]"
                            :class="{ 'sc-stat--divider': i > 0 }"
                            @update:iv="(v: number) => setIv(key, v)"
                            @update:ev="(v: number) => setEv(key, v)"
                        />

                        <view class="sc-divider"></view>
                        <view class="sc-footer">
                            <text class="sc-ev-total" :class="{ 'sc-ev-total--full': evTotal >= MAX_EV_TOTAL }">
                                {{ t('statcalc.evTotal', { used: evTotal, max: MAX_EV_TOTAL }) }}
                            </text>
                            <view class="sc-quick">
                                <view class="sc-chip" @click="setAllIv(31)">{{ t('statcalc.ivMax') }}</view>
                                <view class="sc-chip" @click="setAllIv(0)">{{ t('statcalc.ivZero') }}</view>
                                <view class="sc-chip" @click="clearEv">{{ t('statcalc.evClear') }}</view>
                            </view>
                        </view>
                    </template>
                </CalcCard>

                <button class="sc-reset" @click="resetAll">{{ t('common.reset') }}</button>
            </view>
        </scroll-view>

        <!-- 宝可梦选择 -->
        <OptionSheet
            v-model:visible="pokemonSheetOpen"
            :title="t('statcalc.pokemon')"
            :options="pokemonOptions"
            :model-value="selected ? String(selected.id) : ''"
            @update:model-value="onPokemonPick"
        />

        <!-- 性格选择 -->
        <OptionSheet
            v-model:visible="natureSheetOpen"
            :title="t('statcalc.nature')"
            :options="natureOptions"
            :model-value="String(natureId)"
            @update:model-value="onNaturePick"
        />
    </view>
</template>

<script lang="ts" setup>
import { ref, reactive, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { usePokemonStore } from '@/store/pokemon';
import { useI18nStore } from '@/store/i18n';
import CalcCard from '@/components/calc/CalcCard.vue';
import LevelStepper from '@/components/calc/LevelStepper.vue';
import StatInputRow from '@/components/calc/StatInputRow.vue';
import DetailNavbar from '@/components/shared/DetailNavbar.vue';
import OptionSheet, { type SheetOption } from '@/components/shared/OptionSheet.vue';
import TypeBadge from '@/components/pokemon/TypeBadge.vue';
import {
    STAT_KEYS,
    NATURES,
    natureModFor,
    type NatureDef,
} from './statcalc-options';
import {
    calcStat,
    getBaseStat,
    clampIv,
    clampEv,
    MAX_EV_TOTAL,
    MAX_EV_PER_STAT,
    type StatKey,
} from './statcalc-engine';

const { t } = useI18n();
const pokemonStore = usePokemonStore();
const i18nStore = useI18nStore();
// 性格名走 i18n 内容 bundle（与招式/特性同一套）；深链进入时 boot 可能未跑完，确保加载后选项响应式刷新。
void i18nStore.ensureLoaded();

/** 性格显示名：内容 bundle 本地化名 → 英文 slug 回落 */
const natureLabel = (n: NatureDef): string =>
    i18nStore.natureName(n.pokeId) ?? n.slug.charAt(0).toUpperCase() + n.slug.slice(1);

interface SelectedMon {
    id: number;
    name: string;
    types: string[];
    stats: { name: string; value: number }[];
}

const selected = ref<SelectedMon | null>(null);
const level = ref(50);
const natureId = ref(0);

const ivs = reactive<Record<StatKey, number>>({ hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 });
const evs = reactive<Record<StatKey, number>>({ hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 });

// ── 宝可梦选择 ──
const pokemonSheetOpen = ref(false);
const pokemonOptions = computed<SheetOption[]>(() =>
    pokemonStore.allPokemons.map((p) => ({
        id: String(p.id),
        label: p.name,
        subtitle: `NO.${String(p.id).padStart(3, '0')}`,
    })),
);

const showPokemonPicker = () => {
    if (pokemonOptions.value.length === 0) {
        uni.showToast({ title: t('statcalc.toast.noData'), icon: 'none' });
        return;
    }
    pokemonSheetOpen.value = true;
};

const onPokemonPick = (value: string | string[]) => {
    const idStr = Array.isArray(value) ? value[0] : value;
    const pkm = pokemonStore.allPokemons.find((p) => String(p.id) === idStr);
    if (!pkm) return;
    selected.value = { id: pkm.id, name: pkm.name, types: pkm.types, stats: pkm.stats };
};

// ── 性格选择 ──
const natureSheetOpen = ref(false);

const statLabel = (key: StatKey) => t(`statcalc.stats.${key}`);

const natureOptions = computed<SheetOption[]>(() =>
    NATURES.map((n) => ({
        id: String(n.id),
        label: natureLabel(n),
        subtitle: natureSubtitle(n),
    })),
);

function natureSubtitle(n: NatureDef): string {
    const up = (Object.entries(n.mods) as [StatKey, number][]).find(([, m]) => m === 110);
    const down = (Object.entries(n.mods) as [StatKey, number][]).find(([, m]) => m === 90);
    if (!up || !down) return t('statcalc.neutral');
    return `${statLabel(up[0])}↑ · ${statLabel(down[0])}↓`;
}

const currentNatureName = computed(() => {
    const n = NATURES.find((x) => x.id === natureId.value) ?? NATURES[0];
    return natureLabel(n);
});

const onNaturePick = (value: string | string[]) => {
    const idStr = Array.isArray(value) ? value[0] : value;
    natureId.value = Number(idStr) || 0;
};

// ── 能力值计算 ──
const baseOf = (key: StatKey) => (selected.value ? getBaseStat(selected.value.stats, key) : 0);

const results = computed<Record<StatKey, number>>(() => {
    const out = {} as Record<StatKey, number>;
    if (!selected.value) return out;
    for (const key of STAT_KEYS) {
        out[key] = calcStat(
            key,
            getBaseStat(selected.value.stats, key),
            level.value,
            ivs[key],
            evs[key],
            natureModFor(natureId.value, key),
        );
    }
    return out;
});

// ── IV / EV 编辑 ──
const setIv = (key: StatKey, v: number) => {
    ivs[key] = clampIv(v);
};

const evTotal = computed(() => STAT_KEYS.reduce((sum, k) => sum + evs[k], 0));

const setEv = (key: StatKey, raw: number) => {
    let allowed = clampEv(raw);
    const others = evTotal.value - evs[key];
    if (others + allowed > MAX_EV_TOTAL) allowed = MAX_EV_TOTAL - others;
    // EV 只在 4 的倍数上影响能力值，对齐到 4
    allowed = Math.max(0, allowed - (allowed % 4));
    evs[key] = allowed;
};

const evRowCap = (key: StatKey) => evs[key] >= MAX_EV_PER_STAT || evTotal.value + 4 > MAX_EV_TOTAL;

const setAllIv = (v: number) => {
    for (const k of STAT_KEYS) ivs[k] = clampIv(v);
};

const clearEv = () => {
    for (const k of STAT_KEYS) evs[k] = 0;
};

const resetAll = () => {
    selected.value = null;
    level.value = 50;
    natureId.value = 0;
    setAllIv(31);
    clearEv();
};

const goBack = () => {
    // DetailNavbar 已处理返回导航
};
</script>

<style scoped>
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

.sc-reset {
    height: 46px;
    line-height: 46px;
    border-radius: 16px;
    background: #eef0f5;
    color: #6f7682;
    font-size: 15px;
    font-weight: 800;
}

.sc-reset::after {
    border: none !important;
}
</style>
