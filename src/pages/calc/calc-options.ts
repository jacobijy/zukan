/** 计算器数据常量。纯数据，不包含 ref/state/emit 等运行时绑定。 */

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
    /** pokeapi 招式 id，calc-engine 据此查 moveFlagMap */
    id: number;
    name: string;
    power: number;
    type: string;
    category: 'physical' | 'special';
}

/** MoveRecord 显示分类 → 计算引擎分类；状态/未知返回 null（不进计算器） */
const CATEGORY_TO_ENGINE: Record<string, 'physical' | 'special' | null> = {
    物理: 'physical',
    特殊: 'special',
    状态: null,
    '—': null,
};

/**
 * 把某只宝可梦的技能池（`loadMovesForPokemon` 的 MoveRecord[]）转成计算器
 * 招式选项：只留物理 / 特殊的伤害招式（威力为正），按 moveId 去重（升级/机器/
 * 蛋招会重复），名称经 `nameOf` 查 i18n（未就绪回落 `move-{id}`）。
 * 纯函数，便于单测。
 */
export function toCalcMoveOptions(records: MoveRecord[], nameOf: (id: number) => string | null): MoveOption[] {
    const seen = new Set<number>();
    const out: MoveOption[] = [];
    for (const r of records) {
        const category = CATEGORY_TO_ENGINE[r.category];
        if (!category) continue;
        const power = typeof r.power === 'number' ? r.power : Number(r.power);
        if (!Number.isFinite(power) || power <= 0) continue;
        if (seen.has(r.id)) continue;
        seen.add(r.id);
        out.push({
            id: r.id,
            name: nameOf(r.id) ?? `move-${r.id}`,
            power,
            type: r.type,
            category,
        });
    }
    return out;
}

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
export const getItemLabel = (id: string): string => ITEM_OPTIONS.find((i) => i.id === id)?.label ?? '无';

// ─── 防御方道具 ─────────────────────────────────────────
// 攻击道具走 itemMod 平乘伤害；防御道具是带触发条件的行为（加防能力值 / 克制减伤），
// 逻辑在 WASM 内（calculator.rs）。这里只存 string id ↔ Rust DEF_ITEM_* 数字 id 的映射，
// wasmId 是 Rust↔JS ABI，新增时必须与 calculator.rs 的 DEF_ITEM_* 常量对齐。
export interface DefItemOption {
    id: string;
    label: string;
    /** Rust DEF_ITEM_* 常量值 */
    wasmId: number;
}

export const DEF_ITEM_OPTIONS: DefItemOption[] = [
    { id: 'none', label: '无', wasmId: 0 },
    { id: 'eviolite', label: '进化奇石', wasmId: 1 },
    { id: 'assaultvest', label: '突击背心', wasmId: 2 },
    { id: 'resistberry', label: '抗性树果', wasmId: 3 },
];

export const getDefItemWasmId = (id: string): number => DEF_ITEM_OPTIONS.find((i) => i.id === id)?.wasmId ?? 0;
export const getDefItemLabel = (id: string): string => DEF_ITEM_OPTIONS.find((i) => i.id === id)?.label ?? '无';

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
