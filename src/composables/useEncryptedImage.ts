/**
 * 加密图片加载生命周期 composable。
 *
 * 把 `EncryptedSprite` 里那套「视口感知懒加载 + 离屏取消 + 引用计数配对」抽成
 * 与种类无关的逻辑，宝可梦立绘（pokemon）与道具图标（item）共用。引擎差异
 * （远端路径 / 缓存 / 调度）在 `spriteCache` / `itemImage` 里，这里只负责：
 *
 * - 进视口附近（提前 200px）才开始下载解密，首屏不把不可见的图也一起解了；
 * - observer **不是一次性的**：滑出视口且没下完就 abort 让出并发槽，重新进视口再来；
 * - 拿到 Blob URL 后登记引用，卸载 / id 变化时归还（引擎按引用计数决定能否淘汰）；
 * - 不支持 IntersectionObserver（小程序 / 老浏览器）或传 `eager` 时退化为立即加载。
 *
 * 返回的状态交给组件渲染：`blobUrl` 有值显示图片；`loading` 为真显示骨架；
 * 两者都否（`failed`）显示组件自己的兜底图 / 占位盒。
 */
import { ref, onMounted, onUnmounted, watch, type Ref } from 'vue';
import { acquireSprite, releaseSprite } from '@/services/resources/spriteCache';
import { acquireItemIcon, releaseItemIcon } from '@/services/resources/itemImage';
import { isImageAbortError } from '@/services/resources/imageCache';
import { BinaryRequestError } from '@/services/http';
import type { ImageKind } from '@/services/resources/imageKind';

export interface EncryptedImageState {
    blobUrl: Ref<string | null>;
    /** 没有最终结果时为真；离屏取消后保持为真（等下次进视口重试，仍显示骨架） */
    loading: Ref<boolean>;
    /** 真失败（含 404 无资源）；离屏取消不算 */
    failed: Ref<boolean>;
    /** 挂到根元素上供 IntersectionObserver 观察 */
    wrapperRef: Ref<unknown>;
}

interface UseEncryptedImageOptions {
    kind: ImageKind;
    /** 资源 id（pokemonId / itemId），响应式 */
    id: () => number;
    /** pokemon 的 variant（home/shiny/…）；item 可省略 */
    variant?: () => string;
    /** 关掉懒加载、挂载即下载（详情页主图这类必然可见的场景） */
    eager?: () => boolean;
    /** 日志前缀，便于排障 */
    logTag?: string;
}

function acquire(kind: ImageKind, id: number, variant: string, signal: AbortSignal | undefined): Promise<string> {
    return kind === 'pokemon' ? acquireSprite(id, variant, { signal }) : acquireItemIcon(id, { signal });
}

function release(kind: ImageKind, id: number, variant: string): void {
    if (kind === 'pokemon') releaseSprite(id, variant);
    else releaseItemIcon(id);
}

