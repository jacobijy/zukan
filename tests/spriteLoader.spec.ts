/**
 * `src/services/resources/spriteLoader.ts` 用例
 *
 * 编排本身的分支很多，但真正会咬人的只有两类：
 *
 * 1. **引用配对**。漏一次 release，条目 refs 永不归零 → 永不被 LRU 淘汰
 *    （静默泄漏，`type-check` 看不见）；多 release 一次则会把在屏图的 refs
 *    扣成 0 → 被撤销 → 裂图。所以每个用例都对账 `refs`。
 * 2. **404 与真故障的区分**。把解密失败当"这个形态没图"会让真故障伪装成数据
 *    缺口，排障时完全看不见。
 *
 * deps 全是假的，不碰网络 / WASM / 缓存。
 */
import { describe, expect, it } from 'vitest';
import { loadSpriteChain, type SpriteLoadDeps } from '@/services/resources/spriteLoader';

class NotFound extends Error {}
class Boom extends Error {}

interface Harness {
    deps: SpriteLoadDeps;
    /** variant → 当前引用数；跑完对账用 */
    refs: Map<string, number>;
    previews: string[];
    acquired: { variant: string; priority: number }[];
    setStale: () => void;
    /** 记录层收到的回写调用（顺序即发生顺序） */
    hintCalls: string[];
}

/**
 * @param available 哪些 variant 能取到（其余抛 NotFound）
 * @param opts.throwOn 该 variant 抛非 404 错误（模拟解密失败）
 * @param opts.staleAfter 第 N 次 acquire 成功后置为 stale（N 从 1 起）
 * @param opts.hint 注入的历史结论（resolved / noPreview）
 */
function harness(
    available: string[],
    opts: {
        throwOn?: string;
        staleAfter?: number;
        hint?: { resolved?: string; noPreview?: boolean };
    } = {},
): Harness {
    const refs = new Map<string, number>();
    const previews: string[] = [];
    const acquired: { variant: string; priority: number }[] = [];
    const hintCalls: string[] = [];
    let stale = false;
    let okCount = 0;

    const deps: SpriteLoadDeps = {
        acquire: async (variant, priority) => {
            acquired.push({ variant, priority });
            if (opts.throwOn === variant) throw new Boom(variant);
            if (!available.includes(variant)) throw new NotFound(variant);
            okCount += 1;
            if (opts.staleAfter === okCount) stale = true;
            refs.set(variant, (refs.get(variant) ?? 0) + 1);
            return `blob:${variant}`;
        },
        release: (variant) => {
            const n = refs.get(variant) ?? 0;
            // 归还一个从未持有的引用 —— 真跑起来就是把别人的图撤掉
            expect(n, `release("${variant}") 时并未持有引用`).toBeGreaterThan(0);
            refs.set(variant, n - 1);
        },
        isStale: () => stale,
        onPreview: (ref) => previews.push(ref.variant),
        isNotFound: (err) => err instanceof NotFound,
        hint: {
            resolved: opts.hint?.resolved,
            noPreview: opts.hint?.noPreview,
            onResolved: (r) => hintCalls.push(`resolved:${r}`),
            onNoPreview: () => hintCalls.push('noPreview'),
            onNoSprite: () => hintCalls.push('noSprite'),
            forget: () => hintCalls.push('forget'),
        },
    };

    return { deps, refs, previews, acquired, hintCalls, setStale: () => { stale = true; } };
}

/** 剩余引用总数（结果里返回的那些不算泄漏，由调用方接管） */
function totalRefs(refs: Map<string, number>): number {
    let sum = 0;
    for (const n of refs.values()) sum += n;
    return sum;
}

