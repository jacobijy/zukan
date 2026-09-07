/**
 * 立绘可用性记录（跨刷新，按版本失效）。
 *
 * `loadSpriteChain` 每次都从 `home` 开始试，缺 `home` 的形态（10080–10085 角色扮演
 * 皮卡丘、10158/10159 搭档皮卡丘/伊布）因此**每次刷新都白跑一个 404** 才回落到
 * `artwork`；缺 `front` 的 10301 同样白跑一次 preview。数量不多（当前共 9 个），
 * 但那是一次真实的网络往返 + 一条控制台噪音，且随上游补图/删图会变。
 *
 * 所以把「运行时真正命中的是哪个 variant」记在本地，下次直奔结果。
 *
 * ## 与 hasSprite 的分工（别混）
 *
 * | | `hasSprite`（PKMB 字段） | 本模块 |
 * |---|---|---|
 * | 来源 | 后端打包时扫资源目录 | 前端运行时实测 |
 * | 粒度 | 「有没有正面图」布尔 | 「哪个 variant 能用」 |
 * | 载体 | 随 `gen-N.bin` 走三层缓存 | 独立 KV |
 * | 作用 | 整个形态都没图 → 一个请求都不发 | 有图但主 variant 不是 `home` → 少跑 404 |
 *
 * `hasSprite` 判定含 `shiny`，回落链只试 `home`/`artwork`/`front`，两者口径不完全
 * 等价，故都需要 —— 但**不重复**：`hasSprite === false` 的形态压根走不到这里。
 *
 * ## 为什么只存"偏离默认"的条目
 *
 * 1300+ 个 id 里绝大多数就是 `home` 命中、`front` 存在，把它们全记下来等于用几十 KB
 * 存一句「一切正常」。只记异常项（当前约 9 条，< 1 KB），查不到就按默认流程走 ——
 * 默认流程本身是正确的，记录只是抄近路。
 *
 * ## 全平台启用（与 imagePersist 不同）
 *
 * `imagePersist` 限 IndexedDB 是因为要存几十 MB 图片，会把小程序的 10MB 配额顶爆。
 * 本模块是几百字节的短字符串 KV，小程序完全容得下；而小程序**没有**密文持久层
 * （非 IDB 后端 no-op），反而更需要省掉这些 404。
 *
 * ## 记录不是真相，只是提示
 *
 * 记录可能过期（上游补了 `home`）。所以按记录直奔的 variant **一旦 404 就退回完整
 * 回落链**，并把该条记录摘掉重新学。绝不能因为记录里写着什么就跳过真实的回落逻辑 ——
 * 那会把一次偶然的 404 永久固化成「这个形态没图」。
 */

import { currentDataVersion } from '@/services/resources/dataVersion';

/** uni storage 的 key。整份记录一条 KV，读写都是同步的短字符串。 */
const STORAGE_KEY = 'zukan_sprite_avail';

/**
 * 单个 id 的记录。刻意用短字段名 —— 这份 JSON 要整体同步读写，
 * 字段名占的比例不小（`{"r":"artwork"}` vs `{"resolved":"artwork"}`）。
 */
interface AvailEntry {
    /** 主 variant 404 后实际命中的 variant；缺席 = 主 variant 本身可用 */
    r?: string;
    /** preview（front）不存在，跳过第一段。1 = 确认缺失 */
    np?: 1;
    /** 整条回落链都 404，服务器确实没这张图。1 = 确认无图 */
    no?: 1;
}

interface AvailIndex {
    /** 版本号；与 `currentDataVersion()` 不符时整份作废 */
    v: number;
    /** `<id>/<主 variant>` → 记录。只存偏离默认的条目 */
    e: Record<string, AvailEntry>;
}

let index: AvailIndex | null = null;
let flushTimer: ReturnType<typeof setTimeout> | null = null;

/** 索引落盘防抖：首屏会连续学到多条，逐条同步写 storage 会卡主线程 */
const FLUSH_DELAY_MS = 500;

function emptyIndex(): AvailIndex {
    return { v: currentDataVersion(), e: {} };
}

function entryKey(id: number, variant: string): string {
    return `${id}/${variant}`;
}

/**
 * 懒加载。版本不符 / 解析失败 / 结构不对都重置为空 ——
 * 记录只是优化，宁可当成没有重新学，也不能拿旧版本的结论指挥新资源。
 */
function loadIndex(): AvailIndex {
    if (index) return index;

    try {
        const raw = uni.getStorageSync(STORAGE_KEY) as unknown;
        const parsed = (typeof raw === 'string' && raw ? JSON.parse(raw) : raw) as AvailIndex | undefined;
        if (parsed && parsed.v === currentDataVersion() && parsed.e && typeof parsed.e === 'object') {
            index = { v: parsed.v, e: parsed.e };
        } else {
            index = emptyIndex();
        }
    } catch {
        index = emptyIndex();
    }

    return index;
}

