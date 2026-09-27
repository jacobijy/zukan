/**
 * 对战数据 · 招式英文引用名 → 属性 / 分类反查。
 *
 * meta 的招式行（`rows.move[].name`）是英文引用名（如 "Double-Edge"），属性 / 分类在
 * 图鉴 MDAT 招式列表（`services/pokemon/archive.ts::loadMoveList()`，行带 typeId、
 * damageClassId）。这里用**英文名称表**（i18n names, en 的 moves 表：id → enName）把
 * 英文名反查成 move id，再 join 招式列表。
 *
 * 重依赖（resourceManager / pokemon archive）刻意 **动态 import**，让本模块顶层无平台 /
 * 加密依赖，下面的纯函数可直接在 node 测试环境 import。
 */
import { buildNamesLookup } from '@/services/i18n/lookup';
import type { MoveListRow } from '@/services/pokemon/archive';

/** 反查命中的招式数值（只留 UI 需要的两列）。 */
export interface MoveMetaLookup {
    typeId: number;
    /** move_damage_classes：1=状态 2=物理 3=特殊 */
    damageClassId: number;
}

/** 规范化：小写 + 只保留字母数字（容忍空格 / 连字符 / 大小写差异）。 */
export function normalize(s: string): string {
    return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * 招式列表 + 英文名称表 → `normalize(enName) → { typeId, damageClassId }` 反查索引。
 * 规范化后碰撞时先到先得；英文名缺失的招式不入表。
 */
export function buildMoveMetaIndex(moveList: MoveListRow[], enNames: Map<number, string>): Map<string, MoveMetaLookup> {
    const index = new Map<string, MoveMetaLookup>();
    for (const m of moveList) {
        const enName = enNames.get(m.id);
        if (!enName) continue;
        const key = normalize(enName);
        if (key && !index.has(key)) {
            index.set(key, { typeId: m.typeId, damageClassId: m.damageClassId });
        }
    }
    return index;
}

let indexPromise: Promise<Map<string, MoveMetaLookup>> | null = null;
let resolvedIndex: Map<string, MoveMetaLookup> | null = null;

async function loadIndex(): Promise<Map<string, MoveMetaLookup>> {
    const [{ resourceManager }, { loadMoveList }] = await Promise.all([
        import('@/services/resources/resourceManager'),
        import('@/services/pokemon/archive'),
    ]);
    const bundle = await resourceManager.getI18nNames('en');
    const enNames = buildNamesLookup(bundle).moves;
    const moveList = await loadMoveList();
    const index = buildMoveMetaIndex(moveList, enNames);
    resolvedIndex = index;
    return index;
}

/** 确保反查索引就绪（module 单例，并发共享同一次 promise）。 */
export function ensureMoveRefs(): Promise<void> {
    if (!indexPromise) indexPromise = loadIndex();
    return indexPromise.then(() => undefined);
}

/** 同步解析招式属性 / 分类；`ensureMoveRefs` 完成前 / 查无返回 undefined。 */
export function resolveMoveMeta(enName: string): MoveMetaLookup | undefined {
    return resolvedIndex?.get(normalize(enName));
}
