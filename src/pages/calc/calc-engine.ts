/**
 * 伤害计算引擎（WASM 封装层）
 *
 * JS 侧负责：
 *   1. 将用户输入（属性名、天气名等）转为枚举 ID
 *   2. 调用 WASM 的 DamageInput + calculate_damage_batch
 *   3. 格式化结果为前端可用格式
 *
 * WASM 侧负责所有修正因子计算：
 *   TypeChart、STAB、天气、场地、特性、会心、烧伤、随机
 */

import type {
  DamageInput,
  BatchDamageResult,
} from '@/infra/wasm/pkg/zukan_wasm';

// ─── 枚举映射 ───────────────────────────────────────────

/** 招式标志位常量（与 WASM 侧 MOVE_FLAG_* 对应） */
export const MOVE_FLAG = {
  CONTACT: 1 << 0,
  PUNCH: 1 << 1,
  BITE: 1 << 2,
  SOUND: 1 << 3,
  PULSE: 1 << 4,
  POWDER: 1 << 5,
  BULLET: 1 << 6,
  HEAL: 1 << 7,
} as const;

/**
 * 常用招式标志位查询表
 * 用于给常见招式快速设置标志位
 */
export const MOVE_FLAGS_LOOKUP: Record<string, number> = {
  // 接触类物理招式
  'tackle': MOVE_FLAG.CONTACT,
  'bodyslam': MOVE_FLAG.CONTACT,
  'quickattack': MOVE_FLAG.CONTACT,
  'scratch': MOVE_FLAG.CONTACT,
  'slash': MOVE_FLAG.CONTACT,
  'wingattack': MOVE_FLAG.CONTACT,
  'bite': MOVE_FLAG.CONTACT | MOVE_FLAG.BITE,
  'crunch': MOVE_FLAG.CONTACT | MOVE_FLAG.BITE,
  'icefang': MOVE_FLAG.CONTACT | MOVE_FLAG.BITE,
  'firefang': MOVE_FLAG.CONTACT | MOVE_FLAG.BITE,
  'thunderfang': MOVE_FLAG.CONTACT | MOVE_FLAG.BITE,
  'psychicfangs': MOVE_FLAG.CONTACT | MOVE_FLAG.BITE,
  'poisonfang': MOVE_FLAG.CONTACT | MOVE_FLAG.BITE,
  'hyperfang': MOVE_FLAG.CONTACT | MOVE_FLAG.BITE,
  'superfang': MOVE_FLAG.CONTACT | MOVE_FLAG.BITE,
  'flaretail': 0,
  // 拳类
  'megapunch': MOVE_FLAG.CONTACT | MOVE_FLAG.PUNCH,
  'thunderpunch': MOVE_FLAG.CONTACT | MOVE_FLAG.PUNCH,
  'firepunch': MOVE_FLAG.CONTACT | MOVE_FLAG.PUNCH,
  'icepunch': MOVE_FLAG.CONTACT | MOVE_FLAG.PUNCH,
  'drainpunch': MOVE_FLAG.CONTACT | MOVE_FLAG.PUNCH,
  'machpunch': MOVE_FLAG.CONTACT | MOVE_FLAG.PUNCH,
  'bulletpunch': MOVE_FLAG.CONTACT | MOVE_FLAG.PUNCH,
  'cometpunch': MOVE_FLAG.CONTACT | MOVE_FLAG.PUNCH,
  'dynamicpunch': MOVE_FLAG.CONTACT | MOVE_FLAG.PUNCH,
  'focuspunch': MOVE_FLAG.CONTACT | MOVE_FLAG.PUNCH,
  'hammerarm': MOVE_FLAG.CONTACT | MOVE_FLAG.PUNCH,
  'meteormash': MOVE_FLAG.CONTACT | MOVE_FLAG.PUNCH,
  'poweruppunch': MOVE_FLAG.CONTACT | MOVE_FLAG.PUNCH,
  'shadowpunch': MOVE_FLAG.CONTACT | MOVE_FLAG.PUNCH,
  'skyuppercut': MOVE_FLAG.CONTACT | MOVE_FLAG.PUNCH,
  'surgingstrikes': MOVE_FLAG.CONTACT | MOVE_FLAG.PUNCH,
  'wickedblow': MOVE_FLAG.CONTACT | MOVE_FLAG.PUNCH,
  'doubleironbash': MOVE_FLAG.CONTACT | MOVE_FLAG.PUNCH,
  'armthrust': MOVE_FLAG.CONTACT | MOVE_FLAG.PUNCH,
  'jetpunch': MOVE_FLAG.CONTACT | MOVE_FLAG.PUNCH,
  'collisioncourse': MOVE_FLAG.CONTACT | MOVE_FLAG.PUNCH,
  // 波动类
  'aurasphere': MOVE_FLAG.PULSE,
  'darkpulse': MOVE_FLAG.PULSE,
  'dragonpulse': MOVE_FLAG.PULSE,
  'waterpulse': MOVE_FLAG.PULSE,
  'terrainpulse': MOVE_FLAG.PULSE,
  'originpulse': MOVE_FLAG.PULSE,
  // 声音类
  'hypervoice': MOVE_FLAG.SOUND,
  'boomburst': MOVE_FLAG.SOUND,
  'uproar': MOVE_FLAG.SOUND,
  'round': MOVE_FLAG.SOUND,
  'echoedvoice': MOVE_FLAG.SOUND,
  'sing': MOVE_FLAG.SOUND,
  'growl': MOVE_FLAG.SOUND,
  'roar': MOVE_FLAG.SOUND,
  'screech': MOVE_FLAG.SOUND,
  'supersonic': MOVE_FLAG.SOUND,
  'disarmingvoice': MOVE_FLAG.SOUND,
  'sparklingaria': MOVE_FLAG.SOUND,
  'overdrive': MOVE_FLAG.SOUND,
  'clangingscales': MOVE_FLAG.SOUND,
  'clangoroussoul': MOVE_FLAG.SOUND | MOVE_FLAG.CONTACT,
  'psychicnoise': MOVE_FLAG.SOUND,
  'snore': MOVE_FLAG.SOUND,
  // 粉末类
  'stunspore': MOVE_FLAG.POWDER,
  'sleeppowder': MOVE_FLAG.POWDER,
  'poisonpowder': MOVE_FLAG.POWDER,
  'powder': MOVE_FLAG.POWDER,
  'ragepowder': MOVE_FLAG.POWDER,
  'spore': MOVE_FLAG.POWDER,
  // 子弹类
  'bulletseed': MOVE_FLAG.BULLET,
  'seedbomb': MOVE_FLAG.BULLET | MOVE_FLAG.CONTACT,
  'magnetbomb': MOVE_FLAG.BULLET,
  'gyroball': MOVE_FLAG.CONTACT | MOVE_FLAG.BULLET,
  'shadowball': MOVE_FLAG.BULLET,
  'acidspray': MOVE_FLAG.BULLET,
  'electroball': MOVE_FLAG.BULLET,
  'energyball': MOVE_FLAG.BULLET,
  'focusblast': MOVE_FLAG.BULLET,
  'mudbomb': MOVE_FLAG.BULLET,
  'octazooka': MOVE_FLAG.BULLET,
  'iceball': MOVE_FLAG.CONTACT | MOVE_FLAG.BULLET,
  'weatherball': MOVE_FLAG.BULLET,
  'zapcannon': MOVE_FLAG.BULLET,
  'barrage': MOVE_FLAG.BULLET,
  'rockblast': MOVE_FLAG.BULLET,
  // 回复类
  'recover': MOVE_FLAG.HEAL,
  'roost': MOVE_FLAG.HEAL,
  'moonlight': MOVE_FLAG.HEAL,
  'morningsun': MOVE_FLAG.HEAL,
  'synthesis': MOVE_FLAG.HEAL,
  'wish': MOVE_FLAG.HEAL,
  'softboiled': MOVE_FLAG.HEAL,
  'milkdrink': MOVE_FLAG.HEAL,
  'slackoff': MOVE_FLAG.HEAL,
  'shoreup': MOVE_FLAG.HEAL,
  'lifedew': MOVE_FLAG.HEAL,
  'strengthsap': MOVE_FLAG.HEAL,
  'purifying': MOVE_FLAG.HEAL,
  'parabolic:charge': MOVE_FLAG.HEAL,
  'drainpunchh': MOVE_FLAG.CONTACT | MOVE_FLAG.HEAL | MOVE_FLAG.PUNCH,
  'hornleech': MOVE_FLAG.CONTACT | MOVE_FLAG.HEAL,
  'absorb': MOVE_FLAG.HEAL,
  'megaabsorb': MOVE_FLAG.HEAL,
  'gigadrain': MOVE_FLAG.HEAL,
  'leechlife': MOVE_FLAG.CONTACT | MOVE_FLAG.HEAL,
  'drainingkiss': MOVE_FLAG.CONTACT | MOVE_FLAG.HEAL,
  'oblivionwing': MOVE_FLAG.HEAL,
  };

