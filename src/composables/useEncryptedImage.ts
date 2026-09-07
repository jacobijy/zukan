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
 * 「先低清后高清」与「404 回落链」的编排不在这里，而在
 * `services/resources/spriteLoader.ts`（纯函数，无 Vue 依赖，可在 node 测试环境
 * 直接跑）。本文件只把它的结果映射成渲染状态。道具走同一条路径，只是 plan 退化
 * 为「无 preview、单项 chain」。
 *
 * 返回的状态交给组件渲染：`blobUrl` 有值显示图片；`loading` 为真显示骨架；
 * 两者都否（`failed`）显示组件自己的兜底图 / 占位盒。
 */
import { ref, onMounted, onUnmounted, watch, type Ref } from 'vue';
import { acquireSprite, releaseSprite } from '@/services/resources/spriteCache';
import { acquireItemIcon, releaseItemIcon } from '@/services/resources/itemImage';
import { isImageAbortError } from '@/services/resources/imageCache';
import { loadSpriteChain } from '@/services/resources/spriteLoader';
import {
    getSpriteHint,
    recordResolvedVariant,
    recordNoPreview,
    recordNoSprite,
    forgetSprite,
} from '@/services/resources/spriteAvailability';
import { BinaryRequestError } from '@/services/http';
import type { ImageKind } from '@/services/resources/imageKind';

export interface EncryptedImageState {
    blobUrl: Ref<string | null>;
    /** 没有最终结果时为真；离屏取消后保持为真（等下次进视口重试，仍显示骨架） */
    loading: Ref<boolean>;
    /** 真失败（含全链 404 无资源）；离屏取消不算 */
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
    /** 低清先行 variant（如 `front`）；返回 null 关掉渐进式 */
    preview?: () => string | null;
    /** 主 variant 404 后的尝试顺序（含主 variant 自身）；缺省只试主 variant */
    chain?: () => string[];
    /** 数据层已知没图（`hasSprite === false`）：不发请求，直接判失败 */
    skip?: () => boolean;
    /** 日志前缀，便于排障 */
    logTag?: string;
}

function acquire(
    kind: ImageKind,
    id: number,
    variant: string,
    priority: number,
    signal: AbortSignal | undefined,
): Promise<string> {
    return kind === 'pokemon' ? acquireSprite(id, variant, { signal, priority }) : acquireItemIcon(id, { signal });
}

function release(kind: ImageKind, id: number, variant: string): void {
    if (kind === 'pokemon') releaseSprite(id, variant);
    else releaseItemIcon(id);
}

function isNotFound(err: unknown): boolean {
    return err instanceof BinaryRequestError && err.statusCode === 404;
}

export function useEncryptedImage(options: UseEncryptedImageOptions): EncryptedImageState {
    const {
        kind,
        id: getId,
        variant: getVariant,
        eager: getEager,
        preview: getPreview,
        chain: getChain,
        skip: getSkip,
        logTag = 'EncryptedImage',
    } = options;

    const curVariant = (): string => getVariant?.() ?? 'icon';
    const isEager = (): boolean => getEager?.() ?? false;

    const blobUrl = ref<string | null>(null);
    const loading = ref(true);
    const failed = ref(false);
    const wrapperRef = ref<unknown>(null);

    /**
     * 当前**由本 composable 持有**引用的图。
     *
     * 加载途中的 preview 引用归 `loadSpriteChain` 所有，不进这里 —— 两边都记的话，
     * 「preview 已上屏 → 组件卸载」会走成 `releaseHeld()` 与 `loadSpriteChain` 各
     * 归还一次，把别人的引用扣成 0 导致在屏图被 revoke（裂图）。所有权在
     * `loadSpriteChain` 返回的那一刻单向移交给这里。
     */
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

        // 数据层已判定这个形态没有正面立绘 —— 直接落兜底，省一次必然 404 的往返
        if (getSkip?.()) {
            blobUrl.value = null;
            failed.value = true;
            loading.value = false;
            return;
        }

        // 上一轮实测过「整条回落链都没图」（跨刷新记录）—— 同样一个请求都不发。
        // 与 `skip` 的区别：那个来自后端打包时的 hasSprite，这个来自前端运行时实测。
        const hint = kind === 'pokemon' ? getSpriteHint(targetId, targetVariant) : null;
        if (hint?.noSprite) {
            blobUrl.value = null;
            failed.value = true;
            loading.value = false;
            return;
        }

        const ac = typeof AbortController === 'function' ? new AbortController() : null;
        controller = ac;

        /** 目标变了 / 组件没了：spriteLoader 据此提前收手并归还引用 */
        const isStale = (): boolean => disposed || targetId !== getId() || targetVariant !== curVariant();

        try {
            const result = await loadSpriteChain(
                {
                    preview: getPreview?.() ?? null,
                    chain: getChain?.() ?? [targetVariant],
                },
                {
                    acquire: (variant, priority) => acquire(kind, targetId, variant, priority, ac?.signal),
                    release: (variant) => release(kind, targetId, variant),
                    isStale,
                    // 跨刷新记录只对 sprite 有意义（道具无 variant、无回落链）
                    hint: hint
                        ? {
                              resolved: hint.resolved,
                              noPreview: hint.noPreview,
                              onResolved: (resolved) => recordResolvedVariant(targetId, targetVariant, resolved),
                              onNoPreview: () => recordNoPreview(targetId, targetVariant),
                              onNoSprite: () => recordNoSprite(targetId, targetVariant),
                              forget: () => forgetSprite(targetId, targetVariant),
                          }
                        : undefined,
                    onPreview: (previewRef) => {
                        // 低清先上屏：此刻就收起骨架，整屏在几十毫秒内点亮。
                        // 只改渲染状态，**不碰 `held`** —— 这一段的引用仍归
                        // loadSpriteChain 管，它会在 stale / 换高清时自己归还。
                        blobUrl.value = previewRef.url;
                        loading.value = false;
                    },
                    isNotFound,
                },
            );

            if (result.status === 'stale') {
                // 引用已由 loadSpriteChain 全部归还，这里什么都不持有
                return;
            }

            if (result.status === 'missing') {
                if (result.preview) {
                    // 高清全 404 但低清有（罕见）：留着低清，好过灰占位。
                    // 所有权在此移交，卸载时由 releaseHeld 归还。
                    releaseHeld();
                    held = { id: targetId, variant: result.preview.variant };
                    blobUrl.value = result.preview.url;
                } else {
                    console.warn(`[${logTag}] 无资源:`, kind, targetId, targetVariant);
                    blobUrl.value = null;
                    failed.value = true;
                }
                return;
            }

            // 高清到手：接管它的引用，归还上一轮的旧图与这一轮的 preview
            releaseHeld();
            held = { id: targetId, variant: result.full.variant };
            blobUrl.value = result.full.url;
            if (result.preview) release(kind, targetId, result.preview.variant);
            // 拿到图了，不必再观察
            observer?.disconnect();
            observer = null;
        } catch (err) {
            if (disposed) return;
            // 主动取消是正常路径（滑出视口）：保持骨架屏，等下次进视口重来
            if (isImageAbortError(err) || (err instanceof BinaryRequestError && err.aborted)) return;
            console.error(`[${logTag}] 解密失败:`, kind, targetId, targetVariant, err);
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
            // 旧目标的图不会再显示了，两槽都归还
            releaseHeld();
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
