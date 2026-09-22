/**
 * 把解码后的 `I18nFlavorBundle` 构建成按实体 id 索引的描述查找表。
 *
 * 纯函数：不碰网络、不碰存储，方便单测。
 *
 * 与名称组的差异：同一实体在 flavor bundle 里按 **version / version_group**
 * 存了多条（每个游戏版本一条）。两族口径不同：
 * - **species（图鉴描述）保留全部版本**：详情页要按游戏版本切换展示
 *   （`VersionedFlavorMap`，按 version 升序，version 是 version_id）；
 * - moves / abilities / items 只保留**最新版本**那条（version 最大；moves 等的
 *   version 是 version_group_id），这些栏目详情页只展示一句，不要版本切换
 *   （实测各版本组的招式说明基本相同，无切换必要）。
 *
 * 描述组按**族 × id 档位分片**（`flavor/<family>-sNN.bin`，`NN=(id-1)//128`），
 * 分片本身是完整合法的 `I18nFlavorBundle`（只填所属族的向量）。`buildFlavorBundle`
 * 兼容这种只填部分向量的 bundle；按需加载路径则用合并函数把一片的原始
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

/** 某实体在单个游戏版本下的一条描述 */
export interface FlavorVersion {
    /** species 为 PokeAPI version_id（1..41，解包追加更高） */
    version: number;
    /** 已清理的描述文本 */
    text: string;
}

/** speciesId → 该物种在各版本下的描述（按 version 升序，去空、同版本后者覆盖） */
export type VersionedFlavorMap = Map<number, FlavorVersion[]>;

export interface ArchiveFlavor {
    /** speciesId → 各游戏版本的图鉴描述（保留全部版本，供版本切换） */
    species: VersionedFlavorMap;
    /** moveId → 招式说明（最新版本组一条） */
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

/**
 * species 专用：把一片的原始描述行合并成 **id → 各版本描述**（保留全部版本）。
 *
 * 片号按 id 分档，同一 id 不会跨片；但同一片内同一 id 通常带多个 version
 * （每个游戏版本一条），同 `(id, version)` 重复（理论上仅跨片兜底才会出现）时
 * 后到的覆盖。空文本不进表。每个实体的版本数组按 version **升序**输出，
 * 末条即「最新版本」。返回**新 Map**（不改入参），调用方整体替换引用触发响应式。
 */
export function mergeVersionedFlavorRefs(
    target: VersionedFlavorMap,
    refs: readonly { id: number; text: string; version: number }[],
): VersionedFlavorMap {
    // 先摊成 id → (version → text) 去重，最后统一排序转数组
    const byId = new Map<number, Map<number, string>>();
    for (const [id, list] of target) {
        byId.set(id, new Map(list.map((v) => [v.version, v.text])));
    }
    for (const f of refs) {
        if (!f.text) continue;
        let versions = byId.get(f.id);
        if (!versions) {
            versions = new Map();
            byId.set(f.id, versions);
        }
        versions.set(f.version, cleanFlavorText(f.text));
    }

    const next: VersionedFlavorMap = new Map();
    for (const [id, versions] of byId) {
        next.set(
            id,
            [...versions.entries()].sort((a, b) => a[0] - b[0]).map(([version, text]) => ({ version, text })),
        );
    }
    return next;
}

/** 取版本数组里最新（version 最大）的一条文本；空数组返回 null。 */
export function latestVersionText(versions: readonly FlavorVersion[]): string | null {
    return versions.length ? versions[versions.length - 1]!.text : null;
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
 * 把按 `move_effect_id` 索引的招式效果重新按键为 **moveId → 效果简述**。
 *
 * `move_effects`（effects.bin）主键是稀疏的 `move_effect_id`，与招式 id 不对齐；
 * 但每个招式的 `Move.effectId` 指向它，且多个招式常共享同一 effect（如所有「10%
 * 畏缩」招）。这里按每个 move 的 effectId 把共享 short_effect 扇出到各 moveId：
 * effectId 为 0（上游空缺）或 effect 表查不到文本时跳过。纯函数，返回新 Map。
 */
export function keyMoveEffectsByMoveId(
    moves: readonly { id: number; effectId: number }[],
    effectById: EffectMap,
): EffectMap {
    const out: EffectMap = new Map();
    for (const m of moves) {
        if (!m.effectId) continue;
        const text = effectById.get(m.effectId);
        if (text) out.set(m.id, text);
    }
    return out;
}

/**
 * 一次性构建全部描述/效果表（整包口径，现仅 devtools / 测试使用 —— app 走分片合并）。
 * 描述组为空的语言（cs / pt-br / ja-roma）返回的四张 flavor 表均为空 Map。
 */
export function buildFlavorBundle(b: I18nFlavorBundle): ArchiveFlavor {
    return {
        species: mergeVersionedFlavorRefs(new Map(), b.species),
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