export function useEncryptedImage(options: UseEncryptedImageOptions): EncryptedImageState {
    const { kind, id: getId, variant: getVariant, eager: getEager, logTag = 'EncryptedImage' } = options;

    const curVariant = (): string => getVariant?.() ?? 'icon';
    const isEager = (): boolean => getEager?.() ?? false;

    const blobUrl = ref<string | null>(null);
    const loading = ref(true);
    const failed = ref(false);
    const wrapperRef = ref<unknown>(null);

    /** 当前已登记引用的目标，用于配对 release（id 变化时要释放旧的那一个） */
    let held: { id: number; variant: string } | null = null;
    let observer: IntersectionObserver | null = null;
    /** 组件已卸载：异步回来后不要再写 ref，也要立刻归还引用 */
    let disposed = false;
    /** 在途请求的取消句柄；null 表示当前没有在跑 */
    let controller: AbortController | null = null;

    function releaseHeld(): void {
        if (!held) return;
        release(kind, held.id, held.variant);
        held = null;
    }

    /** 中止在途下载（滑出视口 / 卸载 / id 变化） */
    function abortInflight(): void {
        controller?.abort();
        controller = null;
    }

    async function load(targetId: number, targetVariant: string): Promise<void> {
        loading.value = true;
        failed.value = false;

        // id 尚未就绪（详情页 onLoad 前 id 为 0）：不起请求，等 watch 带真实 id 再来
        if (!targetId || targetId <= 0) {
            blobUrl.value = null;
            return;
        }

        const ac = typeof AbortController === 'function' ? new AbortController() : null;
        controller = ac;

        try {
            const url = await acquire(kind, targetId, targetVariant, ac?.signal);

            // 等待期间组件被卸载 / 目标又变了 —— 立刻归还，避免引用泄漏
            if (disposed || targetId !== getId() || targetVariant !== curVariant()) {
                release(kind, targetId, targetVariant);
                return;
            }

            releaseHeld();
            held = { id: targetId, variant: targetVariant };
            blobUrl.value = url;
            // 拿到图了，不必再观察
            observer?.disconnect();
            observer = null;
        } catch (err) {
            if (disposed) return;
            // 主动取消是正常路径（滑出视口）：保持骨架屏，等下次进视口重来
            if (isImageAbortError(err)) return;
            // 404 = 服务端没有该资源（如故勒顿骑行立绘 / 无图道具），不是解密失败，
            // 降级为 warn 避免误导。
            if (err instanceof BinaryRequestError && err.statusCode === 404) {
                console.warn(`[${logTag}] 无资源:`, kind, targetId, targetVariant);
            } else {
                console.error(`[${logTag}] 解密失败:`, kind, targetId, targetVariant, err);
            }
            blobUrl.value = null;
            failed.value = true;
        } finally {
            if (controller === ac) controller = null;
            // 取消后仍留在 loading 态（骨架屏），只有成功 / 真失败才收起
            if (!disposed && (blobUrl.value || failed.value)) loading.value = false;
        }
    }

    /** 拿到真实 DOM 元素；uni-app 的 `view` 在 H5 下是组件包装，需取 `$el` */
    function resolveEl(): HTMLElement | null {
        const raw = wrapperRef.value;
        if (!raw) return null;
        if (raw instanceof HTMLElement) return raw;
        const el = (raw as { $el?: unknown }).$el;
        return el instanceof HTMLElement ? el : null;
    }

    function startObserving(): void {
        const el = resolveEl();

        // 小程序 / 老浏览器没有 IntersectionObserver：退化为立即加载
        if (!el || typeof IntersectionObserver === 'undefined') {
            void load(getId(), curVariant());
            return;
        }

        observer = new IntersectionObserver(
            (entries) => {
                const visible = entries.some((e) => e.isIntersecting);
                if (visible) {
                    // 已有图或已在跑就别重复起跑
                    if (blobUrl.value || controller) return;
                    void load(getId(), curVariant());
                } else {
                    // 划走了且还没下完 —— 让出槽位给当前视口
                    abortInflight();
                }
            },
            // 提前 200px 起跑，滚动时不至于看到骨架屏
            { rootMargin: '200px' },
        );
        observer.observe(el);
    }

    onMounted(() => {
        if (isEager()) {
            void load(getId(), curVariant());
            return;
        }
        startObserving();
    });

    // 列表复用同一组件实例时（key 变化以外的场景）跟着目标重新加载
    watch(
        () => [getId(), curVariant()] as const,
        ([nextId, nextVariant], [prevId, prevVariant]) => {
            if (nextId === prevId && nextVariant === prevVariant) return;
            abortInflight();
            blobUrl.value = null;
            failed.value = false;
            // 已在观察中的话让新的一轮接管
            observer?.disconnect();
            observer = null;
            if (isEager() || typeof IntersectionObserver === 'undefined') {
                void load(nextId, nextVariant);
            } else {
                startObserving();
            }
        },
    );

    onUnmounted(() => {
        disposed = true;
        observer?.disconnect();
        observer = null;
        // 在途下载没意义了，中止以腾出槽位给还在屏上的卡片
        abortInflight();
        // 归还引用 —— 缓存条目保留（下次秒开），refs 归零后才允许被 LRU 撤销
        releaseHeld();
    });

    return { blobUrl, loading, failed, wrapperRef };
}
