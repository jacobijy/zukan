<template>
    <view class="calc-page min-h-screen page-bg" :style="{ paddingTop: 'var(--status-bar-height)', paddingBottom: '40px' }">
        <DetailNavbar title="伤害计算器" @back="goBack" />

        <scroll-view scroll-y class="relative z-10 h-[calc(100vh-var(--status-bar-height))] mt-[calc(var(--status-bar-height)+52px)] px-4 pb-6">
            <view class="mx-auto max-w-[720px] flex flex-col gap-3 pt-3">

                <!-- 攻击方 -->
                <CalcSideCard
                    title="攻击方"
                    iconClass="calc-head__icon--green"
                    placeholderText="选择攻击方"
                    :pokemon="attackerPokemon"
                    :level="attackerLevel"
                    :ability="attackerAbility"
                    stage1Label="物攻"
                    stage2Label="特攻"
                    :stage1Val="atkStage"
                    :stage2Val="spaStage"
                    @select-pokemon="showPokemonPicker('attacker')"
                    @select-ability="showAbilityPicker('attacker')"
                    @adjust-level="(d:number) => adjustLevel('attacker', d)"
                    @dec-stage1="decStage('atk')"
                    @inc-stage1="incStage('atk')"
                    @dec-stage2="decStage('spa')"
                    @inc-stage2="incStage('spa')"
                />

                <!-- 防御方 -->
                <CalcSideCard
                    title="防御方"
                    iconClass="calc-head__icon--blue"
                    placeholderText="选择防御方"
                    :pokemon="defenderPokemon"
                    :level="defenderLevel"
                    :ability="defenderAbility"
                    stage1Label="物防"
                    stage2Label="特防"
                    :stage1Val="defStage"
                    :stage2Val="spdStage"
                    @select-pokemon="showPokemonPicker('defender')"
                    @select-ability="showAbilityPicker('defender')"
                    @adjust-level="(d:number) => adjustLevel('defender', d)"
                    @dec-stage1="decStage('def')"
                    @inc-stage1="incStage('def')"
                    @dec-stage2="decStage('spd')"
                    @inc-stage2="incStage('spd')"
                />

                <!-- 招式 -->
                <CalcCard title="招式" iconClass="calc-head__icon--violet">
                    <template #icon>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4">
                            <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z"></path>
                        </svg>
                    </template>
                    <view class="calc-row p-3" @click="showMovePicker">
                        <view v-if="!selectedMove" class="calc-row__main items-center">
                            <text class="text-[#9da2ad] text-[14px] font-semibold">点击选择招式</text>
                        </view>
                        <view v-else class="calc-row__main">
                            <view class="flex items-center gap-2">
                                <text class="calc-pkm-name">{{ selectedMove.name }}</text>
                                <TypeBadge :type="selectedMove.type" size="xs" variant="chip" />
                                <text class="text-[12px] font-bold" :class="selectedMove.category === 'physical' ? 'text-[#e74c3c]' : 'text-[#3498db]'">{{ selectedMove.category === 'physical' ? '物理' : '特殊' }}</text>
                            </view>
                            <view class="flex items-center gap-3 mt-1">
                                <view class="flex items-center gap-1">
                                    <text class="text-[11px] font-bold text-[#9da2ad]">威力</text>
                                    <text class="text-[16px] font-black text-[#24262b]">{{ selectedMove.power }}</text>
                                </view>
                            </view>
                        </view>
                        <svg viewBox="0 0 24 24" fill="none" stroke="#c4c7cf" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5 flex-shrink-0"><polyline points="9 18 15 12 9 6"></polyline></svg>
                    </view>
                </CalcCard>

                <!-- 战场条件 -->
                <CalcCard title="战场条件" iconClass="calc-head__icon--gold">
                    <template #icon>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4">
                            <path d="M17.5 19a4.5 4.5 0 0 0 0-9 6 6 0 0 0-11.7 1.5A4 4 0 0 0 6 19z"></path>
                        </svg>
                    </template>

                    <ChipRow label="天气" :options="WEATHER_OPTIONS" v-model="selectedWeather" />
                    <view class="calc-divider"></view>
                    <ChipRow label="场地" :options="TERRAIN_OPTIONS" v-model="selectedTerrain" />
                    <view class="calc-divider"></view>
                    <ChipRow label="道具" :options="[]" v-model="selectedItem.name">
                        <template #extra>
                            <view class="calc-chip" :class="selectedItem.name !== '无' ? 'calc-chip--active' : ''" @click="showItemPicker">{{ selectedItem.name }}</view>
                        </template>
                    </ChipRow>
                    <view class="calc-divider"></view>
                    <ChipRow label="防护" :options="SCREEN_OPTIONS" v-model="reflectScreen" />
                    <view class="calc-divider"></view>
                    <ChipRow label="状态" :options="[]">
                        <template #extra>
                            <view class="calc-chip" :class="isBurned ? 'calc-chip--active--orange' : ''" @click="isBurned = !isBurned">烧伤</view>
                            <view class="calc-chip" :class="isCritical ? 'calc-chip--active--red' : ''" @click="isCritical = !isCritical">会心</view>
                        </template>
                    </ChipRow>
                </CalcCard>

                <!-- 结果 -->
                <DamageResultCard :result="result" />

                <view class="flex gap-2">
                    <button class="calc-action flex-1" @click="doCalculate" :disabled="calculating">
                        {{ calculating ? '计算中…' : '开始计算' }}
                    </button>
                    <button class="calc-action calc-action--reset" @click="resetAll">重置</button>
                </view>
            </view>
        </scroll-view>
    </view>
