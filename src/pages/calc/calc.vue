<template>
    <view class="calc-page min-h-screen" :style="{ paddingTop: 'var(--status-bar-height)', paddingBottom: '40px' }">
        <view class="calc-navbar fixed left-0 right-0 top-0 z-[1000] flex items-center justify-between px-4 pb-3" :style="{ paddingTop: 'var(--status-bar-height)' }">
            <button class="calc-icon-button" @click="goBack">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5">
                    <path d="M19 12H5"></path>
                    <polyline points="12 19 5 12 12 5"></polyline>
                </svg>
            </button>

            <view class="min-w-0 flex-1 px-3 text-center">
                <text class="block truncate text-lg font-black tracking-[-0.04em] text-[#24262b]">伤害计算器</text>
            </view>

            <view class="calc-icon-button calc-icon-button--ghost">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5">
                    <path d="M12 8h.01"></path>
                    <path d="M11 12h1v4h1"></path>
                    <circle cx="12" cy="12" r="9"></circle>
                </svg>
            </view>
        </view>

        <scroll-view scroll-y class="relative z-10 h-[calc(100vh-var(--status-bar-height))] mt-[calc(var(--status-bar-height)+52px)] px-4 pb-6">
            <view class="mx-auto max-w-[720px] flex flex-col gap-3 pt-3">
                <!-- 攻击方 -->
                <view class="calc-card">
                    <view class="calc-head">
                        <view class="calc-head__icon calc-head__icon--green">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4">
                                <circle cx="12" cy="12" r="8"></circle>
                                <circle cx="12" cy="12" r="3"></circle>
                                <path d="M12 4v3M12 17v3M4 12h3M17 12h3"></path>
                            </svg>
                        </view>
                        <text class="calc-head__title">攻击方</text>
                    </view>
                    <view class="calc-row" @click="showPokemonPicker('attacker')">
                        <view class="calc-row__main">
                            <text class="calc-row__title">宝可梦</text>
                            <text class="calc-row__value" :class="attackerPokemon ? '' : 'text-[#9da2ad]'">{{ attackerPokemon?.name ?? '选择攻击方' }}</text>
                        </view>
                        <view class="calc-row__level">
                            <text class="calc-row__level-label">等级</text>
                            <view class="calc-stepper">
                                <view class="calc-stepper__btn" @click.stop="adjustLevel('attacker', -1)">−</view>
                                <text class="calc-stepper__value">{{ attackerLevel }}</text>
                                <view class="calc-stepper__btn" @click.stop="adjustLevel('attacker', 1)">+</view>
                            </view>
                        </view>
                    </view>
                    <view class="calc-row">
                        <text class="calc-row__title">能力值</text>
                        <text class="calc-row__value text-[12px]" :class="attackerPokemon ? '' : 'text-[#9da2ad]'">{{ attackerPokemon ? getStatsString(attackerPokemon, attackerLevel) : '—' }}</text>
                    </view>
                    <view class="calc-row" @click="showAbilityPicker('attacker')">
                        <text class="calc-row__title">特性</text>
                        <text class="calc-row__value" :class="attackerAbility !== '无' ? '' : 'text-[#9da2ad]'">{{ attackerAbility }}</text>
                    </view>
                    <view class="calc-row calc-row--last">
                        <text class="calc-row__title">能力等级</text>
                        <view class="calc-stage-group">
                            <view class="calc-stage-item">
                                <text class="calc-stage-label">物攻</text>
                                <view class="calc-stage-stepper">
                                    <view class="calc-stage-btn" @click="adjustStage(atkStage, -1)">−</view>
                                    <text class="calc-stage-val">{{ atkStage >= 0 ? '+' : '' }}{{ atkStage }}</text>
                                    <view class="calc-stage-btn" @click="adjustStage(atkStage, 1)">+</view>
                                </view>
                            </view>
                            <view class="calc-stage-item">
                                <text class="calc-stage-label">特攻</text>
                                <view class="calc-stage-stepper">
                                    <view class="calc-stage-btn" @click="adjustStage(spaStage, -1)">−</view>
                                    <text class="calc-stage-val">{{ spaStage >= 0 ? '+' : '' }}{{ spaStage }}</text>
                                    <view class="calc-stage-btn" @click="adjustStage(spaStage, 1)">+</view>
                                </view>
                            </view>
                        </view>
                    </view>
                </view>

                <!-- 防御方 -->
                <view class="calc-card">
                    <view class="calc-head">
                        <view class="calc-head__icon calc-head__icon--blue">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4">
                                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                            </svg>
                        </view>
                        <text class="calc-head__title">防御方</text>
                    </view>
                    <view class="calc-row" @click="showPokemonPicker('defender')">
                        <view class="calc-row__main">
                            <text class="calc-row__title">宝可梦</text>
                            <text class="calc-row__value" :class="defenderPokemon ? '' : 'text-[#9da2ad]'">{{ defenderPokemon?.name ?? '选择防御方' }}</text>
                        </view>
                        <view class="calc-row__level">
                            <text class="calc-row__level-label">等级</text>
                            <view class="calc-stepper">
                                <view class="calc-stepper__btn" @click.stop="adjustLevel('defender', -1)">−</view>
                                <text class="calc-stepper__value">{{ defenderLevel }}</text>
                                <view class="calc-stepper__btn" @click.stop="adjustLevel('defender', 1)">+</view>
                            </view>
                        </view>
                    </view>
                    <view class="calc-row">
                        <text class="calc-row__title">能力值</text>
                        <text class="calc-row__value text-[12px]" :class="defenderPokemon ? '' : 'text-[#9da2ad]'">{{ defenderPokemon ? getStatsString(defenderPokemon, defenderLevel) : '—' }}</text>
                    </view>
                    <view class="calc-row" @click="showAbilityPicker('defender')">
                        <text class="calc-row__title">特性</text>
                        <text class="calc-row__value" :class="defenderAbility !== '无' ? '' : 'text-[#9da2ad]'">{{ defenderAbility }}</text>
                    </view>
                    <view class="calc-row calc-row--last">
                        <text class="calc-row__title">能力等级</text>
                        <view class="calc-stage-group">
                            <view class="calc-stage-item">
                                <text class="calc-stage-label">物防</text>
                                <view class="calc-stage-stepper">
                                    <view class="calc-stage-btn" @click="adjustStage(defStage, -1)">−</view>
                                    <text class="calc-stage-val">{{ defStage >= 0 ? '+' : '' }}{{ defStage }}</text>
                                    <view class="calc-stage-btn" @click="adjustStage(defStage, 1)">+</view>
                                </view>
                            </view>
                            <view class="calc-stage-item">
                                <text class="calc-stage-label">特防</text>
                                <view class="calc-stage-stepper">
                                    <view class="calc-stage-btn" @click="adjustStage(spdStage, -1)">−</view>
                                    <text class="calc-stage-val">{{ spdStage >= 0 ? '+' : '' }}{{ spdStage }}</text>
                                    <view class="calc-stage-btn" @click="adjustStage(spdStage, 1)">+</view>
                                </view>
                            </view>
                        </view>
                    </view>
                </view>

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
                    <view class="calc-row" @click="showMovePicker">
                        <text class="calc-row__title">招式</text>
                        <text class="calc-row__value" :class="selectedMove ? '' : 'text-[#9da2ad]'">{{ selectedMove?.name ?? '选择招式' }}</text>
                    </view>
                    <view class="calc-row calc-row--last">
                        <text class="calc-row__title">威力 / 属性 / 类别</text>
                        <text class="calc-row__value" :class="selectedMove ? '' : 'text-[#9da2ad]'">{{ selectedMove ? `${selectedMove.power} / ${selectedMove.type} / ${selectedMove.category === 'physical' ? '物理' : '特殊'}` : '—' }}</text>
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
                    <view class="calc-row">
                        <text class="calc-row__title">天气</text>
                        <view class="calc-chip-group">
                            <view v-for="w in weatherOptions" :key="w.id"
                                class="calc-chip"
                                :class="selectedWeather === w.id ? 'calc-chip--active' : ''"
                                @click="toggleWeather(w.id)">
                                {{ w.label }}
                            </view>
                        </view>
                    </view>
                    <view class="calc-row">
                        <text class="calc-row__title">场地</text>
                        <view class="calc-chip-group">
                            <view v-for="t in terrainOptions" :key="t.id"
                                class="calc-chip"
                                :class="selectedTerrain === t.id ? 'calc-chip--active' : ''"
                                @click="toggleTerrain(t.id)">
                                {{ t.label }}
                            </view>
                        </view>
                    </view>
                    <view class="calc-row">
                        <text class="calc-row__title">道具</text>
                        <view class="calc-chip-group">
                            <view class="calc-chip" :class="selectedItem.name !== '无' ? 'calc-chip--active' : ''" @click="showItemPicker">{{ selectedItem.name }}</view>
                        </view>
                    </view>
                    <view class="calc-row" :class="reflectScreen !== 'none' ? '' : 'calc-row--last'">
                        <text class="calc-row__title">防护</text>
                        <view class="calc-chip-group">
                            <view v-for="s in screenOptions" :key="s.id"
                                class="calc-chip"
                                :class="reflectScreen === s.id ? 'calc-chip--active' : ''"
                                @click="toggleScreen(s.id)">
                                {{ s.label }}
                            </view>
                        </view>
                    </view>
                    <view class="calc-row calc-row--last">
                        <text class="calc-row__title">状态</text>
                        <view class="calc-chip-group">
                            <view class="calc-chip" :class="isBurned ? 'calc-chip--active' : ''" @click="isBurned = !isBurned">烧伤</view>
                            <view class="calc-chip" :class="isCritical ? 'calc-chip--active' : ''" @click="isCritical = !isCritical">会心</view>
                        </view>
                    </view>
                </view>

                <!-- 结果 -->
                <view class="result-card">
                    <view class="result-card__top">
                        <text class="result-card__label">预计伤害</text>
                        <text class="result-card__value">{{ result ? `${result.minDamage} — ${result.maxDamage}` : '—' }}</text>
                    </view>
                    <view class="result-card__bar">
                        <view class="result-card__bar-fill" :style="{ width: (result?.percentHP ?? 0) + '%' }"></view>
                    </view>
                    <view class="result-card__meta">
                        <text>{{ result?.effectivenessLabel ?? '克制 —' }}</text>
                        <text>{{ result?.hkoLabel ?? '击杀 —' }}</text>
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