/** 属性名 → PokemonType ID（来自 PMDefine） */
const TYPE_IDS: Record<string, number> = {
  normal: 1, fighting: 2, flying: 3, poison: 4, ground: 5,
  rock: 6, bug: 7, ghost: 8, steel: 9, fire: 10,
  water: 11, grass: 12, electric: 13, psychic: 14, ice: 15,
  dragon: 16, dark: 17, fairy: 18, stellar: 19,
};

/** 天气名 → Weather enum ID */
const WEATHER_IDS: Record<string, number> = {
  raindance: 1, primordialsea: 8, sunnyday: 2, desolateland: 7,
  sandstorm: 3, hail: 4, snowscape: 5, deltastream: 6,
};

/** 场地名 → Terrain enum ID */
const TERRAIN_IDS: Record<string, number> = {
  electric: 1, grassy: 2, misty: 3, psychic: 4,
};

/** 特性名 → AbilityId（来自 AbilityId.ts） */
const ABILITY_IDS: Record<string, number> = {
  adaptability: 91, aerilate: 184, analytic: 148, battlearmor: 4,
  blaze: 66, cheekpouch: 167, chlorophyll: 34, clearbody: 29,
  cloudnine: 13, colorchange: 16, compoundeyes: 14, contrary: 126,
  cutecharm: 56, damp: 6, defeatist: 129, defiant: 128,
  download: 88, drizzle: 2, drought: 70, dryskin: 87,
  earlybird: 48, effects: 78, electricsurge: 226, filter: 111,
  flamebody: 49, flashfire: 18, flowergift: 122, fluffy: 218,
  forecast: 59, friendguard: 132, furcoat: 169, galvanize: 206,
  grassysurge: 229, guts: 62, harvest: 139, heatproof: 85,
  hugepower: 37, hustle: 55, hydration: 93, icescales: 246,
  illuminat: 35, immunity: 17, innerfocus: 39, insomnia: 15,
  intimidate: 22, intrepidsword: 234, ironbarbs: 160, ironfist: 89,
  justified: 154, keeneye: 51, levitate: 26, lightningrod: 31,
  limber: 7, magmaarmor: 40, magnetpull: 42, marvelscale: 63,
  megalauncher: 178, mimicry: 250, minus: 58, mistysurge: 228,
  moldbreaker: 104, moody: 141, motordrive: 78, moxie: 153,
  multiscale: 136, naturalcure: 30, neutralizinggas: 256,
  noguard: 99, normalize: 96, oblivious: 12, overgrow: 65,
  ownpace: 22, pickpocket: 183, pickpocket2: 183, pixilate: 182,
  plus: 57, poisonpoint: 38, poissontouch: 143, prismarmor: 232,
  psychicterrain: 228, psychicsurge: 228, purepower: 74,
  raindish: 44, refrigerate: 174, regenerator: 144, reckless: 120,
  refrigerat: 174, rockhead: 69, roughskin: 24, runoff: 136,
  sandforce: 159, sandrush: 146, sandstream: 45, sandveil: 9,
  sapsipper: 157, scrappy: 113, serenegrace: 32, shadowshield: 231,
  shadows: 151, shedskin: 61, sheerforce: 125, shellarmor: 75,
  shielddust: 19, simple: 86, skilllink: 92, slowstart: 112,
  smartypants: 0, snowcloak: 81, snowwarning: 117, solarpower: 94,
  solidrock: 116, speedboost: 3, stalk: 173, static: 9,
  steadfast: 80, stench: 1, stickyhold: 60, stormdrain: 114,
  strongjaw: 173, sturdy: 5, suctioncups: 24, superluck: 105,
  swarms: 68, swiftswim: 33, synchronize: 28, tangledfeet: 77,
  technician: 101, telepathy: 140, teravolt: 164, thickfat: 47,
  torrent: 67, toughclaws: 181, trace: 36, truant: 54,
  turboblaze: 163, unaware: 109, unburden: 84, unnerving: 146,
  victorystar: 162, vitalcool: 144, voltsorb: 10, voltabsorb: 10,
  waterabsorb: 11, waterveil: 41, weakarmor: 133, whitesmoke: 72,
  wonderguard: 25, wonderskin: 147, zenmode: 167,
  // 简写/别名
  dragonsmaw: 263, drizzles: 2, droughts: 70,
};

