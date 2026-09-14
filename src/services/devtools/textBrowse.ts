/**
 * i18n 文本浏览：把名称组 / 描述组的各张表摊平成统一行模型，并做搜索过滤。
 *
 * **与应用层的两处刻意分歧**（跟 `assetProbe.ts` 一个道理：工具要看真相，
 * 应用要看结果）：
 *
 * 1. **flavor 不按版本去重。** `services/i18n/flavor.ts` 的 `buildFlavorMap` 只留
 *    version 最大的一条 —— 详情页展示一句就够。但排查「为什么详情页显示的是这句」
 *    时，要看的恰恰是同一 id 下**其它候选和它们的 version**。所以本模块直接摊平
 *    原始 `FlavorText[]`，一条不丢。
 * 2. **不做名称回落。** `lookup.ts` 的 `overlay` 用英文补齐首选语言的空洞，那会让
 *    「这个语言到底缺哪些条目」彻底看不见 —— 而这正是浏览器要回答的问题之一。
 *
 * 纯函数：不碰网络 / 存储 / wasm 运行时，入参是已解码的普通对象，因此 node 用例可直接跑
 * （`vitest.config.ts` 是 `environment: 'node'`）。
 */
import type { I18nFlavorBundle } from '@/infra/wasm';
import type { FlavorFamily } from '@/services/resources/resourceManager';

/** 摊平后的一行。四种上游结构（named/species/prose/flavor…）都收敛到这里。 */
export interface TextRow {
    id: number;
    /** 主文本：名称，或描述正文 */
    primary: string;
    /** 次文本：genus / pokemonName / description / 效果详述；无则空串 */
    secondary: string;
    /**
     * flavor 专属的版本号（species 是 version_id，其余是 version_group_id）。
     * names 系的表为 undefined —— 用它区分「该不该显示版本标签」。
     */
    version?: number;
}

// ── 摊平：每种上游结构一个纯映射 ─────────────────────────

/** `NamedTextEntry[]`：moves / abilities / items / types … 绝大多数表 */
export function fromNamed(entries: readonly { id: number; name: string }[]): TextRow[] {
    return entries.map((e) => ({ id: e.id, primary: e.name, secondary: '' }));
}

/** `SpeciesName[]`：物种名 + 分类（genus，如「鼠宝可梦」） */
export function fromSpecies(entries: readonly { id: number; name: string; genus: string }[]): TextRow[] {
    return entries.map((e) => ({ id: e.id, primary: e.name, secondary: e.genus }));
}

/** `FormName[]`：形态名 + 该形态的宝可梦名 */
export function fromForms(entries: readonly { id: number; formName: string; pokemonName: string }[]): TextRow[] {
    return entries.map((e) => ({ id: e.id, primary: e.formName, secondary: e.pokemonName }));
}

/** `ProseTextEntry[]`：名称 + 描述（pokedexes / moveDamageClasses / moveTargets …） */
export function fromProse(entries: readonly { id: number; name: string; description: string }[]): TextRow[] {
    return entries.map((e) => ({ id: e.id, primary: e.name, secondary: e.description }));
}

/** `SoloTextEntry[]`：只有一列长文本（moveCategories / characteristics …） */
export function fromSolo(entries: readonly { id: number; text: string }[]): TextRow[] {
    return entries.map((e) => ({ id: e.id, primary: e.text, secondary: '' }));
}

/** `LocationName[]`：地点名 + 副标题 */
export function fromLocations(entries: readonly { id: number; name: string; subtitle: string }[]): TextRow[] {
    return entries.map((e) => ({ id: e.id, primary: e.name, secondary: e.subtitle }));
}

/** `ShapeEntry[]`：体型名 + 趣味名（awesomeName），描述并入次文本 */
export function fromShapes(
    entries: readonly { id: number; name: string; awesomeName: string; description: string }[],
): TextRow[] {
    return entries.map((e) => ({
        id: e.id,
        primary: e.name,
        secondary: [e.awesomeName, e.description].filter(Boolean).join(' · '),
    }));
}