describe('loadSpriteChain — 渐进式两段加载', () => {
    it('preview 先到手并回调，随后高清覆盖且 preview 引用被归还', async () => {
        const h = harness(['front', 'home']);

        const result = await loadSpriteChain({ preview: 'front', chain: ['home'] }, h.deps);

        expect(h.previews).toEqual(['front']);
        expect(result).toEqual({
            status: 'loaded',
            full: { variant: 'home', url: 'blob:home' },
            preview: { variant: 'front', url: 'blob:front' },
        });
        // preview 与 full 的引用都还持有着 —— 交给调用方（composable 换图后释放 preview）
        expect(h.refs.get('front')).toBe(1);
        expect(h.refs.get('home')).toBe(1);
    });

    it('preview 走高优先级、高清走普通优先级 —— 整屏低清先跑完再换高清', async () => {
        const h = harness(['front', 'home']);

        await loadSpriteChain({ preview: 'front', chain: ['home'] }, h.deps);

        expect(h.acquired).toEqual([
            { variant: 'front', priority: 1 },
            { variant: 'home', priority: 0 },
        ]);
    });

    it('preview 与链首相同时不重复 acquire', async () => {
        const h = harness(['front']);

        const result = await loadSpriteChain({ preview: 'front', chain: ['front'] }, h.deps);

        expect(h.acquired).toEqual([{ variant: 'front', priority: 0 }]);
        expect(h.previews).toEqual([]);
        expect(result.status).toBe('loaded');
    });

    it('preview 404 静默跳过（如 10301 有 home 无 front），主图照常', async () => {
        const h = harness(['home']);

        const result = await loadSpriteChain({ preview: 'front', chain: ['home'] }, h.deps);

        expect(h.previews).toEqual([]);
        expect(result).toMatchObject({ status: 'loaded', full: { variant: 'home' }, preview: null });
    });

    it('preview 抛非 404（解密失败）时直接抛出 —— 同一把 DEK 解不开 front 就解不开 home', async () => {
        const h = harness(['home'], { throwOn: 'front' });

        await expect(
            loadSpriteChain({ preview: 'front', chain: ['home'] }, h.deps),
        ).rejects.toBeInstanceOf(Boom);
        expect(h.acquired.map((a) => a.variant)).toEqual(['front']);
    });

    it('preview 为 null 时完全跳过第一段', async () => {
        const h = harness(['home']);

        await loadSpriteChain({ preview: null, chain: ['home'] }, h.deps);

        expect(h.acquired).toEqual([{ variant: 'home', priority: 0 }]);
    });
});

describe('loadSpriteChain — 404 回落链', () => {
    it('主 variant 404 时回落到 artwork（10080–10085 角色扮演皮卡丘的实况）', async () => {
        const h = harness(['front', 'artwork']);

        const result = await loadSpriteChain(
            { preview: 'front', chain: ['home', 'artwork', 'front'] },
            h.deps,
        );

        expect(h.acquired.map((a) => a.variant)).toEqual(['front', 'home', 'artwork']);
        expect(result).toMatchObject({ status: 'loaded', full: { variant: 'artwork' } });
    });

    it('全链 404 返回 missing，preview 保留（有低清好过灰占位）', async () => {
        const h = harness(['front']);

        const result = await loadSpriteChain(
            { preview: 'front', chain: ['home', 'artwork'] },
            h.deps,
        );

        expect(result).toEqual({
            status: 'missing',
            preview: { variant: 'front', url: 'blob:front' },
        });
        expect(h.refs.get('front')).toBe(1);
    });

    it('全链 404 且无 preview 返回 missing/null（10264、10268 的实况）', async () => {
        const h = harness([]);

        const result = await loadSpriteChain(
            { preview: 'front', chain: ['home', 'artwork', 'front'] },
            h.deps,
        );

        expect(result).toEqual({ status: 'missing', preview: null });
        expect(totalRefs(h.refs)).toBe(0);
    });

    it('链中非 404 错误立即抛出，不继续回落 —— 真故障不能伪装成数据缺口', async () => {
        const h = harness(['artwork'], { throwOn: 'home' });

        await expect(
            loadSpriteChain({ preview: null, chain: ['home', 'artwork'] }, h.deps),
        ).rejects.toBeInstanceOf(Boom);
        // artwork 从未被尝试
        expect(h.acquired.map((a) => a.variant)).toEqual(['home']);
    });

    it('链中抛错时已持有的 preview 引用被归还，不泄漏', async () => {
        const h = harness(['front'], { throwOn: 'home' });

        await expect(
            loadSpriteChain({ preview: 'front', chain: ['home'] }, h.deps),
        ).rejects.toBeInstanceOf(Boom);
        expect(totalRefs(h.refs)).toBe(0);
    });
});