// ─── JS 侧查询函数 ──────────────────────────────────────

/**
 * 获取类型克制倍率（用于生成克制描述文本）
 * 返回: 0=完全免疫, 0.25, 0.5, 1, 2, 4 等
 */
export function getTypeEffectiveness(
  moveType: string,
  defenderType1: string,
  defenderType2?: string,
): { multiplier: number; label: string } {
  const wasm = getWasmModule();
  if (!wasm) return { multiplier: 1, label: '—' };

  const moveTypeId = TYPE_IDS[moveType.toLowerCase()] || 0;
  const def1Id = TYPE_IDS[defenderType1.toLowerCase()] || 0;
  const def2Id = defenderType2 ? TYPE_IDS[defenderType2.toLowerCase()] || 0 : 0;

  // 使用 TypeChart 直接计算
  // 用 WASM 起算但简化：直接调用 TypeChart 查询
  const TypeChart = getTypeChart();
  if (!TypeChart) return { multiplier: 1, label: '—' };

  let mult = 1;
  for (const defId of [def1Id, def2Id]) {
    if (defId <= 0 || defId > 19) continue;
    const chartVal = TypeChart[defId]?.[moveTypeId] ?? 0;
    if (chartVal === 3) { mult = 0; break; }
    else if (chartVal === 2) mult *= 0.5;  // 抵抗
    else if (chartVal === 1) mult *= 2;     // 弱点
  }

  let label: string;
  if (mult >= 4) label = `效果绝佳 ×${mult}`;
  else if (mult === 2) label = '效果绝佳';
  else if (mult === 1) label = '通常';
  else if (mult === 0.5) label = '效果不好';
  else if (mult <= 0.25) label = `效果不好 ×${mult}`;
  else if (mult === 0) label = '完全免疫';
  else label = '通常';

  return { multiplier: mult, label };
}

