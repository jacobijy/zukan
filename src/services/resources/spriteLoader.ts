/**
 * 立绘加载编排：低清 preview 先行 + 高清回落链。
 *
 * 刻意与 Vue 无关，也不直接 import `spriteCache` —— 依赖全部由 `SpriteLoadDeps`
 * 注入。原因有二：
 *
 * 1. **可测**。`vitest.config.ts` 是 `environment: 'node'`，项目没装
 *    `@vue/test-utils` / happy-dom，写在 composable 里（`onMounted` / `onUnmounted`）
 *    的编排跑不起来。这里是纯 async 函数，用假 deps 就能把「preview 404 静默」
 *    「非 404 不回落」「stale 时两槽引用都归还」这些分支全部覆盖。
 * 2. **引用配对只有一处**。漏 release 是 `type-check` 抓不到的静默泄漏
 *    （条目 refs 永不归零 → 永不被 LRU 淘汰），必须收敛到单一位置。
 *
 * ## 引用归属约定（别搞错，搞错就是泄漏或裂图）
 *
 * - 返回 `loaded` / `missing` 时，结果里出现的每个 `SpriteRef` 都**处于持有状态**
 *   （refs 已 +1），调用方负责在不用时逐个 `release`。
 * - 返回 `stale` 或抛错时，本函数**已经把自己拿到的引用全部归还**，调用方不必也
 *   不应再 release。
 *
 * 两段加载的收益见 `@/constants/spriteVariants` 的体积对照表。
 */

/** 一张已持有引用的立绘 */
export interface SpriteRef {
    variant: string;
    url: string;
}

export type SpriteLoadResult =
    /** 高清命中。`preview` 非空时调用方拿到图后要把它释放掉 */
    | { status: 'loaded'; full: SpriteRef; preview: SpriteRef | null }
    /** 回落链全 404，服务器确实没有这张图；preview 若命中则仍可继续显示 */
    | { status: 'missing'; preview: SpriteRef | null }
    /** 加载途中目标变了 / 组件卸载了，引用已归还，调用方直接丢弃 */
    | { status: 'stale' };

export interface SpriteLoadPlan {
    /** 低清先行 variant；`null` 或与链首相同则跳过这一段 */
    preview: string | null;
    /** 高清尝试顺序，首项是主 variant（见 `buildSpriteChain`） */
    chain: string[];
}

export interface SpriteLoadDeps {
    /** 取图并登记引用。`priority` 越大越先跑（preview 传 1） */
    acquire: (variant: string, priority: number) => Promise<string>;
    /** 归还一次引用 */
    release: (variant: string) => void;
    /** 目标是否已失效（组件卸载 / id 变了）。每个 await 之后都会问一次 */
    isStale: () => boolean;
    /** preview 到手时回调，让 UI 立刻先显示低清图 */
    onPreview: (ref: SpriteRef) => void;
    /** 该错误是否为「服务器没有这张图」（HTTP 404） */
    isNotFound: (err: unknown) => boolean;
    /**
     * 跨刷新的历史结论（`spriteAvailability`），用来抄近路。**注入而非直接 import** ——
     * 那个模块要读 `uni` storage，直接依赖会让本文件的 node 用例必须 stub 全局 uni。
     * 缺席时退化为「每次都走完整流程」，行为与加此优化前一致。
     */
    hint?: SpriteLoadHint;
}

/**
 * 历史结论的读写口。语义见 `spriteAvailability.ts`。
 *
 * **记录只是提示，不是真相**：按 `resolved` 直奔却 404 时必须 `forget()` 并退回完整
 * 回落链，否则一次偶然的 404 会被永久固化成「这个形态没图」。
 */
export interface SpriteLoadHint {
    /** 已知实际命中的 variant（主 variant 曾 404） */
    resolved?: string;
    /** 已知 preview 不存在，跳过第一段 */
    noPreview?: boolean;
    /** 记下实际命中的 variant */
    onResolved?: (resolved: string) => void;
    /** 记下 preview 不存在 */
    onNoPreview?: () => void;
    /** 记下整条链都没图 */
    onNoSprite?: () => void;
    /** 结论过期（按记录直奔却 404）：作废重学 */
    forget?: () => void;
}

