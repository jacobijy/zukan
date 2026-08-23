/**
 * EVO1 进化树 → 详情页 `EvolutionStage` 树
 *
 * bundle 三张定长 struct 数组按下标寻址（见 docs/data/bundle-decode.md §EVO1）：
 * `species[species_id - 1]` → 上溯链根（parentSpecies）/ 下钻子树（edges）。
 *
 * 遍历是纯函数（`buildEvolutionChain`），名称与触发文案通过 `EvolutionResolvers`
 * 注入，方便单测；`loadEvolutionChain` 负责取 bundle、从 i18n/pokemon store
 * 组装 resolver，并在旧后端未产出 evolution.bin（404）时静默返回 null。
 */
import { resourceManager } from '@/services/resources/resourceManager';
import { BinaryRequestError } from '@/services/http';
import type { EvolutionBundle, EvolutionDetail } from '@/infra/wasm';

/** is_default 位：该版本组下的默认进化路径，展示优先取这条 */
const FLAG_DEFAULT = 0x10;
const FLAG_RAIN = 0x01;
const FLAG_UPSIDE_DOWN = 0x02;
const FLAG_MULTIPLAYER = 0x04;
const FLAG_NEAR_SPECIAL_ROCK = 0x08;

/** 把数值 detail 解析成展示文案；全部缺失时返回空对象 */
export interface EvolutionResolvers {
    /** species id → 默认形态 pokemon id（用于立绘 / 跳转） */
    defaultPokemonId: (speciesId: number) => number;
    /** species id → 物种名 */
    speciesName: (speciesId: number) => string | null;
    /** item id → 道具名 */
    itemName: (id: number) => string | null;
    /** move id → 招式名 */
    moveName: (id: number) => string | null;
    /** evolution_trigger id → 名称 */
    triggerName: (id: number) => string | null;
    /** region id → 地区名 */
    regionName: (id: number) => string | null;
}

const TIME_OF_DAY: Record<number, string> = {
    1: '白天',
    2: '夜晚',
    3: '黄昏',
    4: '满月',
};

const GENDER: Record<number, string> = {
    1: '雌性',
    2: '雄性',
};

const RELATIVE_PHYSICAL: Record<number, string> = {
    1: '攻击 < 防御',
    2: '攻击 = 防御',
    3: '攻击 > 防御',
};

/**
 * 选一条分支上要展示的 detail：优先 is_default，否则取第一条。
 * 跨版本组可能有多条（如叶伊布「苔藓岩石」/「叶之石」），其余作为其他方式暂不展开。
 */
function pickDetail(
    bundle: EvolutionBundle,
    edge: { detailStart: number; detailCount: number },
): EvolutionDetail | null {
    if (edge.detailCount === 0) return null;
    const start = edge.detailStart;
    for (let i = 0; i < edge.detailCount; i++) {
        const d = bundle.details[start + i];
        if (d && d.flags & FLAG_DEFAULT) return d;
    }
    return bundle.details[start] ?? null;
}

/** 把一条触发条件转成 { level?, triggerText? }；等级触发优先填 level */
function describeDetail(d: EvolutionDetail, r: EvolutionResolvers): { level?: number; triggerText?: string } {
    if (d.minimumLevel > 0) return { level: d.minimumLevel };

    const parts: string[] = [];

    // 触发道具（使用道具进化，如水之石）
    if (d.triggerItem) {
        const n = r.itemName(d.triggerItem);
        if (n) parts.push(n);
    }

    // 通信交换
    if (d.tradeSpecies || d.triggerId === 2) {
        const base = r.triggerName(2) ?? '通信交换';
        const withName = d.tradeSpecies ? r.speciesName(d.tradeSpecies) : null;
        parts.push(withName ? `${base}（${withName}）` : base);
    }

    // 升级触发的各种附加条件
    if (d.minimumHappiness > 0) parts.push(`亲密度 ≥ ${d.minimumHappiness}`);
    if (d.minimumBeauty > 0) parts.push(`美丽度 ≥ ${d.minimumBeauty}`);
    if (d.minimumAffection > 0) parts.push(`羁绊值 ≥ ${d.minimumAffection}`);
    if (d.minimumSteps > 0) parts.push(`行走 ${d.minimumSteps} 步`);
    if (d.minimumMoveCount > 0) parts.push(`学会 ${d.minimumMoveCount} 种招式`);
    if (d.knownMove) {
        const n = r.moveName(d.knownMove);
        if (n) parts.push(`学会「${n}」`);
    }
    if (d.partySpecies) {
        const n = r.speciesName(d.partySpecies);
        if (n) parts.push(`同行 ${n}`);
    }
    if (d.heldItem) {
        const n = r.itemName(d.heldItem);
        if (n) parts.push(`携带 ${n}`);
    }
    if (d.location) parts.push('特定地点');
    if (d.gender) {
        const g = GENDER[d.gender];
        if (g) parts.push(g);
    }
    if (d.timeOfDay) {
        const t = TIME_OF_DAY[d.timeOfDay];
        if (t) parts.push(t);
    }
    if (d.relativePhysicalStats) {
        const rel = RELATIVE_PHYSICAL[d.relativePhysicalStats];
        if (rel) parts.push(rel);
    }
    if (d.region) {
        const n = r.regionName(d.region);
        if (n) parts.push(n);
    }
    if (d.knownMoveType) parts.push('特定属性招式');
    if (d.partyType) parts.push('同行特定属性');
    if (d.flags & FLAG_RAIN) parts.push('雨中升级');
    if (d.flags & FLAG_UPSIDE_DOWN) parts.push('倒置主机');
    if (d.flags & FLAG_MULTIPLAYER) parts.push('附近有玩家');
    if (d.flags & FLAG_NEAR_SPECIAL_ROCK) parts.push('特殊磁场附近');

    // 无任何具体条件时回落触发器名（如「蜕皮」）
    if (parts.length === 0 && d.triggerId) {
        const n = r.triggerName(d.triggerId);
        if (n) parts.push(n);
    }

    return parts.length ? { triggerText: parts.join(' · ') } : {};
}