</template>

<script lang="ts" setup>
import { ref, computed } from 'vue';
import { calcDamage, calcStat, getBaseStat, type CalcResult, type CalcParams, MOVE_FLAG } from './calc-engine';
import { usePokemonStore } from '@/store/pokemon';
import CalcSideCard from '@/components/calc/CalcSideCard.vue';
import CalcCard from '@/components/calc/CalcCard.vue';
import ChipRow from '@/components/calc/ChipRow.vue';
import DamageResultCard from '@/components/calc/DamageResultCard.vue';
import DetailNavbar from '@/components/shared/DetailNavbar.vue';
import TypeBadge from '@/components/pokemon/TypeBadge.vue';
import { getTypeShort } from '@/constants/pokemonTypes';
import {
    WEATHER_OPTIONS, TERRAIN_OPTIONS, COMMON_ABILITIES,
    COMMON_MOVES, ITEM_OPTIONS, SCREEN_OPTIONS,
    getAbilityName,
    type MoveOption, type ItemOption,
} from './calc-options';

const pokemonStore = usePokemonStore();

// ==============================
// 宝可梦选择
// ==============================

const attackerPokemon = ref<{ name: string; types: string[]; stats: { name: string; value: number }[] } | null>(null);
const defenderPokemon = ref<{ name: string; types: string[]; stats: { name: string; value: number }[] } | null>(null);

const pokemonNameList = computed(() => pokemonStore.allPokemons.map(p => p.name));

const showPokemonPicker = (side: 'attacker' | 'defender') => {
    const names = pokemonNameList.value;
    if (names.length === 0) {
        uni.showToast({ title: '暂无宝可梦数据', icon: 'none' });
        return;
    }
    uni.showActionSheet({
        itemList: names,
        success: (res) => {
            const pkm = pokemonStore.allPokemons[res.tapIndex];
            if (!pkm) return;
            const data = { name: pkm.name, types: pkm.types, stats: pkm.stats };
            if (side === 'attacker') attackerPokemon.value = data;
            else defenderPokemon.value = data;
        }
    });
};

// ==============================
// 等级
// ==============================
const attackerLevel = ref(50);
const defenderLevel = ref(50);

const adjustLevel = (side: 'attacker' | 'defender', delta: number) => {
    const target = side === 'attacker' ? attackerLevel : defenderLevel;
    const next = target.value + delta;
    if (next >= 1 && next <= 100) target.value = next;
};

// ==============================
// 战场条件 v-model 状态
// ==============================
const selectedWeather = ref('');
const selectedTerrain = ref('');

// ==============================
// 特性
// ==============================
const attackerAbility = ref('无');
const defenderAbility = ref('无');

const showAbilityPicker = (side: 'attacker' | 'defender') => {
    uni.showActionSheet({
        itemList: COMMON_ABILITIES,
        success: (res) => {
            const selected = COMMON_ABILITIES[res.tapIndex];
            if (side === 'attacker') attackerAbility.value = selected;
            else defenderAbility.value = selected;
        }
    });
};

// ==============================
// 招式选择
// ==============================
const selectedMove = ref<MoveOption | null>(null);

const showMovePicker = () => {
    const names = COMMON_MOVES.map(m => `${m.name}  (${m.power} / ${getTypeShort(m.type)})`);
    uni.showActionSheet({
        itemList: names,
        success: (res) => { selectedMove.value = COMMON_MOVES[res.tapIndex]; }
    });
};

// ==============================
// 能力等级
// ==============================
const atkStage = ref(0);
const defStage = ref(0);
const spaStage = ref(0);
const spdStage = ref(0);

const decStage = (key: string) => {
    if (key === 'atk') atkStage.value = Math.max(-6, atkStage.value - 1);
    else if (key === 'spa') spaStage.value = Math.max(-6, spaStage.value - 1);
    else if (key === 'def') defStage.value = Math.max(-6, defStage.value - 1);
    else if (key === 'spd') spdStage.value = Math.max(-6, spdStage.value - 1);
};
const incStage = (key: string) => {
    if (key === 'atk') atkStage.value = Math.min(6, atkStage.value + 1);
    else if (key === 'spa') spaStage.value = Math.min(6, spaStage.value + 1);
    else if (key === 'def') defStage.value = Math.min(6, defStage.value + 1);
    else if (key === 'spd') spdStage.value = Math.min(6, spdStage.value + 1);
};

// ==============================
// 道具 / 状态
// ==============================
const selectedItem = ref<ItemOption>(ITEM_OPTIONS[0]);
const isBurned = ref(false);
const isCritical = ref(false);
const reflectScreen = ref<string>('none');

