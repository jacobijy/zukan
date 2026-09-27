/**
 * 「套用对战热门配置」：按 species + format 从 meta 对战数据生成成员配置补丁。
 *
 * meta rows 里的 name 是**英文引用名**，用英文 i18n 名称 bundle 反查成稳定 id；
 * species→slug 由 link 映射反查。各段独立、解不出的单项跳过。
 * 该物种不在 meta（约 263 slug 之外）或一段都解不出 → 返回 null（UI 提示不可用）。
 *
 * 纯网络编排，无 Vue 依赖；纯工具 invertNameMap / toNatureSlug 可单测。
 */
import { resourceManager } from '@/services/resources/resourceManager';
import { buildNamesLookup } from '@/services/i18n/lookup';
import { loadLinkMap, loadPokemonConfig } from '@/services/meta';
import { CHAMPION_ALIGNMENTS } from '@/pages/statcalc/statcalc-options';
import type { TeamFormat, TeamMember } from './team-model';

const NATURE_SLUGS = new Set(CHAMPION_ALIGNMENTS.map((a) => a.slug));

/** 把 id→名 反转为 名→id。纯函数。 */
export function invertNameMap(map: Map<number, string>): Map<string, number> {
    const out = new Map<string, number>();
    for (const [id, name] of map) {
        if (name) out.set(name, id);
    }
    return out;
}

/** 英文性格名 → slug；非法 / 不在 Champions 21 种内 → null。纯函数。 */
export function toNatureSlug(english: unknown): string | null {
    if (typeof english !== 'string') return null;
    const slug = english.trim().toLowerCase();
    return NATURE_SLUGS.has(slug) ? slug : null;
}

interface ReverseTables {
    moves: Map<string, number>;
    abilities: Map<string, number>;
    items: Map<string, number>;
}

let reversePromise: Promise<ReverseTables> | null = null;

function loadReverseTables(): Promise<ReverseTables> {
    if (reversePromise) return reversePromise;
    reversePromise = (async () => {
        const en = buildNamesLookup(await resourceManager.getI18nNames('en'));
        return {
            moves: invertNameMap(en.moves),
            abilities: invertNameMap(en.abilities),
            items: invertNameMap(en.items),
        };
    })();
    reversePromise.catch(() => {
        reversePromise = null;
    });
    return reversePromise;
}

// species(+form) → slug：遍历 link（仅约 263 条）
async function slugFor(speciesId: number): Promise<string | null> {
    const link = await loadLinkMap();
    for (const [slug, entry] of link) {
        if (entry.id === speciesId) return slug;
    }
    return null;
}

function top<T>(arr: readonly T[]): T | undefined {
    return arr.length > 0 ? arr[0] : undefined;
}

/**
 * 生成成员热门配置补丁（Partial<TeamMember>）；不可用 → null。
 * 取各组 rank1（主流）：特性 / 道具 / 性格 / SP spread / 前 4 招式。
 */
export async function buildPopularPatch(speciesId: number, format: TeamFormat): Promise<Partial<TeamMember> | null> {
    const slug = await slugFor(speciesId);
    if (!slug) return null;

    const [cfg, tables] = await Promise.all([loadPokemonConfig(format, slug), loadReverseTables()]);

    const patch: Partial<TeamMember> = {};

    const ability = top(cfg.abilities);
    if (ability) {
        const id = tables.abilities.get(ability.name);
        if (id !== undefined) patch.ability_id = id;
    }

    const item = top(cfg.items);
    if (item) {
        const id = tables.items.get(item.name);
        if (id !== undefined) patch.item_id = id;
    }

    const nature = top(cfg.natures);
    const natureSlug = nature ? toNatureSlug(nature.name) : null;
    if (natureSlug) patch.nature = natureSlug;

    const spread = top(cfg.spreads);
    if (spread) {
        patch.spread = {
            hp: spread.hp,
            atk: spread.atk,
            def: spread.def,
            spa: spread.spa,
            spd: spread.spd,
            spe: spread.spe,
        };
    }

    const moves = cfg.moves
        .map((m) => tables.moves.get(m.name))
        .filter((id): id is number => id !== undefined)
        .slice(0, 4);
    if (moves.length > 0) patch.moves = moves;

    return Object.keys(patch).length > 0 ? patch : null;
}