/**
 * 从指定物种展开整棵进化链，返回链根节点。
 * 孤立物种（无 parent 也无 edges）返回只有自己的单节点。
 */
export function buildEvolutionChain(
    bundle: EvolutionBundle,
    speciesId: number,
    r: EvolutionResolvers,
): EvolutionStage | null {
    if (!speciesId || speciesId < 1 || speciesId > bundle.species.length) return null;

    // 上溯到链根
    let rootId = speciesId;
    let guard = 0;
    while (guard++ < 64) {
        const sp = bundle.species[rootId - 1];
        if (!sp || sp.parentSpecies === 0) break;
        rootId = sp.parentSpecies;
    }

    const visited = new Set<number>();

    const makeNode = (sid: number): EvolutionStage => {
        visited.add(sid);
        const node: EvolutionStage = {
            id: r.defaultPokemonId(sid) || sid,
        };
        const name = r.speciesName(sid);
        if (name) node.name = name;

        const sp = bundle.species[sid - 1];
        if (sp && sp.edgeCount > 0) {
            const children: EvolutionStage[] = [];
            for (let i = 0; i < sp.edgeCount; i++) {
                const edge = bundle.edges[sp.edgeStart + i];
                if (!edge) continue;
                if (visited.has(edge.targetSpecies)) continue;
                const child = makeNode(edge.targetSpecies);
                const detail = pickDetail(bundle, edge);
                if (detail) {
                    const { level, triggerText } = describeDetail(detail, r);
                    if (level != null) child.level = level;
                    if (triggerText) child.triggerText = triggerText;
                }
                children.push(child);
            }
            if (children.length) node.children = children;
        }
        return node;
    };

    return makeNode(rootId);
}

/**
 * 加载某物种的进化链。组装 i18n / pokemon store 作为 resolver。
 * - bundle 404（旧后端未产出 evolution.bin）→ 返回 null（UI 显示「暂无进化数据」）
 * - 其他错误向上抛，由调用方决定是否静默
 */
export async function loadEvolutionChain(speciesId: number): Promise<EvolutionStage | null> {
    let bundle: EvolutionBundle;
    try {
        bundle = await resourceManager.getEvolution();
    } catch (err) {
        if (err instanceof BinaryRequestError && err.statusCode === 404) {
            return null;
        }
        throw err;
    }

    // 动态 import 打断 evolution service → store/pokemon、store/i18n 的潜在环
    const [{ usePokemonStore }, { useI18nStore }] = await Promise.all([
        import('@/store/pokemon'),
        import('@/store/i18n'),
    ]);
    const pokemonStore = usePokemonStore();
    const i18n = useI18nStore();

    // species → 默认形态 pokemon id：gen-9 的 allPokemons 覆盖全部 1025 物种
    const defaultIdBySpecies = new Map<number, number>();
    for (const p of pokemonStore.allPokemons) {
        if (p.isDefault && p.speciesId) defaultIdBySpecies.set(p.speciesId, p.id);
    }

    const resolvers: EvolutionResolvers = {
        defaultPokemonId: (sid) => defaultIdBySpecies.get(sid) ?? sid,
        speciesName: (sid) => i18n.speciesName(sid),
        itemName: (id) => i18n.itemName(id),
        moveName: (id) => i18n.moveName(id),
        triggerName: (id) => i18n.evolutionTriggerName(id),
        regionName: (id) => i18n.regionName(id),
    };

    return buildEvolutionChain(bundle, speciesId, resolvers);
}