describe('loadSpriteChain — stale（卸载 / 目标变了）', () => {
    it('preview 到手后变 stale：引用归还，不回调上屏', async () => {
        const h = harness(['front', 'home'], { staleAfter: 1 });

        const result = await loadSpriteChain({ preview: 'front', chain: ['home'] }, h.deps);

        expect(result).toEqual({ status: 'stale' });
        expect(totalRefs(h.refs)).toBe(0);
        expect(h.previews).toEqual([]);
    });

    it('高清到手后变 stale：preview 与 full 两个引用都归还', async () => {
        // 第 2 次成功 acquire（= home）之后置 stale
        const h = harness(['front', 'home'], { staleAfter: 2 });

        const result = await loadSpriteChain({ preview: 'front', chain: ['home'] }, h.deps);

        expect(result).toEqual({ status: 'stale' });
        expect(totalRefs(h.refs)).toBe(0);
    });

    it('回落途中变 stale：不再试后续 variant，已持有的归还', async () => {
        const h = harness(['front', 'artwork']);
        // preview 拿到后手动置 stale，模拟"刚点亮就划出视口"
        const origPreview = h.deps.onPreview;
        h.deps.onPreview = (ref) => {
            origPreview(ref);
            h.setStale();
        };

        const result = await loadSpriteChain(
            { preview: 'front', chain: ['home', 'artwork'] },
            h.deps,
        );

        expect(result).toEqual({ status: 'stale' });
        expect(totalRefs(h.refs)).toBe(0);
        // home 都不该发出去
        expect(h.acquired.map((a) => a.variant)).toEqual(['front']);
    });

    it('preview 404 后立刻 stale：不继续拉高清', async () => {
        const h = harness(['home']);
        const origIsStale = h.deps.isStale;
        let calls = 0;
        h.deps.isStale = () => {
            calls += 1;
            // 第一次询问（preview 404 之后那次）就说已失效
            return calls >= 1 ? true : origIsStale();
        };

        const result = await loadSpriteChain({ preview: 'front', chain: ['home'] }, h.deps);

        expect(result).toEqual({ status: 'stale' });
        expect(h.acquired.map((a) => a.variant)).toEqual(['front']);
        expect(totalRefs(h.refs)).toBe(0);
    });
});

/**
 * 跨刷新记录（`spriteAvailability`）的消费。
 *
 * 这一组守的核心是「记录只是提示，不是真相」：抄近路可以，但一旦记录过期，
 * 必须能沿完整回落链救回来 —— 否则一次偶然 404 会被永久固化成「这个形态没图」。
 */
