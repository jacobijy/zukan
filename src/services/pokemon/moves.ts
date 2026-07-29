/**
 * 招式数据加载与拼接
 *
 * 给定 pokemonId → 返回 UI 消费的 `MoveRecord[]`（升级 / 机器 / 蛋 / 教授四类）。
 *
 * 数据源（vg-25 朱紫基线，不做 merge、不做 gen→vg 映射）：
 * - `pokemon_moves/common.bin` → 每宝可梦聚合的 4 类学习方式向量
 * - `moves_data/common.bin`   → 全量 `Move` 定义（type / power / accuracy / category）
 *
 * ## 缓存
 * `resourceManager` 已有 storage / memoryCache / inflight 三层；本模块额外把
 * `Map<moveId, Move>` 索引留在 module scope（`moveIndexPromise`），跨详情页复用。
 */
import { resourceManager } from '@/services/resources/resourceManager';
import { typeStrs } from '@/utils/helpers';
import type { Move, PokemonMoveSet } from '@/infra/wasm';

/** `Move.damageClassId` → 中文分类；未命中显示 '—' */
const CATEGORY_MAP: Record<number, string> = {
    1: '状态',
    2: '物理',
    3: '特殊',
};

let moveIndexPromise: Promise<Map<number, Move>> | null = null;

async function getMoveIndex(): Promise<Map<number, Move>> {
    if (moveIndexPromise) return moveIndexPromise;
    moveIndexPromise = (async () => {
        const md = await resourceManager.getMovesData('common');
        const map = new Map<number, Move>();
        for (const m of md.moves) map.set(m.id, m);
        return map;
    })();
    // 失败时清 promise，下次调用可以重试
    moveIndexPromise.catch(() => {
        moveIndexPromise = null;
    });
    return moveIndexPromise;
}

function toRecord(
    moveId: number,
    moveIndex: Map<number, Move>,
    learnMethod: MoveRecord['learnMethod'],
    level?: number,
): MoveRecord {
    const m = moveIndex.get(moveId);
    return {
        id: moveId,
        // TODO(i18n): i18n bundle 上线后换成真中文名
        name: `move-${moveId}`,
        type: m ? (typeStrs[m.typeId] ?? 'normal') : 'normal',
        category: m ? (CATEGORY_MAP[m.damageClassId] ?? '—') : '—',
        power: m && m.power > 0 ? m.power : '—',
        accuracy: m && m.accuracy > 0 ? m.accuracy : '—',
        learnMethod,
        level,
    };
}

/**
 * 拉取并拼接指定宝可梦（form id）的招式表。
 * 未登记的 id 返回空数组；不抛出。
 */
export async function loadMovesForPokemon(pokemonId: number): Promise<MoveRecord[]> {
    const [pmBundle, moveIndex] = await Promise.all([resourceManager.getPokemonMoves('common'), getMoveIndex()]);

    const set: PokemonMoveSet | undefined = pmBundle.entries.find((e) => e.pokemonId === pokemonId);
    if (!set) return [];

    const out: MoveRecord[] = [];
    for (const lv of set.levelUp) {
        out.push(toRecord(lv.moveId, moveIndex, 'level-up', lv.level));
    }
    for (const id of set.machine) out.push(toRecord(id, moveIndex, 'machine'));
    for (const id of set.egg) out.push(toRecord(id, moveIndex, 'egg'));
    for (const id of set.tutor) out.push(toRecord(id, moveIndex, 'tutor'));

    return out;
}
