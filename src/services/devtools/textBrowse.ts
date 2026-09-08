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
 * 纯函数：不碰网络 / 存储 / wasm，入参是已解码的普通对象，因此 node 用例可直接跑
 * （`vitest.config.ts` 是 `environment: 'node'`）。
 */

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

// ── 搜索与截断 ───────────────────────────────────────────

/**
 * 过滤。
 *
 * **纯数字 query 走 id 精确匹配，不是子串。** 子串会让搜 `25` 同时命中 250 / 1025 /
 * 2500，在 2000 条的 items 表里等于没筛。要按数字找文本的场合极少，真有需要可以
 * 用文本搜索绕（数字本身也在 primary 里时依然能被非纯数字 query 命中）。
 *
 * 非数字 query 按 `primary` + `secondary` 子串匹配，大小写不敏感 —— genus、
 * pokemonName、效果详述都参与，否则搜「鼠宝可梦」这类分类词会一条都搜不到。
 */
export function filterRows(rows: readonly TextRow[], query: string): TextRow[] {
    const q = query.trim();
    if (!q) return rows.slice();

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
