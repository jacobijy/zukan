<template>
    <view class="calc-page min-h-screen page-bg" :style="{ paddingTop: 'var(--status-bar-height)', paddingBottom: '40px' }">
        <DetailNavbar title="伤害计算器" @back="goBack" />

        <scroll-view scroll-y class="relative z-10 h-[calc(100vh-var(--status-bar-height))] mt-[calc(var(--status-bar-height)+52px)] px-4 pb-6">
            <view class="mx-auto max-w-[720px] flex flex-col gap-3 pt-3">

                <!-- 攻击方 -->
                <PokemonCard
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
                <PokemonCard
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
                <view class="calc-card">
                    <view class="calc-head">
                        <view class="calc-head__icon calc-head__icon--violet">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4">
                                <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z"></path>
                            </svg>
                        </view>
                        <text class="calc-head__title">招式</text>
                    </view>
                    <view class="calc-row p-3" @click="showMovePicker">
                        <view v-if="!selectedMove" class="calc-row__main items-center">
                            <text class="text-[#9da2ad] text-[14px] font-semibold">点击选择招式</text>
                        </view>
                        <view v-else class="calc-row__main">
                            <view class="flex items-center gap-2">
                                <text class="calc-pkm-name">{{ selectedMove.name }}</text>
                                <text class="calc-type-badge-mini" :style="{ background: getTypeColor(selectedMove.type) }">{{ getTypeLabel(selectedMove.type) }}</text>
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
                </view>

                <!-- 战场条件 -->
                <view class="calc-card">
                    <view class="calc-head">
                        <view class="calc-head__icon calc-head__icon--gold">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4">
                                <path d="M17.5 19a4.5 4.5 0 0 0 0-9 6 6 0 0 0-11.7 1.5A4 4 0 0 0 6 19z"></path>
                            </svg>
                        </view>
                        <text class="calc-head__title">战场条件</text>
                    </view>

                    <view class="calc-chip-row">
                        <text class="calc-chip-row__label">天气</text>
                        <view class="calc-chip-group">
                            <view v-for="w in weatherOptions" :key="w.id"
                                class="calc-chip"
                                :class="selectedWeather === w.id ? 'calc-chip--active' : ''"
                                @click="toggleWeather(w.id)">{{ w.label }}</view>
                        </view>
                    </view>
                    <view class="calc-divider"></view>
                    <view class="calc-chip-row">
                        <text class="calc-chip-row__label">场地</text>
                        <view class="calc-chip-group">
                            <view v-for="t in terrainOptions" :key="t.id"
                                class="calc-chip"
                                :class="selectedTerrain === t.id ? 'calc-chip--active' : ''"
                                @click="toggleTerrain(t.id)">{{ t.label }}</view>
                        </view>
                    </view>
                    <view class="calc-divider"></view>
                    <view class="calc-chip-row">
                        <text class="calc-chip-row__label">道具</text>
                        <view class="calc-chip-group">
                            <view class="calc-chip" :class="selectedItem.name !== '无' ? 'calc-chip--active' : ''" @click="showItemPicker">{{ selectedItem.name }}</view>
                        </view>
                    </view>
                    <view class="calc-divider"></view>
                    <view class="calc-chip-row">
                        <text class="calc-chip-row__label">防护</text>
                        <view class="calc-chip-group">
                            <view v-for="s in screenOptions" :key="s.id"
                                class="calc-chip"
                                :class="reflectScreen === s.id ? 'calc-chip--active' : ''"
                                @click="toggleScreen(s.id)">{{ s.label }}</view>
                        </view>
                    </view>
                    <view class="calc-divider"></view>
                    <view class="calc-chip-row calc-chip-row--last">
                        <text class="calc-chip-row__label">状态</text>
                        <view class="calc-chip-group">
                            <view class="calc-chip" :class="isBurned ? 'calc-chip--active--orange' : ''" @click="isBurned = !isBurned">烧伤</view>
                            <view class="calc-chip" :class="isCritical ? 'calc-chip--active--red' : ''" @click="isCritical = !isCritical">会心</view>
                        </view>
                    </view>
                </view>

                <!-- 结果 -->
                <view class="result-card">
                    <view class="flex items-center justify-between">
                        <text class="result-card__label">预计伤害</text>
                        <text class="result-card__value">{{ result ? `${result.minDamage} — ${result.maxDamage}` : '—' }}</text>
                    </view>
                    <view class="result-card__bar-wrap">
                        <view class="result-card__bar">
                            <view class="result-card__bar-fill" :style="{ width: ((result?.percentHP ?? 0) > 100 ? 100 : (result?.percentHP ?? 0)) + '%' }"></view>
                        </view>
                        <text class="result-card__bar-text" v-if="result">{{ result.percentHP }}%</text>
                    </view>
                    <view class="result-card__meta">
                        <text class="result-card__meta-item" :class="result && result.typeEffectiveness > 1 ? 'text-[#e74c3c]' : 'text-[#9da2ad]'">
                            {{ result?.effectivenessLabel ?? '克制 —' }}
                        </text>
                        <text class="result-card__meta-item font-black" :class="result && result.hkoLabel === 'OHKO' ? 'text-[#e74c3c]' : 'text-[#9da2ad]'">
                            {{ result?.hkoLabel ?? '击杀 —' }}
                        </text>
                    </view>
                </view>

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
import { calcDamage, calcStat, type CalcResult, type CalcParams, MOVE_FLAG } from './calc-engine';
import { usePokemonStore } from '@/store/pokemon';
import PokemonCard from '@/components/calc/PokemonCard.vue';
import DetailNavbar from '@/components/shared/DetailNavbar.vue';
import { getTypeColor, getTypeLabel } from '@/utils/helpers';