/**
 * 通过 WASM 计算能力值
 */
export function calcStat(
  base: number,
  level: number,
  isHP: boolean,
  iv = 31,
  ev = 0,
  natureMod = 100,
): number {
  const wasm = getWasmModule();
  if (!wasm) return 0;
  try {
    if (isHP) {
      return wasm.calculate_hp(level, base, iv, ev);
    }
    return wasm.calculate_stat(level, base, iv, ev, natureMod);
  } catch {
    return 0;
  }
}

// ─── WASM 懒加载 ────────────────────────────────────────

let _wasm: any = null;
let _wasmPromise: Promise<any> | null = null;
let _typeChart: number[][] | null = null;

async function ensureWasm(): Promise<any> {
  if (_wasm) return _wasm;
  if (!_wasmPromise) {
    _wasmPromise = (async () => {
      try {
        const mod = await import('@/infra/wasm/pkg/zukan_wasm');
        await mod.default(); // 初始化 WASM
        _wasm = mod;
        return mod;
      } catch (e) {
        console.warn('[calc-engine] WASM 加载失败，计算器不可用', e);
        _wasm = null;
        return null;
      }
    })();
  }
  return _wasmPromise;
}

function getWasmModule(): any {
  return _wasm;
}

function getTypeChart(): number[][] | null {
  return _typeChart;
}

