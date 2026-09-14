/**
 * 把解码后的 `I18nFlavorBundle` 构建成按实体 id 索引的描述查找表。
 *
 * 纯函数：不碰网络、不碰存储，方便单测。
 *
 * 与名称组的差异：同一实体在 flavor bundle 里按 **version / version_group**
 * 存了多条（每个游戏版本一条），这里只保留**最新版本**的那条（version 最大），
 * 详情页展示一句即可。
 *
 * 描述组按**族 × id 档位分片**（`flavor/<family>-sNN.bin`，`NN=(id-1)//128`），
 * 分片本身是完整合法的 `I18nFlavorBundle`（只填所属族的向量）。`buildFlavorBundle`
 * 兼容这种只填部分向量的 bundle；按需加载路径则用 `mergeFlavorRefs` 把一片的原始
 * 行逐片合并进查找表（同 id 只会落在一个片里，无需跨片比较版本）。
 *
 * 回落不在本文件做：cs / pt-br / ja-roma 的描述组整体为空（任意分片 404），
 * 由 `resolveFlavorLang` 静态名单直接定位英文分片；其余语言个别 id 缺失由查询处
 * 回落 null，不逐 id 换英文。
 */
import type { I18nFlavorBundle } from '@/infra/wasm';
import { FALLBACK_LANGUAGE } from '@/services/i18n/languages';

export type FlavorMap = Map<number, string>;
/** 效果简述（shortEffect）；仅 en/fr/de 有数据 */
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
    /** abilityId → 特性效果简述（仅 en/fr/de） */
    abilityEffects: EffectMap;
    /** moveId → 招式效果简述（仅 en/fr/de） */
    moveEffects: EffectMap;
}

/** 空查找表：分片/效果尚未加载时先立一个壳，后续合并整体替换 */
export function emptyFlavor(): ArchiveFlavor {
    return {
        species: new Map(),
        moves: new Map(),
        abilities: new Map(),
        items: new Map(),
        abilityEffects: new Map(),
        moveEffects: new Map(),
    };
}

/**
 * 描述组整体为空的语言：**不产出任何分片**，请求任意片都是 404，
 * 直接按 `FALLBACK_LANGUAGE` 定位英文分片（见 docs/i18n/i18n-bundle.md「语言级判定」）。
 */
export const EMPTY_FLAVOR_LANGS: readonly string[] = ['cs', 'pt-br', 'ja-roma'];

/** 效果文件（effects.bin）有数据的语言；其余语言请求 404，前端隐藏效果段 */
export const EFFECT_LANGS: readonly string[] = ['en', 'fr', 'de'];

/** 描述组的语言级回落：空语言一律换英文基线，其余按首选语言取片 */
export function resolveFlavorLang(lang: string): string {
    return EMPTY_FLAVOR_LANGS.includes(lang) ? FALLBACK_LANGUAGE : lang;
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
 * 把一片的原始描述行合并进查找表。片号按 id 分档，同一 id 不会跨片，
 * 但**同一片内同一 id 仍可能多版本**（历史 PokeAPI + 游戏解包追加），
 * 仍按 version 取最大。返回**新 Map**（不改入参），调用方整体替换引用触发响应式。
 */
export function mergeFlavorRefs(
    target: FlavorMap,
    refs: readonly { id: number; text: string; version: number }[],
): FlavorMap {
    const next = new Map(target);
    const best = new Map<number, { text: string; version: number }>();
    for (const f of refs) {
        if (!f.text) continue;
        const prev = best.get(f.id);
        // 打包顺序不保证版本升序，故显式比较，仅当版本更新（或持平）时覆盖。
        if (!prev || f.version >= prev.version) best.set(f.id, { text: f.text, version: f.version });
    }
    for (const [id, v] of best) next.set(id, cleanFlavorText(v.text));
    return next;
}

/** 收成 id → 效果简述。效果表无版本维度（每 id 一条），空文本不进表。 */
export function buildEffectMap(entries: readonly { id: number; shortEffect: string }[]): EffectMap {
    const out: EffectMap = new Map();
    for (const e of entries) {
        if (e.shortEffect) out.set(e.id, cleanFlavorText(e.shortEffect));
    }
    return out;
}

/**
 * 一次性构建全部描述/效果表（整包口径，现仅 devtools / 测试使用 —— app 走分片合并）。
 * 描述组为空的语言（cs / pt-br / ja-roma）返回的四张 flavor 表均为空 Map。
 */
export function buildFlavorBundle(b: I18nFlavorBundle): ArchiveFlavor {
    return {
        species: mergeFlavorRefs(new Map(), b.species),
        moves: mergeFlavorRefs(new Map(), b.moves),
        abilities: mergeFlavorRefs(new Map(), b.abilities),
        items: mergeFlavorRefs(new Map(), b.items),
        abilityEffects: buildEffectMap(b.abilityEffects),
        moveEffects: buildEffectMap(b.moveEffects),
    };
}

/** 四类 flavor 表的总条目数；为 0 表示该语言描述组整体缺失 */
export function flavorSize(f: ArchiveFlavor): number {
    return f.species.size + f.moves.size + f.abilities.size + f.items.size;
}