const pokemonStore = usePokemonStore();

// ==============================
// 宝可梦选择
// ==============================

const attackerPokemon = ref<{ name: string; types: string[]; stats: { name: string; value: number }[] } | null>(null);
const defenderPokemon = ref<{ name: string; types: string[]; stats: { name: string; value: number }[] } | null>(null);

const pokemonNameList = computed(() => pokemonStore.allPokemons.map(p => p.name));

const getBaseStat = (stats: { name: string; value: number }[], key: string): number => {
    const m: Record<string, string> = { HP: 'HP', 攻击: 'atk', 防御: 'def', 特攻: 'spa', 特防: 'spd', 速度: 'spe' };
    const target = m[key];
    const found = stats.find(s => {
        const sKey = s.name === 'HP' || s.name.includes('HP') ? 'HP' :
            s.name === '攻击' ? 'atk' : s.name === '防御' ? 'def' :
            s.name === '特攻' ? 'spa' : s.name === '特防' ? 'spd' :
            s.name === '速度' ? 'spe' : '';
        return sKey === target;
    });
    return found?.value ?? 50;
};

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
// 天气
// ==============================
interface WeatherOption { id: string; label: string; }
const weatherOptions: WeatherOption[] = [
    { id: '', label: '无' }, { id: 'sunnyday', label: '晴天' },
    { id: 'raindance', label: '雨天' }, { id: 'sandstorm', label: '沙暴' },
    { id: 'hail', label: '冰雹' }, { id: 'snowscape', label: '雪景' },
];
const selectedWeather = ref('');

const toggleWeather = (id: string) => {
    selectedWeather.value = selectedWeather.value === id ? '' : id;
};

// ==============================
// 场地
// ==============================
interface TerrainOption { id: string; label: string; }
const terrainOptions: TerrainOption[] = [
    { id: '', label: '无' }, { id: 'electric', label: '电气' },
    { id: 'grassy', label: '草地' }, { id: 'misty', label: '薄雾' },
    { id: 'psychic', label: '精神' },
];
const selectedTerrain = ref('');

const toggleTerrain = (id: string) => {
    selectedTerrain.value = selectedTerrain.value === id ? '' : id;
};

// ==============================
// 特性
// ==============================
const commonAbilities = [
    '无', '大力士', '瑜伽之力', '活力', '毅力', '猛火', '激流', '茂盛', '虫警',
    '铁拳', '强壮之颚', '分析', '适应力', '技术高手', '降雪', '降雨', '干旱', '扬沙',
    '厚脂肪', '过滤', '坚石', '棱镜装甲', '多重鳞片', '毛皮大衣', '冰鳞粉',
    '毛茸茸', '肥脂', '引火', '蓄电', '储水', '飘浮', '神奇守护', '破格',
    '纯朴', '无关天气',
];