/**
 * 按历史结论重排尝试顺序：把已知可用的 variant 提到最前，其余保持原序兜底。
 *
 * 刻意**不删掉**其它 variant —— 记录可能过期（上游补了 `home`），保留完整链才能在
 * 直奔失败后继续回落。这里只改顺序，不改集合。
 */
function reorderByHint(chain: string[], resolved: string | undefined): string[] {
    if (!resolved || chain[0] === resolved) return chain;
    const i = chain.indexOf(resolved);
    if (i < 0) return chain;
    return [resolved, ...chain.slice(0, i), ...chain.slice(i + 1)];
}

export async function loadSpriteChain(plan: SpriteLoadPlan, deps: SpriteLoadDeps): Promise<SpriteLoadResult> {
    let preview: SpriteRef | null = null;

    /** 归还本函数持有的一切。stale / 抛错路径专用。 */
    const releaseAll = (): void => {
        if (preview) deps.release(preview.variant);
        preview = null;
    };

    // ── 第一段：低清先行 ─────────────────────────────────────
    // 与链首相同时跳过：那就是目标本身，先拉一遍纯属多一次 acquire。
    // 历史结论说该 id 没有 preview（如 10301 无 front）时也跳过，省一次 404。
    if (plan.preview && plan.preview !== plan.chain[0] && !deps.hint?.noPreview) {
        try {
            const url = await deps.acquire(plan.preview, 1);
            if (deps.isStale()) {
                deps.release(plan.preview);
                return { status: 'stale' };
            }
            preview = { variant: plan.preview, url };
            deps.onPreview(preview);
        } catch (err) {
            // 404 静默跳过：preview 只是提速手段，某个 id 没有 front（如 10301）
            // 不该拖累主图。其它错误（解密失败 / 中止）照抛 —— 同一把 DEK 解不开
            // front 就解不开 home，把它当"没图"会把真故障伪装成数据缺口。
            if (!deps.isNotFound(err)) throw err;
            // 记下来，下次不必再问一遍
            deps.hint?.onNoPreview?.();
        }
        // 上面的 catch 吞掉 404 后也要重新检查：等待期间可能已经划出视口
        if (deps.isStale()) {
            releaseAll();
            return { status: 'stale' };
        }
    }

    // ── 第二段：高清回落链 ───────────────────────────────────
    // 逐个串行尝试，**不能**并行：并行等于每张图都多下几个 variant，
    // 白烧流量与并发槽，而绝大多数 id 第一个就命中。
    //
    // 已知命中的 variant 提到最前（只改顺序不改集合）—— 记录可能过期，
    // 直奔失败后仍要能沿原链回落。
    const chain = reorderByHint(plan.chain, deps.hint?.resolved);
    /** 是否有过 404（决定这次结果要不要回写记录） */
    let sawNotFound = false;

    for (const variant of chain) {
        try {
            // eslint-disable-next-line no-await-in-loop -- 串行是本意，见上
            const url = await deps.acquire(variant, 0);
            if (deps.isStale()) {
                deps.release(variant);
                releaseAll();
                return { status: 'stale' };
            }
            // 只在「主 variant 曾 404」时回写 —— 一切正常的默认情形不值得存
            if (sawNotFound) deps.hint?.onResolved?.(variant);
            return { status: 'loaded', full: { variant, url }, preview };
        } catch (err) {
            // 404 才继续试下一个。解密失败 / 网络错要立刻抛出去 ——
            // 拿它当「这个形态没图」会把真故障伪装成数据缺口，排障时看不见。
            if (!deps.isNotFound(err)) {
                releaseAll();
                throw err;
            }
            sawNotFound = true;
            // 按历史结论直奔却 404：结论过期了（上游改了图），作废重学。
            // 不作废的话每次都会先撞这个 404，比没有记录还慢。
            if (variant === deps.hint?.resolved) deps.hint.forget?.();
            if (deps.isStale()) {
                releaseAll();
                return { status: 'stale' };
            }
        }
    }

    // 整条链都 404：服务器确实没有这张图（如 10264 / 10268）。
    // preview 若已到手就保留着 —— 有低清总比灰占位好。
    deps.hint?.onNoSprite?.();
    return { status: 'missing', preview };
}
