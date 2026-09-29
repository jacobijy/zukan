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
import { resolveContentLang } from '@/services/i18n/languages';
import { useI18nStore } from '@/store/i18n';

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

        // 预取最新世代 + 用户内容语言名称组（inflight 去重；错误静默）。
        // 两者并发，互不依赖；i18n store 内部会用同一份内存缓存把名称映射到宝可梦列表。
        resourceManager.prefetchPokemonGen(LATEST_GEN_ID);
        // 全代进化树单文件 ~30KB，详情页必用；旧后端未产出时 404 被 silence 吞掉
        resourceManager.prefetchEvolution();
        const lang = resolveContentLang();
        resourceManager.prefetchI18nNames(lang);
        // 若首选语言非英文，同时预取英文基线（回落叠加需要）
        if (lang !== 'en') resourceManager.prefetchI18nNames('en');

        // 加载 i18n 查找表（命中上面的预取），完成后由 store/pokemon 侧 watch
        // i18n.lookup 自动把宝可梦占位名替换为真实名称。
        // 用静态引入（不能用动态 import）：小程序端动态 import 被错编成 `await "字符串"`，
        // 解构得到 undefined，`ensureLoaded()` 从未执行 → 名称组永不加载、卡片全是占位名。
        useI18nStore()
            .ensureLoaded()
            .catch((err) => console.warn('[boot] i18n 加载失败', err));
    } catch (err) {
        console.warn('[boot] prefetch skipped', err);
    }
}