// 注入 TypeChart 数据供 JS 侧查询使用
// WASM 内部有完整 TypeChart，这里只给 getTypeEffectiveness 用
async function initTypeChart() {
  if (_typeChart) return;
  try {
    const { TypeChart } = await import('@/core/data/typechart');
    // 将 TypeScript 字符串键的 TypeChart 转为数值索引的数组
    const pmTypeIds: Record<string, number> = {
      bug: 7, dark: 17, dragon: 16, electric: 13, fairy: 18,
      fighting: 2, fire: 10, flying: 3, ghost: 8, grass: 12,
      ground: 5, ice: 15, normal: 1, poison: 4, psychic: 14,
      rock: 6, steel: 9, water: 11, stellar: 19,
    };
    const chart: number[][] = Array.from({ length: 20 }, () => Array(20).fill(0));
    for (const [defName, entry] of Object.entries(TypeChart as Record<string, any>)) {
      const defId = pmTypeIds[defName];
      if (!defId) continue;
      for (const [atkName, val] of Object.entries(entry.damageTaken || {})) {
        const atkId = pmTypeIds[atkName.toLowerCase()];
        if (!atkId) continue;
        chart[defId][atkId] = val as number;
      }
    }
    _typeChart = chart;
  } catch {
    console.warn('[calc-engine] TypeChart 加载失败');
  }
}

// ─── 主计算接口 ─────────────────────────────────────────

export interface CalcParams {
  /* 攻击方 */
  attackerLevel: number;
  attackerAtk: number;
  attackerSpA: number;
  attackerType1: string;
  attackerType2?: string;
  attackerAbility?: string;

  /* 防御方 */
  defenderLevel: number;
  defenderDef: number;
  defenderSpD: number;
  defenderType1: string;
  defenderType2?: string;
  defenderHP?: number;
  defenderAbility?: string;

  /* 招式 */
  movePower: number;
  moveType: string;
  moveCategory: 'physical' | 'special';
  moveName?: string;          // 用于查找招式标志位（接触/拳/啃咬等）

  /* 战场 */
  weather?: string | null;
  terrain?: string | null;
  critical?: boolean;

  /* 能力等级 (默认 0, 范围 -6 ~ 6) */
  attackerAtkStage?: number;
  attackerSpaStage?: number;
  defenderDefStage?: number;
  defenderSpdStage?: number;
}

export interface CalcResult {
  minDamage: number;
  maxDamage: number;
  typeEffectiveness: number;
  effectivenessLabel: string;
  stabMultiplier: number;
  weatherMultiplier: number;
  terrainMultiplier: number;
  attackerAbilityMultiplier: number;
  defenderAbilityMultiplier: number;
  criticalMultiplier: number;
  percentHP: number;
  hkoLabel: string;
}

/**
 * 执行伤害计算
 * 全部在 WASM 中完成计算
 */
