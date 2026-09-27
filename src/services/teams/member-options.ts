/**
 * 成员选项服务：按形态取“可选特性 id”与“可学招式池（去重）”。
 *
 * 数据经 resourceManager 读 gen-9 全形态快照（abilityEntries），招式复用
 * services/pokemon 的 loadMovesForPokemon。**缓存在本模块（module promise）**，
 * 组件层只调 API。纯函数 buildAbilityIds / dedupeMoveRecords 无平台依赖，可单测。
 *
 * 注意：模型（IPokemonBaseModel）里的 abilities 是“已解析名字”，持久化要存稳定 id，
 * 故这里直接从 bundle.abilityEntries 读 ability1Id / ability2Id / abilityHiddenId。
 */
import { resourceManager } from '@/services/resources/resourceManager';
import { loadMovesForPokemon } from '@/services/pokemon';

/** gen 快照代次：与 store/pokemon DEFAULT_GEN_ID / archive ARCHIVE_GEN_ID 一致 */
const GEN_ID = 9;

export interface AbilityIds {
    ability1: number | null;
    ability2: number | null;
    hidden: number | null;
}

interface AbilityEntryLike {
    id: number;
    ability1Id: number;
    ability2Id: number;
    abilityHiddenId: number;
}

/** 从形态 ability 行构造特性 id；0 / 非正 → null。纯函数。 */
export function buildAbilityIds(entry: AbilityEntryLike | undefined): AbilityIds {
    const orNull = (n: unknown): number | null => (typeof n === 'number' && n > 0 ? n : null);
    return {
        ability1: orNull(entry?.ability1Id),
        ability2: orNull(entry?.ability2Id),
        hidden: orNull(entry?.abilityHiddenId),
    };
}

let abilityEntriesPromise: Promise<Map<number, AbilityEntryLike>> | null = null;

function getAbilityEntries(): Promise<Map<number, AbilityEntryLike>> {
    if (abilityEntriesPromise) return abilityEntriesPromise;
    abilityEntriesPromise = resourceManager.getPokemonGen(GEN_ID).then((bundle) => {
        const map = new Map<number, AbilityEntryLike>();
        for (const a of bundle.abilityEntries) {
            map.set(a.id, a as unknown as AbilityEntryLike);
        }
        return map;
    });
    abilityEntriesPromise.catch(() => {
        abilityEntriesPromise = null;
    });
    return abilityEntriesPromise;
}

/** 某形态的可选特性 id（未登记 / 全 0 → 各槽 null）。 */
export async function loadAbilityIdsForForm(formId: number): Promise<AbilityIds> {
    const entries = await getAbilityEntries();
    return buildAbilityIds(entries.get(formId));
}

/** 招式记录按 id 去重保序（loadMovesForPokemon 跨学习方式不去重，同一招可能出现多次）。纯函数。 */
export function dedupeMoveRecords(records: MoveRecord[]): MoveRecord[] {
    const seen = new Set<number>();
    const out: MoveRecord[] = [];
    for (const r of records) {
        if (seen.has(r.id)) continue;
        seen.add(r.id);
        out.push(r);
    }
    return out;
}

/** 某形态的可学招式池（按 id 去重）。 */
export async function loadMovePoolForForm(formId: number): Promise<MoveRecord[]> {
    const records = await loadMovesForPokemon(formId);
    return dedupeMoveRecords(records);
}