describe('loadSpriteChain — 历史结论（少跑 404）', () => {
    it('按记录直奔已知可用的 variant，跳过必然 404 的主 variant', async () => {
        const h = harness(['front', 'artwork'], { hint: { resolved: 'artwork' } });

        const result = await loadSpriteChain(
            { preview: 'front', chain: ['home', 'artwork', 'front'] },
            h.deps,
        );

        // home 根本没发出去 —— 这就是省下来的那次 404
        expect(h.acquired.map((a) => a.variant)).toEqual(['front', 'artwork']);
        expect(result).toMatchObject({ status: 'loaded', full: { variant: 'artwork' } });
    });

    it('直奔命中时不回写记录（结论没变，省一次 storage 写）', async () => {
        const h = harness(['artwork'], { hint: { resolved: 'artwork' } });

        await loadSpriteChain({ preview: null, chain: ['home', 'artwork'] }, h.deps);

        expect(h.hintCalls).toEqual([]);
    });

    it('noPreview 记录让第一段整段跳过', async () => {
        const h = harness(['home'], { hint: { noPreview: true } });

        await loadSpriteChain({ preview: 'front', chain: ['home'] }, h.deps);

        expect(h.acquired.map((a) => a.variant)).toEqual(['home']);
        expect(h.previews).toEqual([]);
    });

    it('记录过期（上游补了 home）：直奔仍走原顺序，home 命中', async () => {
        // 记录说 artwork，但 home 现在可用了 —— reorder 把 artwork 提前，
        // 它成功了就返回 artwork。这是可接受的：图能显示，且下次 record 会更新。
        const h = harness(['home', 'artwork'], { hint: { resolved: 'artwork' } });

        const result = await loadSpriteChain({ preview: null, chain: ['home', 'artwork'] }, h.deps);

        expect(result).toMatchObject({ status: 'loaded', full: { variant: 'artwork' } });
    });

    it('记录过期且该 variant 已 404：作废记录并沿链救回来', async () => {
        // 记录说 artwork，但 artwork 被删了、只剩 home —— 必须回落到 home，
        // 而不是直接判"没图"
        const h = harness(['home'], { hint: { resolved: 'artwork' } });

        const result = await loadSpriteChain({ preview: null, chain: ['home', 'artwork'] }, h.deps);

        expect(h.acquired.map((a) => a.variant)).toEqual(['artwork', 'home']);
        expect(result).toMatchObject({ status: 'loaded', full: { variant: 'home' } });
        // 过期结论被作废，且回写了新结论
        expect(h.hintCalls).toContain('forget');
        expect(h.hintCalls).toContain('resolved:home');
    });

    it('reorder 只改顺序不删元素 —— 完整链仍在，否则救不回来', async () => {
        // 记录指向 front，但只有 home 可用；front 在链尾，reorder 后 home 仍应被试到
        const h = harness(['home'], { hint: { resolved: 'front' } });

        const result = await loadSpriteChain(
            { preview: null, chain: ['home', 'artwork', 'front'] },
            h.deps,
        );

        expect(h.acquired.map((a) => a.variant)).toEqual(['front', 'home']);
        expect(result).toMatchObject({ status: 'loaded', full: { variant: 'home' } });
    });

    it('记录里的 variant 不在链上时忽略它（换了主 variant 的场景）', async () => {
        const h = harness(['shiny'], { hint: { resolved: 'artwork' } });

        const result = await loadSpriteChain({ preview: null, chain: ['shiny'] }, h.deps);

        expect(h.acquired.map((a) => a.variant)).toEqual(['shiny']);
        expect(result).toMatchObject({ status: 'loaded', full: { variant: 'shiny' } });
    });

    it('首次遇到回落：回写实际命中的 variant', async () => {
        const h = harness(['artwork']);

        await loadSpriteChain({ preview: null, chain: ['home', 'artwork'] }, h.deps);

        expect(h.hintCalls).toEqual(['resolved:artwork']);
    });

    it('主 variant 直接命中时不回写（默认情形，1300+ id 走这条）', async () => {
        const h = harness(['home']);

        await loadSpriteChain({ preview: null, chain: ['home', 'artwork'] }, h.deps);

        expect(h.hintCalls).toEqual([]);
    });

    it('preview 首次 404：回写 noPreview', async () => {
        const h = harness(['home']);

        await loadSpriteChain({ preview: 'front', chain: ['home'] }, h.deps);

        expect(h.hintCalls).toEqual(['noPreview']);
    });

    it('全链 404：回写 noSprite，下次一个请求都不发', async () => {
        const h = harness([]);

        const result = await loadSpriteChain(
            { preview: 'front', chain: ['home', 'artwork', 'front'] },
            h.deps,
        );

        expect(result).toEqual({ status: 'missing', preview: null });
        expect(h.hintCalls).toContain('noSprite');
    });

    it('真故障（非 404）不得回写任何结论 —— 否则一次网络抖动会永久隐藏这张图', async () => {
        const h = harness(['artwork'], { throwOn: 'home' });

        await expect(
            loadSpriteChain({ preview: null, chain: ['home', 'artwork'] }, h.deps),
        ).rejects.toBeInstanceOf(Boom);

        expect(h.hintCalls).toEqual([]);
    });

    it('stale 时不回写结论（没跑完，结论不可信）', async () => {
        const h = harness(['artwork'], { staleAfter: 1 });

        const result = await loadSpriteChain({ preview: null, chain: ['home', 'artwork'] }, h.deps);

        expect(result).toEqual({ status: 'stale' });
        expect(h.hintCalls.filter((c) => c.startsWith('resolved'))).toEqual([]);
    });

    it('不注入 hint 时行为与加此优化前完全一致', async () => {
        const h = harness(['artwork']);
        // 去掉 hint，模拟 item 种类 / 旧调用方
        h.deps.hint = undefined;

        const result = await loadSpriteChain({ preview: null, chain: ['home', 'artwork'] }, h.deps);

        expect(h.acquired.map((a) => a.variant)).toEqual(['home', 'artwork']);
        expect(result).toMatchObject({ status: 'loaded', full: { variant: 'artwork' } });
    });
});
