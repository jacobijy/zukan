/**
 * 对战图标加密资源 —— 通用加密图片管线的「对战」实例。
 *
 * 对战页的 Champions 图标（精灵 / 属性 / 道具）走与图鉴立绘**同一条**
 * 下载 / 解密 / 缓存通道，但有三点不同（契约见 docs/data/battle-usage.md「图标」、
 * docs/security/encryption-pipeline.md §4.6）：
 *
 * 1. **字符串键**：精灵用 slug、属性用小写名、道具用英文显示名；扁平、无 variant。
 * 2. **按赛季版本化**：路径含 `meta.json` 的 `season`（M6），immutable；不用每日
 *    dataVersion。persist root 也带赛季，换赛季 → 新 root、key 同时变。
 * 3. **公开可见**：密文无鉴权可拉，DEK 同样由公开接口 `/zukan/key` 下发，匿名即可
 *    获取、未登录也正常出图；仅真故障（404 / 解密失败）时由调用方静默回落。
 */
import { createImageCache, type ImageAcquireOptions } from '@/services/resources/imageCache';
import { createImagePersist } from '@/services/resources/imagePersist';
import type { ImageKindSpec } from '@/services/resources/imageKind';
import { loadBattleMeta } from '@/services/meta';

/** 对战图标的三个子目录 */
export type BattleIconCat = 'pokemon' | 'types' | 'items';

/** 密文磁盘预算。道具密文极小；给精灵 128px 图留余量 */
const MAX_BYTES = 20 * 1024 * 1024;
/** 内存 LRU 上限 */
const MAX_ENTRIES = 300;
/** 并发下载，与 sprite / item 一致 */
const MAX_CONCURRENT = 4;

/**
 * 某赛季的种类描述符。
 * root 带赛季（`battle-img:sM6:`），换赛季即换 root；索引 key 三类共用，
 * 由 reconcile 清旧赛季孤儿。
 */
export function battleSpec(season: string): ImageKindSpec {
    return {
        mime: 'image/png',
        persistRoot: `battle-img:s${season}:`,
        indexStorageKey: 'zukan_battle_img_index',
        // id 已编码为 `<cat>/<encodedKey>`，扁平无 variant
        remotePath: (id) => `/assets/encrypted/battle/${season}/icons/${id}.bin`,
    };
}

interface BattleEngineInstance {
    acquire: (id: string, options?: ImageAcquireOptions) => Promise<string>;
    release: (id: string) => void;
}

const engines = new Map<string, BattleEngineInstance>();

/** 取当前赛季的引擎（按赛季缓存；season 来自已缓存的 loadBattleMeta）。 */
async function getEngine(): Promise<BattleEngineInstance> {
    const { season } = await loadBattleMeta();
    let engine = engines.get(season);
    if (!engine) {
        const spec = battleSpec(season);
        const persist = createImagePersist(spec, MAX_BYTES);
        const cache = createImageCache('battle', spec, persist, {
            maxEntries: MAX_ENTRIES,
            maxConcurrent: MAX_CONCURRENT,
        });
        // variant 恒为空：扁平、无 variant
        engine = {
            acquire: (id, options) => cache.acquire(id, '', options),
            release: (id) => cache.release(id, ''),
        };
        engines.set(season, engine);
    }
    return engine;
}

/** 拼某类图标的字符串资源键（文件名按契约 URL 编码）。 */
function iconId(cat: BattleIconCat, key: string): string {
    return `${cat}/${encodeURIComponent(key)}`;
}

/** 取得对战图标 Blob URL 并登记引用；不用时必须 `releaseBattleIcon`。 */
export async function acquireBattleIcon(
    cat: BattleIconCat,
    key: string,
    options: ImageAcquireOptions = {},
): Promise<string> {
    const engine = await getEngine();
    return engine.acquire(iconId(cat, key), options);
}

/** 释放一次对战图标引用。 */
export async function releaseBattleIcon(cat: BattleIconCat, key: string): Promise<void> {
    const engine = await getEngine();
    engine.release(iconId(cat, key));
}