function flush(): void {
    if (flushTimer) {
        clearTimeout(flushTimer);
        flushTimer = null;
    }
    if (!index) return;
    try {
        uni.setStorageSync(STORAGE_KEY, JSON.stringify(index));
    } catch (err) {
        // 写不进去只是下次重新学一遍，不该影响当前这张图
        console.warn('[spriteAvailability] 写入失败', err);
    }
}

function scheduleFlush(): void {
    if (flushTimer) return;
    flushTimer = setTimeout(() => {
        flushTimer = null;
        flush();
    }, FLUSH_DELAY_MS);
}

// ── 读 ────────────────────────────────────────────────────────

export interface SpriteHint {
    /** 已知实际命中的 variant（主 variant 404 过）；undefined = 无记录，按默认起点 */
    resolved?: string;
    /** 已知 preview 不存在，跳过第一段 */
    noPreview: boolean;
    /** 已知整条链都没图，直接落占位（一个请求都不发） */
    noSprite: boolean;
}

/**
 * 取某个 id + 主 variant 的历史结论。无记录时返回全默认（照常走完整流程）。
 */
export function getSpriteHint(id: number, variant: string): SpriteHint {
    const e = loadIndex().e[entryKey(id, variant)];
    if (!e) return { noPreview: false, noSprite: false };
    return { resolved: e.r, noPreview: e.np === 1, noSprite: e.no === 1 };
}

// ── 写 ────────────────────────────────────────────────────────

function mutate(id: number, variant: string, fn: (e: AvailEntry) => void): void {
    const idx = loadIndex();
    const key = entryKey(id, variant);
    const e = idx.e[key] ?? {};
    fn(e);

    // 空对象不值得存 —— 那正是"一切默认"，查不到时的行为完全一样
    if (Object.keys(e).length === 0) delete idx.e[key];
    else idx.e[key] = e;

    scheduleFlush();
}

/**
 * 记下「主 variant 404，实际命中的是 `resolved`」。
 * `resolved === variant` 时不记（那是默认情形）。
 */
export function recordResolvedVariant(id: number, variant: string, resolved: string): void {
    if (resolved === variant) {
        // 主 variant 可用：若之前记过回落，说明上游补了图 —— 摘掉旧结论
        mutate(id, variant, (e) => {
            delete e.r;
            delete e.no;
        });
        return;
    }
    mutate(id, variant, (e) => {
        e.r = resolved;
        delete e.no;
    });
}

/** 记下「preview 不存在」（如 10301 无 front），下次跳过第一段 */
export function recordNoPreview(id: number, variant: string): void {
    mutate(id, variant, (e) => {
        e.np = 1;
    });
}

/** 记下「整条回落链都 404」（如 10264 / 10268），下次直接落占位 */
export function recordNoSprite(id: number, variant: string): void {
    mutate(id, variant, (e) => {
        e.no = 1;
        delete e.r;
    });
}

/**
 * 作废某个 id 的记录。按记录直奔却 404 时调用 ——
 * 说明上游改了图，必须退回完整回落链重新学，不能守着过期结论。
 */
export function forgetSprite(id: number, variant: string): void {
    const idx = loadIndex();
    const key = entryKey(id, variant);
    if (key in idx.e) {
        delete idx.e[key];
        scheduleFlush();
    }
}

// ── 维护 ──────────────────────────────────────────────────────

/**
 * 版本升级时整份重置。由 `resourceManager.pruneOtherVersions` 调用，与 FB bundle /
 * 密文缓存同一时机 —— 资源换了一版，旧的"哪个 variant 能用"结论不再可信。
 *
 * 按 `keepVersion` 而非 `currentDataVersion()`：调用点在 `setStoredDataVersion`
 * **之前**，那时读到的还是旧版本号（与 `imagePersist.pruneVersions` 同一约定）。
 */
export function pruneSpriteAvailability(keepVersion: number): void {
    index = { v: keepVersion, e: {} };
    flush();
}

/** 供测试与排障：条目数与当前版本 */
export function spriteAvailabilityStats(): { entries: number; version: number } {
    const idx = loadIndex();
    return { entries: Object.keys(idx.e).length, version: idx.v };
}

/** 供测试：丢掉内存态，强制下次从 storage 重读 */
export function resetSpriteAvailabilityCache(): void {
    if (flushTimer) {
        clearTimeout(flushTimer);
        flushTimer = null;
    }
    index = null;
}