export async function calcDamage(params: CalcParams): Promise<CalcResult> {
  const wasm = await ensureWasm();
  if (!wasm) {
    return {
      minDamage: 0, maxDamage: 0,
      typeEffectiveness: 1, effectivenessLabel: 'WASM 未加载',
      stabMultiplier: 1, weatherMultiplier: 1, terrainMultiplier: 1,
      attackerAbilityMultiplier: 1, defenderAbilityMultiplier: 1,
      criticalMultiplier: 1, percentHP: 0, hkoLabel: '—',
    };
  }

  // 转换参数为枚举 ID
  const moveTypeId = TYPE_IDS[params.moveType.toLowerCase()] || 0;
  const atkType1Id = TYPE_IDS[params.attackerType1?.toLowerCase()] || 0;
  const atkType2Id = TYPE_IDS[(params.attackerType2 || '').toLowerCase()] || 0;
  const defType1Id = TYPE_IDS[params.defenderType1?.toLowerCase()] || 0;
  const defType2Id = TYPE_IDS[(params.defenderType2 || '').toLowerCase()] || 0;

  const weatherId = params.weather ? (WEATHER_IDS[params.weather.toLowerCase()] || 0) : 0;
  const terrainId = params.terrain ? (TERRAIN_IDS[params.terrain.toLowerCase()] || 0) : 0;

  const atkAbilityId = params.attackerAbility
    ? (ABILITY_IDS[params.attackerAbility.toLowerCase().replace(/[\s\-]/g, '')] || 0) : 0;
  const defAbilityId = params.defenderAbility
    ? (ABILITY_IDS[params.defenderAbility.toLowerCase().replace(/[\s\-]/g, '')] || 0) : 0;

  const category = params.moveCategory === 'physical' ? 0 : 1;
  const isCritical = params.critical ? 1 : 0;
  const attackStat = params.moveCategory === 'physical' ? params.attackerAtk : params.attackerSpA;
  const defenseStat = params.moveCategory === 'physical' ? params.defenderDef : params.defenderSpD;

  // 招式标志位
  const moveFlags = params.moveName
    ? (MOVE_FLAGS_LOOKUP[params.moveName.toLowerCase().replace(/[\s\-]/g, '')] || 0)
    : 0;

  // 创建 WASM DamageInput
  const input = new wasm.DamageInput(
    params.attackerLevel,
    attackStat,
    defenseStat,
    params.movePower,
    moveTypeId,
    category,
    atkType1Id,
    atkType2Id,
    defType1Id,
    defType2Id,
    weatherId,
    terrainId,
    atkAbilityId,
    defAbilityId,
    isCritical,
    0, // is_burned — 暂不暴露
    moveFlags,
  );

  // 设置能力等级
  if (params.attackerAtkStage) input.with_attacker_atk_stage(params.attackerAtkStage);
  if (params.attackerSpaStage) input.with_attacker_spa_stage(params.attackerSpaStage);
  if (params.defenderDefStage) input.with_defender_def_stage(params.defenderDefStage);
  if (params.defenderSpdStage) input.with_defender_spd_stage(params.defenderSpdStage);

  // 执行批量计算（16 个随机种子）
  const result: BatchDamageResult = wasm.calculate_damage_batch(input);

  const minDamage = result.min;
  const maxDamage = result.max;

  // 击杀回合
  const hp = params.defenderHP ?? 100;
  const percentHP = hp > 0 ? Math.round((maxDamage / hp) * 100) : 0;

  let hkoLabel: string;
  if (maxDamage <= 0) hkoLabel = '—';
  else if (maxDamage >= hp) hkoLabel = 'OHKO';
  else if (maxDamage * 2 >= hp) hkoLabel = '2HKO';
  else if (maxDamage * 3 >= hp) hkoLabel = '3HKO';
  else if (maxDamage * 4 >= hp) hkoLabel = '4HKO';
  else hkoLabel = '5HKO+';

  // 克制倍率描述
  let effectivenessLabel: string;
  if (minDamage === 0 && maxDamage === 0) {
    effectivenessLabel = '完全免疫';
  } else {
    // 需要克制倍率用于显示 — 从 WASM 拿不到就直接用 JS 侧
    const eff = getTypeEffectiveness(params.moveType, params.defenderType1, params.defenderType2);
    effectivenessLabel = eff.label;
  }

  return {
    minDamage,
    maxDamage,
    typeEffectiveness: minDamage === 0 ? 0 : 1,
    effectivenessLabel,
    stabMultiplier: 1,
    weatherMultiplier: 1,
    terrainMultiplier: 1,
    attackerAbilityMultiplier: 1,
    defenderAbilityMultiplier: 1,
    criticalMultiplier: isCritical ? 1.5 : 1,
    percentHP,
    hkoLabel,
  };
}

// 初始化
initTypeChart();