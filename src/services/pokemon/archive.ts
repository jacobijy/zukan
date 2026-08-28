/**
 * 资料中心「图鉴栏目」聚合服务：招式全量列表、特性/属性 → 宝可梦反查索引。
 *
 * 数据源：
 * - 招式：`moves_data/common.bin`（MDAT）的 `moves` 表，含威力/命中/PP/
 *   先制/分类/目标等数值；名称由组件按 id 响应式查 i18n 名称表。
 * - 特性/属性反查：`gen-9.bin`（PKMB）的 abilityEntries / typeEntries
 *   join baseEntries，只取**默认形态**（isDefault）按 speciesId 去重——
 *   gen-N.bin 是全形态快照，直接按行聚合会把同一物种的形态各计一次。
 *
 * 缓存：`resourceManager` 已有三层缓存，本模块额外把聚合结果留在
 * module scope（promise 单例，失败清空可重试），跨列表页/详情页复用。
 * 纯聚合部分（build*）不碰网络/存储，方便单测。
 */
import { resourceManager } from '@/services/resources/resourceManager';
import { typeStrs } from '@/utils/helpers';
import type { Move, PokemonGenBundle } from '@/infra/wasm';

/** 图鉴快照代次：与 store/pokemon.ts 的 DEFAULT_GEN_ID 保持一致 */
const ARCHIVE_GEN_ID = 9;

// ── 招式列表 ──

export interface MoveListRow {
    id: number;
    typeId: number;
    /** 0 = 无固定伤害（状态招） */
    power: number;
    /** 0 = 必中 */
    accuracy: number;
    pp: number;
    /** -7..+5 */
    priority: number;
    /** move_damage_classes：1=状态 2=物理 3=特殊 */
    damageClassId: number;
    targetId: number;
}

/** 从 MDAT moves 表构建列表行：滤掉 id<=0 的占位行，按 id 升序。纯函数。 */
export function buildMoveList(moves: Move[]): MoveListRow[] {
    return moves
        .filter((m) => m.id > 0)
        .map((m) => ({
            id: m.id,
            typeId: m.typeId,
            power: m.power,
            accuracy: m.accuracy,
            pp: m.pp,
            priority: m.priority,
            damageClassId: m.damageClassId,
            targetId: m.targetId,
        }))
        .toSorted((a, b) => a.id - b.id);
}

let moveListPromise: Promise<MoveListRow[]> | null = null;

/** 全量招式列表（vg 基线 common.bin）；module 级 promise 缓存，失败可重试。 */
export function loadMoveList(): Promise<MoveListRow[]> {
    if (moveListPromise) return moveListPromise;
    moveListPromise = (async () => {
        const md = await resourceManager.getMovesData('common');
        return buildMoveList(md.moves);
    })();
    moveListPromise.catch(() => {
        moveListPromise = null;
    });
    return moveListPromise;
}

// ── 特性 → 宝可梦反查 ──

interface BaseLike {
    id: number;
    speciesId: number;
    isDefault: boolean;
}
interface AbilityLike {
    id: number;
    ability1Id: number;
    ability2Id: number;
    abilityHiddenId: number;
}
interface TypeLike {
    id: number;
    type1Id: number;
    type2Id: number;
}

/** abilityId → 拥有该特性的 speciesId 列表（升序去重）。纯函数。 */
export function buildAbilityIndex(parts: { base: BaseLike[]; abilities: AbilityLike[] }): Map<number, number[]> {
    const abilityById = new Map(parts.abilities.map((a) => [a.id, a]));
    const index = new Map<number, Set<number>>();
    for (const b of parts.base) {
        if (!b.isDefault) continue;
        const a = abilityById.get(b.id);
        if (!a) continue;
        // 三个槽位（普特 1/2 + 隐藏特性）都计入，OR 聚合
        for (const abilityId of [a.ability1Id, a.ability2Id, a.abilityHiddenId]) {
            if (!abilityId) continue;
            const set = index.get(abilityId);
            if (set) set.add(b.speciesId);
            else index.set(abilityId, new Set([b.speciesId]));
        }
    }
    return toSortedIndex(index);
}

// ── 属性 → 宝可梦反查 ──

/** 属性 slug → 拥有该属性（含双属性，OR）的 speciesId 列表（升序去重）。纯函数。 */
export function buildTypePokemonIndex(parts: { base: BaseLike[]; types: TypeLike[] }): Map<string, number[]> {
    const typeById = new Map(parts.types.map((t) => [t.id, t]));
    const index = new Map<string, Set<number>>();
    for (const b of parts.base) {
        if (!b.isDefault) continue;
        const t = typeById.get(b.id);
        if (!t) continue;
        // 双属性宝可梦同时进两个属性索引
        for (const typeId of [t.type1Id, t.type2Id]) {
            const slug = typeId ? (typeStrs[typeId] ?? null) : null;
            if (!slug) continue;
            const set = index.get(slug);
            if (set) set.add(b.speciesId);
            else index.set(slug, new Set([b.speciesId]));
        }
    }
    return toSortedIndex(index);
}

function toSortedIndex<V>(index: Map<V, Set<number>>): Map<V, number[]> {
    const out = new Map<V, number[]>();
    for (const [key, set] of index) {
        out.set(
            key,
            [...set].toSorted((a, b) => a - b),
        );
    }
    return out;
}

let abilityIndexPromise: Promise<Map<number, number[]>> | null = null;
let typeIndexPromise: Promise<Map<string, number[]>> | null = null;

/** abilityId → speciesId[]（gen9 默认形态）；module 级 promise 缓存。 */
export function loadAbilityPokemonIndex(): Promise<Map<number, number[]>> {
    if (abilityIndexPromise) return abilityIndexPromise;
    abilityIndexPromise = loadGenBundle().then((bundle) =>
        buildAbilityIndex({ base: bundle.baseEntries, abilities: bundle.abilityEntries }),
    );
    abilityIndexPromise.catch(() => {
        abilityIndexPromise = null;
    });
    return abilityIndexPromise;
}

/** type slug → speciesId[]（gen9 默认形态）；module 级 promise 缓存。 */
export function loadTypePokemonIndex(): Promise<Map<string, number[]>> {
    if (typeIndexPromise) return typeIndexPromise;
    typeIndexPromise = loadGenBundle().then((bundle) =>
        buildTypePokemonIndex({ base: bundle.baseEntries, types: bundle.typeEntries }),
    );
    typeIndexPromise.catch(() => {
        typeIndexPromise = null;
    });
    return typeIndexPromise;
}

function loadGenBundle(): Promise<PokemonGenBundle> {
    return resourceManager.getPokemonGen(ARCHIVE_GEN_ID);
}