const adjustStage = (target: ReturnType<typeof ref<number>>, delta: number) => {
    const next = target.value + delta;
    if (next >= -6 && next <= 6) target.value = next;
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

const getStatsString = (pkm: typeof attackerPokemon.value, level: number): string => {
    if (!pkm) return '—';
    const hp = calcStat(getBaseStat(pkm.stats, 'HP'), level, true);
    const atk = calcStat(getBaseStat(pkm.stats, 'atk'), level, false);
    const def = calcStat(getBaseStat(pkm.stats, 'def'), level, false);
    const spa = calcStat(getBaseStat(pkm.stats, 'spa'), level, false);
    const spd = calcStat(getBaseStat(pkm.stats, 'spd'), level, false);
    const spe = calcStat(getBaseStat(pkm.stats, 'spe'), level, false);
    return `HP${hp} 攻${atk} 防${def} 特攻${spa} 特防${spd} 速${spe}`;
};

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
    uni.navigateBack({
        fail: () => { uni.reLaunch({ url: '/pages/features/features' }); }
    });
};
</script>

<style scoped>
.calc-page {
    position: relative;
    overflow: hidden;
    color: #24262b;
    background:
        radial-gradient(circle at 18% -10%, #ffffff 0%, transparent 34%),
        linear-gradient(180deg, #f7f8fb 0%, #f1f2f6 46%, #eef0f5 100%);
}

.calc-page::before {
    position: absolute;
    inset: 0;
    pointer-events: none;
    content: '';
    background-image:
        linear-gradient(rgba(45, 49, 58, 0.025) 1px, transparent 1px),
        linear-gradient(90deg, rgba(45, 49, 58, 0.022) 1px, transparent 1px);
    background-size: 32px 32px;
    mask-image: linear-gradient(to bottom, rgba(0, 0, 0, 0.5), transparent 58%);
}

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

.calc-stage-group { display: flex; gap: 12px; }
.calc-stage-item { display: flex; flex-direction: column; align-items: center; gap: 4px; }
.calc-stage-label { font-size: 10px; font-weight: 700; color: #9da2ad; }
.calc-stage-stepper { display: flex; align-items: center; gap: 4px; }
.calc-stage-btn { display: flex; align-items: center; justify-content: center; width: 22px; height: 22px; border-radius: 6px; border: 1px solid #e1e4eb; background: #f5f6fa; color: #6f7682; font-size: 13px; font-weight: 700; }
.calc-stage-val { min-width: 22px; text-align: center; font-family: ui-monospace; font-size: 13px; font-weight: 800; color: #24262b; }

.result-card { border: 1px solid #e5e7ee; border-radius: 20px; background: #ffffff; box-shadow: 0 10px 24px rgba(48, 55, 72, 0.06); padding: 14px; }
.result-card__top { display: flex; align-items: baseline; justify-content: space-between; }
.result-card__label { font-size: 12px; font-weight: 800; color: #8d929c; letter-spacing: 0.08em; }
.result-card__value { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 26px; font-weight: 900; color: #24262b; letter-spacing: -0.04em; }
.result-card__bar { height: 8px; margin-top: 10px; overflow: hidden; border-radius: 999px; background: #eef0f5; }
.result-card__bar-fill { height: 100%; border-radius: inherit; background: linear-gradient(90deg, #73b7ff, #357df4); }
.result-card__meta { display: flex; justify-content: space-between; margin-top: 8px; color: #9da2ad; font-size: 11px; font-weight: 700; }

.calc-action { flex: 1; height: 46px; line-height: 46px; border-radius: 16px; color: #ffffff; font-size: 15px; font-weight: 800; background: linear-gradient(135deg, #73b7ff, #357df4); box-shadow: 0 10px 22px rgba(53, 125, 244, 0.22); }
.calc-action--reset { flex: 0 0 auto; width: auto; padding: 0 20px; background: #eef0f5; color: #6f7682; box-shadow: none; }
.calc-action::after { border: none !important; }
</style>