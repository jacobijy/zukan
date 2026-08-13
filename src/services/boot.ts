/**
 * 启动预取入口
 *
 * 由 `App.vue onLaunch` fire-and-forget 调用。职责：
 * 1. 拉一次 `/api/v1/zukan/key` 拿到 DEK + CDN token + 数据版本（复用 keyCache 去重）
 * 2. 服务端版本 vs 本地存储版本不一致 → 清旧版本字节 + 写新版本号
 * 3. 预取最新一代的 gen bundle（缓存命中则 fetchDecrypted 内部 skip）
 *
 * 网络失败静默降级：首页 `store.fetchPokemon` 独立触发，走同一份 inflight 去重。
 */
import { getKey } from '@/services/session/key';
import { getStoredDataVersion, setStoredDataVersion } from '@/services/resources/dataVersion';
import { resourceManager } from '@/services/resources/resourceManager';
import { getPreferredLanguage } from '@/services/i18n/languages';

/** 当前最新一代；后续加代次时同步 bump 或改成从后端下发 */
const LATEST_GEN_ID = 9;

export async function bootPrefetch(): Promise<void> {
    try {
        const key = await getKey();
        const serverVersion = key.version;

        // 老后端不下发 version：跳过版本对比与主动 prune，
        // 直接按当前 cacheKeyPrefix 走预取（`fetchDecrypted` 仍然 cache-first）
        if (typeof serverVersion === 'number') {
            const localVersion = getStoredDataVersion();
            if (localVersion !== serverVersion) {
                await resourceManager.pruneOtherVersions(serverVersion);
                setStoredDataVersion(serverVersion);
            }
        }

        // 预取最新世代 + 用户语言名称组（inflight 去重；错误静默）。
        // 两者并发，互不依赖；i18n store 内部会用同一份内存缓存把名称映射到宝可梦列表。
        resourceManager.prefetchPokemonGen(LATEST_GEN_ID);
        const lang = getPreferredLanguage();
        resourceManager.prefetchI18nNames(lang);
        // 若首选语言非英文，同时预取英文基线（回落叠加需要）
        if (lang !== 'en') resourceManager.prefetchI18nNames('en');

        // 加载 i18n 查找表（命中上面的预取），完成后自动把宝可梦占位名替换为真实名称。
        // 动态 import 打断 boot → store/pokemon 的静态依赖环。
        const { useI18nStore } = await import('@/store/i18n');
        useI18nStore().ensureLoaded().catch((err) => console.warn('[boot] i18n 加载失败', err));
    } catch (err) {
        console.warn('[boot] prefetch skipped', err);
    }
}
