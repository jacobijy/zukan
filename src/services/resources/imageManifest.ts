/**
 * 加密图片内容 hash 清单（`sprites.json`）查询层。
 *
 * 契约（见 `docs/caching/sprite-invalidation-c1.md`，后端已实现）：
 * - 后端把每张图明文内容 sha256 前 8 位 hex 汇总成固定路径 `/assets/encrypted/sprites.json`，
 *   形如 `{ "version": 3, "files": { "pokemon/25/home.bin": { "h": "a1b2c3d4", "m": ... } } }`；
 *   服务端对该文件单独发 `Cache-Control: no-cache`（其余加密资源仍 immutable）。
 * - 前端每次「进页面 / 回前台」拉一次清单：未变 304（H5 协商缓存），改了才能拿到新 hash。
 *
 * 用途：URL 拼接（`.../{id}/{variant}.bin?v=<hash>`）与两级缓存 key（`sprite:v{N}:{hash}:{id}/...`）
 * 都要 hash，因此这里维护**同步可读**的模块级快照，拉取与查表分离：
 * `refreshManifest()` 异步刷新快照；`hashForPath()` 同步查表，快照未就绪 / 失败 → undefined →
 * 调用方走旧单品路径（无 `?v=`、旧 key 格式），**向后兼容老后端**。
 *
 * ## 平台差异：为什么要有刷新时间闸
 *
 * H5 的浏览器 HTTP 缓存会做条件请求（no-cache → 每次回源校验，未变 304，近免费）；但**微信小程序
 * `wx.request` 不执行 304 / If-None-Match**，每次前台都会整包重下清单（实测约 47581 条、未压缩
 * 2~3 MB）。闸门把高频前台切换下的重复拉取收敛到 `MIN_REFRESH_INTERVAL_MS` 一次。
 */
import { fetchBinary } from '@/services/http';

/** 服务端固定路径（无 CDN 签名：签名 URL 每次 `t` 变会废掉 304 协商） */
const MANIFEST_URL = '/assets/encrypted/sprites.json';

/** 刷新最小间隔。H5 上 304 本就近免费，但小程序要整包拉，统一收敛（常量可调） */
export const MIN_REFRESH_INTERVAL_MS = 5 * 60_000;

type ManifestFetch = (url: string) => Promise<Uint8Array>;

/** 相对 bin 路径（`pokemon/25/home.bin`）→ 明文 hash 前 8 位。null = 从未成功拉取 / 老后端 */
let snapshot: Readonly<Record<string, string>> | null = null;
/** 上次**成功**刷新时间。失败不更新 —— 否则离线启动后 5 分钟内所有重试都会被闸掉 */
let lastRefreshAt = 0;
/** 进行中的拉取。并发调用复用同一 promise（不会叠加请求） */
let inflight: Promise<void> | null = null;

/** 逐字节还原 UTF-8。清单内容是 ASCII（数字 id / 字母 variant / hex hash / 目录名），
 *  小程序端无 `TextDecoder`，逐字节已足够（非 ASCII 会在 `JSON.parse` 时被下面的 try 拦下）。 */
function decodeManifest(bytes: Uint8Array): string {
    let out = '';
    for (let i = 0; i < bytes.length; i += 1) out += String.fromCharCode(bytes[i]!);
    return out;
}

/**
 * （重新）拉取清单并替换快照。**失败 / 解析错只 warn、保留旧快照** —— 清空会让已生效的 hash 全部
 * 退回旧 key，触发一次不必要的全量重下。首拉失败（离线启动）快照保持 null，行为等同现状。
 *
 * `opts.fetch` 仅供测试注入（node 无 `uni.request`，默认实现必然失败）；正常路径绝不要传。
 */
export async function refreshManifest(opts: { fetch?: ManifestFetch } = {}): Promise<void> {
    if (snapshot !== null && Date.now() - lastRefreshAt < MIN_REFRESH_INTERVAL_MS) {
        return;
    }
    if (inflight) return inflight;
    inflight = doRefresh(opts.fetch ?? fetchBinary);
    return inflight;
}

async function doRefresh(fetchImpl: ManifestFetch): Promise<void> {
    try {
        const bytes = await fetchImpl(MANIFEST_URL);
        const parsed = JSON.parse(decodeManifest(bytes)) as {
            files?: Record<string, { h?: unknown }>;
        } | null;

        const next: Record<string, string> = {};
        if (parsed && parsed.files && typeof parsed.files === 'object') {
            for (const [rel, file] of Object.entries(parsed.files)) {
                const h = file?.h;
                if (typeof h === 'string' && h) next[rel] = h;
            }
        }
        snapshot = next;
        lastRefreshAt = Date.now();
    } catch (err) {
        console.warn('[imageManifest] 拉取失败，图片缓存维持现状', err);
    } finally {
        inflight = null;
    }
}

/**
 * 同步查表：`/assets/encrypted/pokemon/25/home.bin` → `a1b2c3d4`。
 * 快照为空 / 该图未收录 / 老后端无清单 → undefined，调用方走无 hash 的旧路径。
 * 前缀正则不会误吞 `/assets/encrypted-assets/...` —— 不匹配则查表 miss，同样安全。
 */
export function hashForPath(remotePath: string): string | undefined {
    if (!snapshot) return undefined;
    const rel = remotePath.replace(/^\/?assets\/encrypted\//, '').split('?')[0];
    return snapshot[rel];
}
