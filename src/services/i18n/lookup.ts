/**
 * 把解码后的 `I18nNamesBundle` 构建成按 id 索引的查找表。
 *
 * 纯函数：不碰网络、不碰存储，方便单测。回落（英文覆盖）由调用方通过
 * 先建英文 lookup 再 `overlay` 叠加首选语言完成。
 */
import type { I18nNamesBundle } from '@/infra/wasm';

/**
 * 单语言名称查找表。所有 Map 以数字 id 为键（move_ailments 存在 id=-1，
 * Map 可正常承载）。缺失字段为空串而非 null，调用方可直接 `?? fallback`。
 */
export interface NamesLookup {
    species: Map<number, { name: string; genus: string }>;
    forms: Map<number, { formName: string; pokemonName: string }>;
    moves: Map<number, string>;
    abilities: Map<number, string>;
    items: Map<number, string>;
    types: Map<number, string>;
    natures: Map<number, string>;
    stats: Map<number, string>;
    eggGroups: Map<number, string>;
    regions: Map<number, string>;
    moveAilments: Map<number, string>;
}

/** 把 `{id, name}` 形态的数组收成 Map；空名不覆盖已有值 */
function toNamedMap(entries: { id: number; name: string }[]): Map<number, string> {
    const m = new Map<number, string>();
    for (const e of entries) {
        if (e.name) m.set(e.id, e.name);
    }
    return m;
}

export function buildNamesLookup(b: I18nNamesBundle): NamesLookup {
    const species = new Map<number, { name: string; genus: string }>();
    for (const s of b.species) {
        if (s.name) species.set(s.id, { name: s.name, genus: s.genus });
    }

    const forms = new Map<number, { formName: string; pokemonName: string }>();
    for (const f of b.forms) {
        if (f.formName || f.pokemonName) {
            forms.set(f.id, { formName: f.formName, pokemonName: f.pokemonName });
        }
    }

    return {
        species,
        forms,
        moves: toNamedMap(b.moves),
        abilities: toNamedMap(b.abilities),
        items: toNamedMap(b.items),
        types: toNamedMap(b.types),
        natures: toNamedMap(b.natures),
        stats: toNamedMap(b.stats),
        eggGroups: toNamedMap(b.eggGroups),
        regions: toNamedMap(b.regions),
        moveAilments: toNamedMap(b.moveAilments),
    };
}

/**
 * 用 `preferred` 的条目覆盖 `base`（通常 base=英文）。逐表逐 id 叠加：
 * - 首选语言某表为空（cs/pt-br）→ 整表保留英文
 * - 首选语言只有部分行（ja-roma 仅有物种名）→ 缺失行保留英文
 * - 同 id 在首选语言有非空名 → 覆盖英文
 *
 * 返回新对象，不修改入参。
 */
export function overlay(base: NamesLookup, preferred: NamesLookup): NamesLookup {
    const mergeMap = <V>(a: Map<number, V>, b: Map<number, V>): Map<number, V> => {
        const out = new Map(a);
        for (const [k, v] of b) {
            // 物种/形态这类对象值：只在有实际文本时覆盖
            if (v && typeof v === 'object') {
                const existing = out.get(k);
                out.set(k, existing ? { ...existing, ...v } : v);
            } else if (v) {
                out.set(k, v);
            }
        }
        return out;
    };

    return {
        species: mergeMap(base.species, preferred.species),
        forms: mergeMap(base.forms, preferred.forms),
        moves: mergeMap(base.moves, preferred.moves),
        abilities: mergeMap(base.abilities, preferred.abilities),
        items: mergeMap(base.items, preferred.items),
        types: mergeMap(base.types, preferred.types),
        natures: mergeMap(base.natures, preferred.natures),
        stats: mergeMap(base.stats, preferred.stats),
        eggGroups: mergeMap(base.eggGroups, preferred.eggGroups),
        regions: mergeMap(base.regions, preferred.regions),
        moveAilments: mergeMap(base.moveAilments, preferred.moveAilments),
    };
}