/**
 * `FlavorText[]`：**保留全部版本**，不去重（见文件头第 1 条）。
 *
 * 文本清理复用 `cleanFlavorText`（由调用方注入，避免本模块 import services/i18n）：
 * 上游文本带软连字符 U+00AD 与游戏内换行，不清理根本读不了。
 */
export function fromFlavor(
    entries: readonly { id: number; text: string; version: number }[],
    clean: (s: string) => string,
): TextRow[] {
    return entries.map((e) => ({ id: e.id, primary: clean(e.text), secondary: '', version: e.version }));
}

/** `ProseEffect[]`：简述作主文本、详述作次文本（上游仅英文有数据） */
export function fromEffects(
    entries: readonly { id: number; shortEffect: string; effect: string }[],
    clean: (s: string) => string,
): TextRow[] {
    return entries.map((e) => ({ id: e.id, primary: clean(e.shortEffect), secondary: clean(e.effect) }));
}

/**
 * 把某族多个分片 bundle 摊平成全部历史版本，跨片按 id 排序。
 *
 * 描述组按族 × 档分片（`flavor/{family}-sNN.bin`），文本浏览按族从 `s00` 聚合到
 * 最大片号；空档位 / 空语言的 404 由调用方记为 `null`（丢到 null 数组）。每片内部
 * 已是按 id 升序，跨片合并后必须整体重排，否则不同片的 id 交错出现。
 * 保留全部版本不去重（浏览器要看的正是同一 id 的其它候选，见文件头第 1 条）。
 */
export function mergeFlavorSlices(
    slices: readonly (I18nFlavorBundle | null)[],
    family: FlavorFamily,
    clean: (s: string) => string,
): TextRow[] {
    const refs: I18nFlavorBundle['species'] = [];
    for (const b of slices) if (b) refs.push(...b[family]);
    return fromFlavor(refs, clean).sort((a, b) => a.id - b.id);
}

// ── 搜索与截断 ───────────────────────────────────────────

/**
 * 可用前缀表达的实体域。只有**主键跨名称组 / 描述组复用、又最常按 id 查**的四类
 * 核心实体登记在此；其它表（属性 / 性格 / 地点…）行 id 就是本表主键，纯数字即可。
 */
export type TextEntity = 'pokemon' | 'move' | 'ability' | 'item';

export interface IdPrefixDef {
    /** 搜索框前缀（单字母，大小写不敏感） */
    prefix: string;
    entity: TextEntity;
    /** 实体中文名，拼提示用 */
    label: string;
    /** 该实体散落在哪些表，前缀与当前表不符时给用户指路 */
    where: string;
}

/**
 * 实体 id 前缀：`p25` 宝可梦、`m150` 招式、`a65` 特性、`i4` 道具。
 *
 * 注意 `pokemon` 在不同表是**不同 id 空间**：物种表 / 图鉴描述的行 id 是 species id
 * （全国图鉴 1..1025），形态表的行 id 经打包侧重映射成 pokemon id（含 10001+ 非默认形态，
 * 见 docs/data/bundle-decode.md「form 名称的 id 重映射」）。前缀只校验「这张表讲的是不是
 * 这种实体」，**不做跨 id 空间换算** —— 形态表 `p25` 命中的是 pokemon id 25 的默认形态行。
 */
export const ID_PREFIXES: readonly IdPrefixDef[] = [
    { prefix: 'p', entity: 'pokemon', label: '宝可梦', where: '名称组「物种 / 形态」或描述组「图鉴描述」' },
    { prefix: 'm', entity: 'move', label: '招式', where: '名称组「招式」或描述组「招式说明 / 招式效果」' },
    { prefix: 'a', entity: 'ability', label: '特性', where: '名称组「特性」或描述组「特性说明 / 特性效果」' },
    { prefix: 'i', entity: 'item', label: '道具', where: '名称组「道具」或描述组「道具说明」' },
];

