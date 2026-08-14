/** 计算器数据常量。纯数据，不包含 ref/state/emit 等运行时绑定。 */

import { MOVE_FLAG } from './calc-engine';

// ─── 天气 ─────────────────────────────────────────────
export interface WeatherOption {
    id: string;
    label: string;
}
export const WEATHER_OPTIONS: WeatherOption[] = [
    { id: '', label: '无' },
    { id: 'sunnyday', label: '晴天' },
    { id: 'raindance', label: '雨天' },
    { id: 'sandstorm', label: '沙暴' },
    { id: 'hail', label: '冰雹' },
    { id: 'snowscape', label: '雪景' },
];

// ─── 场地 ─────────────────────────────────────────────
export interface TerrainOption {
    id: string;
    label: string;
}
export const TERRAIN_OPTIONS: TerrainOption[] = [
    { id: '', label: '无' },
    { id: 'electric', label: '电气' },
    { id: 'grassy', label: '草地' },
    { id: 'misty', label: '薄雾' },
    { id: 'psychic', label: '精神' },
];

// ─── 特性 ─────────────────────────────────────────────
export const COMMON_ABILITIES = [
    '无',
    '大力士',
    '瑜伽之力',
    '活力',
    '毅力',
    '猛火',
    '激流',
    '茂盛',
    '虫警',
    '铁拳',
    '强壮之颚',
    '分析',
    '适应力',
    '技术高手',
    '降雪',
    '降雨',
    '干旱',
    '扬沙',
    '厚脂肪',
    '过滤',
    '坚石',
    '棱镜装甲',
    '多重鳞片',
    '毛皮大衣',
    '冰鳞粉',
    '毛茸茸',
    '肥脂',
    '引火',
    '蓄电',
    '储水',
    '飘浮',
    '神奇守护',
    '破格',
    '纯朴',
    '无关天气',
];

export const ABILITY_NAME_MAP: Record<string, string> = {
    无: '无',
    大力士: 'hugepower',
    瑜伽之力: 'purepower',
    活力: 'hustle',
    毅力: 'guts',
    猛火: 'blaze',
    激流: 'torrent',
    茂盛: 'overgrow',
    虫警: 'swarm',
    铁拳: 'ironfist',
    强壮之颚: 'strongjaw',
    分析: 'analytic',
    适应力: 'adaptability',
    技术高手: 'technician',
    降雪: 'snowwarning',
    降雨: 'drizzle',
    干旱: 'drought',
    扬沙: 'sandstream',
    厚脂肪: 'thickfat',
    过滤: 'filter',
    坚石: 'solidrock',
    棱镜装甲: 'prismarmor',
    多重鳞片: 'multiscale',
    毛皮大衣: 'furcoat',
    冰鳞粉: 'icescales',
    毛茸茸: 'fluffy',
    肥脂: 'heatproof',
    引火: 'flashfire',
    蓄电: 'voltabsorb',
    储水: 'waterabsorb',
    飘浮: 'levitate',
    神奇守护: 'wonderguard',
    破格: 'moldbreaker',
    纯朴: 'unaware',
    无关天气: 'cloudnine',
};

export const getAbilityName = (name: string): string => ABILITY_NAME_MAP[name] || '无';

// ─── 招式 ─────────────────────────────────────────────
export interface MoveOption {
    key: string;
    name: string;
    power: number;
    type: string;
    category: 'physical' | 'special';
    flags: number;
}

export const COMMON_MOVES: MoveOption[] = [
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
    {
        key: 'closecombat',
        name: '近身战',
        power: 120,
        type: 'fighting',
        category: 'physical',
        flags: MOVE_FLAG.CONTACT,
    },
    { key: 'aurasphere', name: '波导弹', power: 80, type: 'fighting', category: 'special', flags: MOVE_FLAG.PULSE },
    {
        key: 'drainpunch',
        name: '吸取拳',
        power: 75,
        type: 'fighting',
        category: 'physical',
        flags: MOVE_FLAG.CONTACT | MOVE_FLAG.PUNCH | MOVE_FLAG.HEAL,
    },
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
    {
        key: 'thunderpunch',
        name: '雷电拳',
        power: 75,
        type: 'electric',
        category: 'physical',
        flags: MOVE_FLAG.CONTACT | MOVE_FLAG.PUNCH,
    },
    {
        key: 'icepunch',
        name: '冰冻拳',
        power: 75,
        type: 'ice',
        category: 'physical',
        flags: MOVE_FLAG.CONTACT | MOVE_FLAG.PUNCH,
    },
    {
        key: 'firepunch',
        name: '火焰拳',
        power: 75,
        type: 'fire',
        category: 'physical',
        flags: MOVE_FLAG.CONTACT | MOVE_FLAG.PUNCH,
    },
    {
        key: 'crunch',
        name: '咬碎',
        power: 80,
        type: 'dark',
        category: 'physical',
        flags: MOVE_FLAG.CONTACT | MOVE_FLAG.BITE,
    },
    {
        key: 'icefang',
        name: '冰冻牙',
        power: 65,
        type: 'ice',
        category: 'physical',
        flags: MOVE_FLAG.CONTACT | MOVE_FLAG.BITE,
    },
    {
        key: 'firefang',
        name: '火焰牙',
        power: 65,
        type: 'fire',
        category: 'physical',
        flags: MOVE_FLAG.CONTACT | MOVE_FLAG.BITE,
    },
    {
        key: 'psychicfangs',
        name: '精神之牙',
        power: 85,
        type: 'psychic',
        category: 'physical',
        flags: MOVE_FLAG.CONTACT | MOVE_FLAG.BITE,
    },
];

// ─── 道具 ─────────────────────────────────────────────
export interface ItemOption {
    id: string;
    label: string;
    mod: number;
}
export const ITEM_OPTIONS: ItemOption[] = [
    { id: 'none', label: '无', mod: 100 },
    { id: 'lifeorb', label: '生命宝珠', mod: 130 },
    { id: 'choiceband', label: '讲究头带', mod: 150 },
    { id: 'choicespecs', label: '讲究眼镜', mod: 150 },
    { id: 'choicescarf', label: '讲究围巾', mod: 150 },
    { id: 'experthand', label: '达人带', mod: 120 },
    { id: 'muscleband', label: '力量头带', mod: 110 },
    { id: 'wiseglasses', label: '智慧眼镜', mod: 110 },
    { id: 'typeboost', label: '木炭/水滴等', mod: 120 },
];

export const getItemMod = (id: string): number => ITEM_OPTIONS.find((i) => i.id === id)?.mod ?? 100;

// ─── 防护 ─────────────────────────────────────────────
export interface ScreenOption {
    id: string;
    label: string;
}
export const SCREEN_OPTIONS: ScreenOption[] = [
    { id: 'none', label: '无' },
    { id: 'reflect', label: '反射壁' },
    { id: 'lightscreen', label: '光墙' },
    { id: 'auroraveil', label: '极光幕' },
];

// ─── 状态（多选） ─────────────────────────────────────
export interface StatusOption {
    id: string;
    label: string;
}
export const STATUS_OPTIONS: StatusOption[] = [
    { id: 'burn', label: '烧伤' },
    { id: 'critical', label: '会心' },
];