const showItemPicker = () => {
    uni.showActionSheet({
        itemList: ITEM_OPTIONS.map(i => i.name),
        success: (res) => { selectedItem.value = ITEM_OPTIONS[res.tapIndex]; }
    });
};

// ==============================
// 计算结果
// ==============================
const result = ref<CalcResult | null>(null);
const calculating = ref(false);

const doCalculate = async () => {
    if (!attackerPokemon.value || !defenderPokemon.value || !selectedMove.value) {
        uni.showToast({ title: '请选择双方宝可梦和招式', icon: 'none' });
        return;
    }

    calculating.value = true;
    try {
        const atk = calcStat(getBaseStat(attackerPokemon.value.stats, 'atk'), attackerLevel.value, false);
        const def = calcStat(getBaseStat(defenderPokemon.value.stats, 'def'), defenderLevel.value, false);
        const spa = calcStat(getBaseStat(attackerPokemon.value.stats, 'spa'), attackerLevel.value, false);
        const spd = calcStat(getBaseStat(defenderPokemon.value.stats, 'spd'), defenderLevel.value, false);
        const hp = calcStat(getBaseStat(defenderPokemon.value.stats, 'HP'), defenderLevel.value, true);

        // 光墙/反射壁: 折叠进 itemMod
        let itemMod = selectedItem.value.mod;
        if (reflectScreen.value === 'reflect' && selectedMove.value.category === 'physical') itemMod = Math.round(itemMod * 50 / 100);
        if (reflectScreen.value === 'lightscreen' && selectedMove.value.category === 'special') itemMod = Math.round(itemMod * 50 / 100);
        if (reflectScreen.value === 'auroraveil') itemMod = Math.round(itemMod * 50 / 100);

        const params: CalcParams = {
            attackerLevel: attackerLevel.value,
            attackerAtk: atk,
            attackerSpA: spa,
            attackerType1: attackerPokemon.value.types[0] || '',
            attackerType2: attackerPokemon.value.types[1] || '',
            attackerAbility: getAbilityName(attackerAbility.value),
            defenderLevel: defenderLevel.value,
            defenderDef: def,
            defenderSpD: spd,
            defenderType1: defenderPokemon.value.types[0] || '',
            defenderType2: defenderPokemon.value.types[1] || '',
            defenderHP: hp,
            defenderAbility: getAbilityName(defenderAbility.value),
            movePower: selectedMove.value.power,
            moveType: selectedMove.value.type,
            moveCategory: selectedMove.value.category,
            moveName: selectedMove.value.key,
            weather: selectedWeather.value || null,
            terrain: selectedTerrain.value || null,
            critical: isCritical.value,
            isBurned: isBurned.value,
            itemMod: itemMod,
            attackerAtkStage: atkStage.value,
            attackerSpaStage: spaStage.value,
            defenderDefStage: defStage.value,
            defenderSpdStage: spdStage.value,
        };

        const engineResult = await calcDamage(params);
        result.value = engineResult;
    } catch (e) {
        console.error('[calc] 计算失败', e);
        uni.showToast({ title: '计算失败', icon: 'none' });
    } finally {
        calculating.value = false;
    }
};

const resetAll = () => {
    attackerLevel.value = 50; defenderLevel.value = 50;
    selectedWeather.value = ''; selectedTerrain.value = '';
    attackerAbility.value = '无'; defenderAbility.value = '无';
    attackerPokemon.value = null; defenderPokemon.value = null;
    selectedMove.value = null;
    atkStage.value = 0; defStage.value = 0; spaStage.value = 0; spdStage.value = 0;
    selectedItem.value = ITEM_OPTIONS[0];
    isBurned.value = false; isCritical.value = false; reflectScreen.value = 'none';
    result.value = null;
};

const goBack = () => {
    // DetailNavbar 已处理返回导航
};
</script>

<style scoped>
.calc-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 44px; padding: 0 14px; }
.calc-row__title { font-size: 14px; font-weight: 600; color: #24262b; flex-shrink: 0; }
.calc-row__main { display: flex; flex-direction: column; gap: 1px; min-width: 0; flex: 1; }

.calc-pkm-name { font-size: 15px; font-weight: 800; color: #24262b; }

.calc-divider { height: 1px; margin: 0 14px; background: #f1f2f6; }
.calc-chip--active--orange { color: #fff; background: linear-gradient(135deg, #f4a06f, #d87a1e); border-color: transparent; }
.calc-chip--active--red { color: #fff; background: linear-gradient(135deg, #e76f6f, #d43a3a); border-color: transparent; }

.calc-action { flex: 1; height: 46px; line-height: 46px; border-radius: 16px; color: #ffffff; font-size: 15px; font-weight: 800; background: linear-gradient(135deg, #73b7ff, #357df4); box-shadow: 0 10px 22px rgba(53, 125, 244, 0.22); }
.calc-action--reset { flex: 0 0 auto; width: auto; padding: 0 20px; background: #eef0f5; color: #6f7682; box-shadow: none; }
.calc-action::after { border: none !important; }
</style>