const attackerAbility = ref('无');
const defenderAbility = ref('无');

const getAbilityName = (name: string): string => {
    const map: Record<string, string> = {
        '无': '无', '大力士': 'hugepower', '瑜伽之力': 'purepower',
        '活力': 'hustle', '毅力': 'guts', '猛火': 'blaze', '激流': 'torrent',
        '茂盛': 'overgrow', '虫警': 'swarm', '铁拳': 'ironfist',
        '强壮之颚': 'strongjaw', '分析': 'analytic', '适应力': 'adaptability',
        '技术高手': 'technician', '降雪': 'snowwarning', '降雨': 'drizzle',
        '干旱': 'drought', '扬沙': 'sandstream', '厚脂肪': 'thickfat',
        '过滤': 'filter', '坚石': 'solidrock', '棱镜装甲': 'prismarmor',
        '多重鳞片': 'multiscale', '毛皮大衣': 'furcoat', '冰鳞粉': 'icescales',
        '毛茸茸': 'fluffy', '肥脂': 'heatproof', '引火': 'flashfire',
        '蓄电': 'voltabsorb', '储水': 'waterabsorb', '飘浮': 'levitate',
        '神奇守护': 'wonderguard', '破格': 'moldbreaker', '纯朴': 'unaware',
        '无关天气': 'cloudnine',
    };
    return map[name] || '无';
};

const showAbilityPicker = (side: 'attacker' | 'defender') => {
    uni.showActionSheet({
        itemList: commonAbilities,
        success: (res) => {
            const selected = commonAbilities[res.tapIndex];
            if (side === 'attacker') attackerAbility.value = selected;
            else defenderAbility.value = selected;
        }
    });
};

// ==============================
// 招式选择
// ==============================
interface MoveOption {
    key: string; name: string; power: number;
    type: string; category: 'physical' | 'special'; flags: number;
}