const PREFIXED_ID_RE = /^([a-z])(-?\d+)$/i;

/**
 * 识别「单字母 + 整数」的实体 id 查询（`p25` / `I4`）。
 *
 * 只认 `ID_PREFIXES` 登记的字母：`x5`、`pm25`、`pika`、`p` 都返回 undefined，
 * 落回文本子串搜，避免把普通文本劫持成 id 查询。
 */
export function parseIdPrefix(query: string): { def: IdPrefixDef; id: number } | undefined {
    const m = PREFIXED_ID_RE.exec(query.trim());
    if (!m) return undefined;
    const def = ID_PREFIXES.find((d) => d.prefix === m[1]!.toLowerCase());
    return def ? { def, id: Number.parseInt(m[2]!, 10) } : undefined;
}

/**
 * 前缀与当前表不符时的指路文案；相符、或根本不是前缀查询时返回 undefined。
 *
 * 必须**显式提示**而不是静默返回空：在道具表敲 `p25`，若退化成裸数字 `25` 会静默命中
 * 道具 #25（精灵球）——「看起来搜到了」其实答非所问，这正是前缀要消灭的跨表歧义。
 */
export function idPrefixNotice(query: string, table: { entity?: TextEntity; label: string }): string | undefined {
    const hit = parseIdPrefix(query);
    if (!hit || table.entity === hit.def.entity) return undefined;
    return `「${hit.def.prefix}」是${hit.def.label} id 前缀，当前表「${table.label}」不是${hit.def.label}表。请到 ${hit.def.where} 查看；或去掉前缀按当前表 id 搜。`;
}

/**
 * 过滤。三种 query：
 *
 * 1. **实体前缀 + 整数**（`p25` / `m150` / `a65` / `i4`）：仅当当前表就是该实体的表
 *    （`tableEntity` 对得上）时按 id 精确匹配；对得上才出行，对不上一律空 —— 提示文案
 *    由调用方用 `idPrefixNotice` 取（见该函数「为什么不能静默」）。
 * 2. **纯整数 query 走本表行 id 精确匹配，不是子串。** 子串会让搜 `25` 同时命中 250 /
 *    1025 / 2500，在 2000 条的 items 表里等于没筛。要按数字找文本的场合极少，真有需要
 *    可以用文本搜索绕（数字本身也在 primary 里时依然能被非纯数字 query 命中）。
 * 3. 非数字 query 按 `primary` + `secondary` 子串匹配，大小写不敏感 —— genus、
 *    pokemonName、效果详述都参与，否则搜「鼠宝可梦」这类分类词会一条都搜不到。
 */
export function filterRows(rows: readonly TextRow[], query: string, tableEntity?: TextEntity): TextRow[] {
    const q = query.trim();
    if (!q) return rows.slice();

    const prefixed = parseIdPrefix(q);
    if (prefixed) {
        if (tableEntity !== prefixed.def.entity) return [];
        return rows.filter((r) => r.id === prefixed.id);
    }

    if (/^-?\d+$/.test(q)) {
        const id = Number.parseInt(q, 10);
        return rows.filter((r) => r.id === id);
    }

    const needle = q.toLowerCase();
    return rows.filter((r) => r.primary.toLowerCase().includes(needle) || r.secondary.toLowerCase().includes(needle));
}

/**
 * 截断到 `limit` 条，同时把**过滤后的总数**带出去。
 *
 * 不做虚拟化：items 表约 2000 条、flavor 文本多行变高，`dex/VirtualList.vue` 是定高的
 * 用不了，逐项测量的虚拟化为一个内部工具不值得。截断 + 搜索收窄就够了，
 * 但必须显示 total —— 否则「只有 200 条」会被当成数据缺失。
 */
export function pageRows(rows: readonly TextRow[], limit: number): { shown: TextRow[]; total: number } {
    return { shown: rows.slice(0, limit), total: rows.length };
}
