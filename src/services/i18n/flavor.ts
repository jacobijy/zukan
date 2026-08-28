/**
 * 把解码后的 `I18nFlavorBundle` 构建成按实体 id 索引的描述查找表。
 *
 * 纯函数：不碰网络、不碰存储，方便单测。
 *
 * 与名称组的差异：同一实体在 flavor bundle 里按 **version / version_group**
 * 存了多条（每个游戏版本一条），这里只保留**最新版本**的那条（version 最大），
 * 详情页展示一句即可。
 *
 * bundle 含四类 flavor 表（species/moves/abilities/items）与两类效果表
 * （abilityEffects/moveEffects，ProseEffect，**上游仅英文有数据**）。
 *
 * 回落不在本文件做：完整语言（zh-hans / ja / en … 共 11 种）的 flavor 本身
 * 齐全，直接用；cs / pt-br / ja-roma 的描述组为空（四类表总 size 为 0），
 * 由调用方据此回落英文基线——避免为每个用户都下载 ~2.7MB 的英文 flavor 包。
 */
import type { I18nFlavorBundle } from '@/infra/wasm';

export type FlavorMap = Map<number, string>;
/** 效果简述（shortEffect）；仅英文 bundle 有数据 */
export type EffectMap = Map<number, string>;

export interface ArchiveFlavor {
    /** speciesId → 图鉴描述 */
    species: FlavorMap;
    /** moveId → 招式说明 */
    moves: FlavorMap;
    /** abilityId → 特性说明 */
    abilities: FlavorMap;
    /** itemId → 道具说明 */
    items: FlavorMap;
    /** abilityId → 特性效果简述（仅英文） */
    abilityEffects: EffectMap;
    /** moveId → 招式效果简述（仅英文） */
    moveEffects: EffectMap;
}

/** 软连字符 U+00AD：上游用来标记可断词处，展示时不应出现 */
const SOFT_HYPHEN = new RegExp(String.fromCharCode(0xad), 'g');
const WHITESPACE_RUN = /\s+/g;

/**
 * 清理上游 flavor 文本：去掉软连字符（U+00AD），把游戏内换行（`\n`/`\f`/`\r`）
 * 与连续空白折成单个空格。
 */
export function cleanFlavorText(text: string): string {
    return text.replace(SOFT_HYPHEN, '').replace(WHITESPACE_RUN, ' ').trim();
}

/**
 * 收成 id → 描述。同一 id 有多条（多版本）时取 version 最大者；
 * 空文本不进表。
 */
function buildFlavorMap(entries: { id: number; text: string; version: number }[]): FlavorMap {
    const best = new Map<number, { text: string; version: number }>();
    for (const f of entries) {
        if (!f.text) continue;
        const prev = best.get(f.id);
        // 打包顺序不保证版本升序，故显式比较，仅当版本更新（或持平）时覆盖。
        if (!prev || f.version >= prev.version) {
            best.set(f.id, { text: f.text, version: f.version });
        }
    }
    const out: FlavorMap = new Map();
    for (const [id, v] of best) out.set(id, cleanFlavorText(v.text));
    return out;
}

/**
 * 收成 id → 效果简述。效果表无版本维度（每 id 一条），空文本不进表。
 */
function buildEffectMap(entries: { id: number; shortEffect: string }[]): EffectMap {
    const out: EffectMap = new Map();
    for (const e of entries) {
        if (e.shortEffect) out.set(e.id, cleanFlavorText(e.shortEffect));
    }
    return out;
}

/**
 * 一次性构建全部描述/效果表。描述组为空的语言（cs / pt-br / ja-roma）
 * 返回的四张 flavor 表均为空 Map，调用方据总 size 回落英文。
 */
export function buildFlavorBundle(b: I18nFlavorBundle): ArchiveFlavor {
    return {
        species: buildFlavorMap(b.species),
        moves: buildFlavorMap(b.moves),
        abilities: buildFlavorMap(b.abilities),
        items: buildFlavorMap(b.items),
        abilityEffects: buildEffectMap(b.abilityEffects),
        moveEffects: buildEffectMap(b.moveEffects),
    };
}

/** 四类 flavor 表的总条目数；为 0 表示该语言描述组整体缺失 */
export function flavorSize(f: ArchiveFlavor): number {
    return f.species.size + f.moves.size + f.abilities.size + f.items.size;
}