const commonMoves: MoveOption[] = [
    { key: 'flamethrower', name: '喷射火焰', power: 90, type: 'fire', category: 'special', flags: 0 },
    { key: 'fireblast', name: '大字爆炎', power: 110, type: 'fire', category: 'special', flags: 0 },
    { key: 'flareblitz', name: '闪焰冲锋', power: 120, type: 'fire', category: 'physical', flags: MOVE_FLAG.CONTACT },
    { key: 'surf', name: '冲浪', power: 90, type: 'water', category: 'special', flags: 0 },
    { key: 'hydropump', name: '水炮', power: 110, type: 'water', category: 'special', flags: 0 },
    { key: 'waterfall', name: '攀瀑', power: 80, type: 'water', category: 'physical', flags: MOVE_FLAG.CONTACT },
    { key: 'liquidation', name: '水流裂破', power: 85, type: 'water', category: 'physical', flags: MOVE_FLAG.CONTACT },
    { key: 'energyball', name: '能量球', power: 90, type: 'grass', category: 'special', flags: MOVE_FLAG.BULLET },
    { key: 'gigadrain', name: '终极吸取', power: 75, type: 'grass', category: 'special', flags: MOVE_FLAG.HEAL },
    { key: 'powerwhip', name: '强力鞭打', power: 120, type: 'grass', category: 'physical', flags: MOVE_FLAG.CONTACT },
    { key: 'thunderbolt', name: '十万伏特', power: 90, type: 'electric', category: 'special', flags: 0 },
    { key: 'thunder', name: '打雷', power: 110, type: 'electric', category: 'special', flags: 0 },
    { key: 'icebeam', name: '冰冻光束', power: 90, type: 'ice', category: 'special', flags: 0 },
    { key: 'blizzard', name: '暴风雪', power: 110, type: 'ice', category: 'special', flags: 0 },
    { key: 'closecombat', name: '近身战', power: 120, type: 'fighting', category: 'physical', flags: MOVE_FLAG.CONTACT },
    { key: 'aurasphere', name: '波导弹', power: 80, type: 'fighting', category: 'special', flags: MOVE_FLAG.PULSE },
    { key: 'drainpunch', name: '吸取拳', power: 75, type: 'fighting', category: 'physical', flags: MOVE_FLAG.CONTACT | MOVE_FLAG.PUNCH | MOVE_FLAG.HEAL },
    { key: 'earthquake', name: '地震', power: 100, type: 'ground', category: 'physical', flags: 0 },
    { key: 'earthpower', name: '大地之力', power: 90, type: 'ground', category: 'special', flags: 0 },
    { key: 'psychic', name: '精神强念', power: 90, type: 'psychic', category: 'special', flags: 0 },
    { key: 'shadowball', name: '暗影球', power: 80, type: 'ghost', category: 'special', flags: MOVE_FLAG.BULLET },
    { key: 'dragonpulse', name: '龙之波动', power: 85, type: 'dragon', category: 'special', flags: MOVE_FLAG.PULSE },
    { key: 'darkpulse', name: '恶之波动', power: 80, type: 'dark', category: 'special', flags: MOVE_FLAG.PULSE },
    { key: 'flashcannon', name: '加农光炮', power: 80, type: 'steel', category: 'special', flags: 0 },
    { key: 'moonblast', name: '月亮之力', power: 95, type: 'fairy', category: 'special', flags: 0 },
    { key: 'sludgebomb', name: '污泥炸弹', power: 90, type: 'poison', category: 'special', flags: MOVE_FLAG.BULLET },
    { key: 'hypervoice', name: '巨声', power: 90, type: 'normal', category: 'special', flags: MOVE_FLAG.SOUND },
    { key: 'thunderpunch', name: '雷电拳', power: 75, type: 'electric', category: 'physical', flags: MOVE_FLAG.CONTACT | MOVE_FLAG.PUNCH },
    { key: 'icepunch', name: '冰冻拳', power: 75, type: 'ice', category: 'physical', flags: MOVE_FLAG.CONTACT | MOVE_FLAG.PUNCH },
    { key: 'firepunch', name: '火焰拳', power: 75, type: 'fire', category: 'physical', flags: MOVE_FLAG.CONTACT | MOVE_FLAG.PUNCH },
    { key: 'crunch', name: '咬碎', power: 80, type: 'dark', category: 'physical', flags: MOVE_FLAG.CONTACT | MOVE_FLAG.BITE },
    { key: 'icefang', name: '冰冻牙', power: 65, type: 'ice', category: 'physical', flags: MOVE_FLAG.CONTACT | MOVE_FLAG.BITE },
    { key: 'firefang', name: '火焰牙', power: 65, type: 'fire', category: 'physical', flags: MOVE_FLAG.CONTACT | MOVE_FLAG.BITE },
    { key: 'psychicfangs', name: '精神之牙', power: 85, type: 'psychic', category: 'physical', flags: MOVE_FLAG.CONTACT | MOVE_FLAG.BITE },
];

const selectedMove = ref<MoveOption | null>(null);

const showMovePicker = () => {
    const typeLabel: Record<string, string> = { fire:'火', water:'水', grass:'草', electric:'电', ice:'冰',
        fighting:'斗', ground:'地', flying:'飞', psychic:'超', bug:'虫', rock:'岩', ghost:'鬼',
        dragon:'龙', dark:'恶', steel:'钢', fairy:'妖', poison:'毒', normal:'普' };
    const names = commonMoves.map(m => `${m.name}  (${m.power} / ${typeLabel[m.type] || m.type})`);
    uni.showActionSheet({
        itemList: names,
        success: (res) => { selectedMove.value = commonMoves[res.tapIndex]; }
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
interface ItemOption { name: string; mod: number; }
const itemOptions: ItemOption[] = [
    { name: '无', mod: 100 }, { name: '生命宝珠', mod: 130 },
    { name: '讲究头带', mod: 150 }, { name: '讲究眼镜', mod: 150 },
    { name: '讲究围巾', mod: 150 }, { name: '达人带', mod: 120 },
    { name: '力量头带', mod: 110 }, { name: '智慧眼镜', mod: 110 },
    { name: '木炭/水滴等', mod: 120 },
];

const selectedItem = ref<ItemOption>(itemOptions[0]);
const isBurned = ref(false);
const isCritical = ref(false);
const reflectScreen = ref<'none' | 'reflect' | 'lightscreen' | 'auroraveil'>('none');

interface ScreenOption { id: string; label: string; }
const screenOptions: ScreenOption[] = [
    { id: 'none', label: '无' },
    { id: 'reflect', label: '反射壁' },
    { id: 'lightscreen', label: '光墙' },
    { id: 'auroraveil', label: '极光幕' },
];

const toggleScreen = (id: string) => {
    reflectScreen.value = reflectScreen.value === id ? 'none' : (id as any);
};

const showItemPicker = () => {
    uni.showActionSheet({
        itemList: itemOptions.map(i => i.name),
        success: (res) => { selectedItem.value = itemOptions[res.tapIndex]; }
    });
};

// ==============================
// 计算结果
// ==============================
const result = ref<CalcResult | null>(null);
const calculating = ref(false);

// ─── 属性显示辅助（招式卡用到） ───

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
    selectedItem.value = itemOptions[0];
    isBurned.value = false; isCritical.value = false; reflectScreen.value = 'none';
    result.value = null;
};

const goBack = () => {
    // DetailNavbar 已处理返回导航
};
</script>

<style scoped>


.calc-navbar {
    background: #ffffff;
    border-bottom: 1px solid #e5e7ee;
    box-shadow: 0 4px 18px rgba(48, 55, 72, 0.06);
}

.calc-icon-button { display: flex; flex-shrink: 0; align-items: center; justify-content: center; width: 40px; height: 40px; padding: 0; margin: 0; color: #8d929c; background: transparent; border: 0; }
.calc-icon-button--ghost { color: #c4c7cf; }

.calc-card { border: 1px solid #e5e7ee; border-radius: 20px; background: #ffffff; box-shadow: 0 10px 24px rgba(48, 55, 72, 0.06); overflow: hidden; }
.calc-head { display: flex; align-items: center; gap: 8px; padding: 10px 14px; border-bottom: 1px solid #eef0f5; background: #fafbfd; }
.calc-head__icon { display: flex; align-items: center; justify-content: center; width: 26px; height: 26px; border-radius: 8px; color: #ffffff; }
.calc-head__icon--green { background: linear-gradient(135deg, #68cc67, #34b85a); }
.calc-head__icon--blue { background: linear-gradient(135deg, #73b7ff, #357df4); }
.calc-head__icon--violet { background: linear-gradient(135deg, #9a86f4, #7350d4); }
.calc-head__icon--gold { background: linear-gradient(135deg, #f4d06f, #d89a1e); }
.calc-head__title { font-size: 13px; font-weight: 800; letter-spacing: 0.04em; color: #3b3f48; }

.calc-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 44px; padding: 0 14px; }
.calc-row + .calc-row { border-top: 1px solid #f1f2f6; }
.calc-row__title { font-size: 14px; font-weight: 600; color: #24262b; flex-shrink: 0; }
.calc-row__main { display: flex; flex-direction: column; gap: 1px; min-width: 0; flex: 1; }
.calc-row__level { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
.calc-row__level-label { font-size: 12px; font-weight: 700; color: #9da2ad; }
.calc-row__value { font-size: 13px; font-weight: 600; color: #24262b; text-align: right; }

.calc-stepper { display: flex; align-items: center; gap: 8px; }
.calc-stepper__btn { display: flex; align-items: center; justify-content: center; width: 26px; height: 26px; border-radius: 8px; border: 1px solid #e1e4eb; background: #f5f6fa; color: #6f7682; font-size: 15px; font-weight: 700; }
.calc-stepper__value { min-width: 26px; text-align: center; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 14px; font-weight: 800; color: #24262b; }

.calc-chip-group { display: flex; flex-wrap: wrap; gap: 6px; justify-content: flex-end; }
.calc-chip { padding: 5px 11px; border-radius: 999px; border: 1px solid #e1e4eb; background: #f5f6fa; color: #6f7682; font-size: 12px; font-weight: 700; }
.calc-chip--active { color: #ffffff; background: linear-gradient(135deg, #73b7ff, #357df4); border-color: transparent; }

.result-card { border: 1px solid #e5e7ee; border-radius: 20px; background: #ffffff; box-shadow: 0 10px 24px rgba(48, 55, 72, 0.06); padding: 14px; }
.result-card__label { font-size: 12px; font-weight: 800; color: #8d929c; letter-spacing: 0.08em; }
.result-card__value { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 26px; font-weight: 900; color: #24262b; letter-spacing: -0.04em; }

.calc-action { flex: 1; height: 46px; line-height: 46px; border-radius: 16px; color: #ffffff; font-size: 15px; font-weight: 800; background: linear-gradient(135deg, #73b7ff, #357df4); box-shadow: 0 10px 22px rgba(53, 125, 244, 0.22); }
.calc-action--reset { flex: 0 0 auto; width: auto; padding: 0 20px; background: #eef0f5; color: #6f7682; box-shadow: none; }
.calc-action::after { border: none !important; }

/* ─── 新布局 ─── */
.calc-pkm-name { font-size: 15px; font-weight: 800; color: #24262b; }
.calc-type-badge { display: inline-flex; align-items: center; justify-content: center; min-width: 22px; height: 18px; padding: 0 5px; border-radius: 4px; color: #fff; font-size: 10px; font-weight: 800; line-height: 1; }
.calc-type-badge-mini { display: inline-flex; align-items: center; justify-content: center; min-width: 20px; height: 16px; padding: 0 4px; border-radius: 3px; color: #fff; font-size: 9px; font-weight: 800; line-height: 1; }
.calc-stepper__value--wrap { display: flex; flex-direction: column; align-items: center; min-width: 32px; gap: 0; }
.calc-stepper__label { font-size: 9px; font-weight: 700; color: #9da2ad; line-height: 1; }
.calc-stats-row { display: flex; gap: 2px; padding: 6px 12px 8px; border-top: 1px solid #f1f2f6; }
.calc-stats-row--empty { justify-content: center; min-height: 36px; align-items: center; padding: 6px 14px; }
.calc-stat-item { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 1px; }
.calc-stat-label { font-size: 9px; font-weight: 700; color: #9da2ad; letter-spacing: 0.02em; }
.calc-stat-value { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 15px; font-weight: 900; color: #24262b; }
.calc-row-line { display: flex; align-items: center; padding: 8px 14px; border-top: 1px solid #f1f2f6; gap: 0; }
.calc-inline-item { display: flex; align-items: center; gap: 6px; flex: 1; min-width: 0; justify-content: center; }
.calc-inline-divider { width: 1px; height: 20px; background: #eef0f5; flex-shrink: 0; }
.calc-inline-label { font-size: 11px; font-weight: 700; color: #9da2ad; flex-shrink: 0; }
.calc-inline-value { font-size: 12px; font-weight: 700; color: #9da2ad; }
.calc-inline-value--set { color: #357df4; }
.calc-stage-mini { display: flex; align-items: center; gap: 2px; }
.calc-stage-btn { display: flex; align-items: center; justify-content: center; width: 24px; height: 24px; border-radius: 6px; border: 1px solid #e1e4eb; background: #f5f6fa; color: #6f7682; font-size: 14px; font-weight: 700; }
.calc-stage-val { min-width: 24px; text-align: center; font-family: ui-monospace; font-size: 13px; font-weight: 800; color: #24262b; }
.calc-chip-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-height: 40px; padding: 0 14px; }
.calc-chip-row__label { font-size: 13px; font-weight: 600; color: #24262b; flex-shrink: 0; }
.calc-divider { height: 1px; margin: 0 14px; background: #f1f2f6; }
.calc-chip--active--orange { color: #fff; background: linear-gradient(135deg, #f4a06f, #d87a1e); border-color: transparent; }
.calc-chip--active--red { color: #fff; background: linear-gradient(135deg, #e76f6f, #d43a3a); border-color: transparent; }
.result-card__bar-wrap { display: flex; align-items: center; gap: 10px; margin-top: 10px; }
.result-card__bar-text { font-size: 12px; font-weight: 800; font-family: ui-monospace; color: #6f7682; min-width: 36px; text-align: right; }
.result-card__meta-item { font-size: 12px; font-weight: 700; color: #6f7682; }
</style>