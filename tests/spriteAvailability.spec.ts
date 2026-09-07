/**
 * `src/services/resources/spriteAvailability.ts` 用例
 *
 * 这一层的价值全在「少跑 404」，而它的危险也全在同一处：**记录写错就会把图弄没**。
 * 所以断言集中在三件事：
 *
 * 1. 只存偏离默认的条目（否则 1300+ id 会把几十 KB 塞进 uni storage）；
 * 2. 版本变化 / 数据损坏时整份作废（拿旧版本结论指挥新资源 = 全站图错）；
 * 3. 结论可撤销（`forget` / 主 variant 恢复可用），不能把一次偶然 404 固化。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/** 与 uni-h5 语义一致的 storage stub（同步、值原样存取） */
let kv: Map<string, unknown>;
/** 当前数据版本，用例可改以模拟版本升级 */
let version: number;

vi.mock('@/services/resources/dataVersion', () => ({
    currentDataVersion: () => version,
}));

type Mod = typeof import('@/services/resources/spriteAvailability');

async function freshModule(): Promise<Mod> {
    vi.resetModules();
    return import('@/services/resources/spriteAvailability');
}

const STORAGE_KEY = 'zukan_sprite_avail';

beforeEach(() => {
    kv = new Map();
    version = 2;
    vi.useFakeTimers();
    vi.stubGlobal('uni', {
        getStorageSync: (key: string) => kv.get(key) ?? '',
        setStorageSync: (key: string, value: unknown) => {
            kv.set(key, value);
        },
        removeStorageSync: (key: string) => {
            kv.delete(key);
        },
    });
});

afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

/** 索引写入带 500ms 防抖，推进定时器让它落盘 */
function flushDebounce(): void {
    vi.advanceTimersByTime(600);
}

function stored(): { v: number; e: Record<string, unknown> } | null {
    const raw = kv.get(STORAGE_KEY);
    return typeof raw === 'string' && raw ? JSON.parse(raw) : null;
}

describe('无记录时的默认行为', () => {
    it('查不到就是全默认 —— 照常走完整流程', async () => {
        const m = await freshModule();
        expect(m.getSpriteHint(1, 'home')).toEqual({ noPreview: false, noSprite: false });
    });

    it('主 variant 可用时不写任何条目（默认情形不值得存）', async () => {
        const m = await freshModule();
        m.recordResolvedVariant(1, 'home', 'home');
        flushDebounce();
        expect(m.spriteAvailabilityStats().entries).toBe(0);
    });
});

describe('记录回落结论', () => {
    it('记下实际命中的 variant，跨"刷新"仍可读到', async () => {
        const m = await freshModule();
        m.recordResolvedVariant(10084, 'home', 'artwork');
        flushDebounce();

        // 模拟刷新：换一份模块实例，只剩 storage 里那份
        const m2 = await freshModule();
        expect(m2.getSpriteHint(10084, 'home').resolved).toBe('artwork');
    });

    it('记下 preview 缺失（10301 无 front）', async () => {
        const m = await freshModule();
        m.recordNoPreview(10301, 'home');
        flushDebounce();

        const m2 = await freshModule();
        expect(m2.getSpriteHint(10301, 'home').noPreview).toBe(true);
    });

    it('记下整条链无图（10264）', async () => {
        const m = await freshModule();
        m.recordNoSprite(10264, 'home');
        flushDebounce();

        const m2 = await freshModule();
        expect(m2.getSpriteHint(10264, 'home').noSprite).toBe(true);
    });

    it('不同主 variant 各自独立 —— 详情页传 artwork 不该读到 home 的结论', async () => {
        const m = await freshModule();
        m.recordResolvedVariant(10084, 'home', 'artwork');
        flushDebounce();

        expect(m.getSpriteHint(10084, 'home').resolved).toBe('artwork');
        expect(m.getSpriteHint(10084, 'artwork').resolved).toBeUndefined();
    });

    it('多条记录共存，互不覆盖', async () => {
        const m = await freshModule();
        m.recordResolvedVariant(10084, 'home', 'artwork');
        m.recordNoPreview(10301, 'home');
        m.recordNoSprite(10264, 'home');
        flushDebounce();

        const m2 = await freshModule();
        expect(m2.spriteAvailabilityStats().entries).toBe(3);
        expect(m2.getSpriteHint(10084, 'home').resolved).toBe('artwork');
        expect(m2.getSpriteHint(10301, 'home').noPreview).toBe(true);
        expect(m2.getSpriteHint(10264, 'home').noSprite).toBe(true);
    });

    it('同一 id 的 noPreview 与 resolved 可以并存（10080 既无 home 也无…场景）', async () => {
        const m = await freshModule();
        m.recordNoPreview(10158, 'home');
        m.recordResolvedVariant(10158, 'home', 'artwork');
        flushDebounce();

        const hint = m.getSpriteHint(10158, 'home');
        expect(hint.noPreview).toBe(true);
        expect(hint.resolved).toBe('artwork');
    });
});

describe('结论可撤销 —— 不把偶然 404 固化', () => {
    it('forget 后回到无记录状态', async () => {
        const m = await freshModule();
        m.recordResolvedVariant(10084, 'home', 'artwork');
        flushDebounce();
        expect(m.getSpriteHint(10084, 'home').resolved).toBe('artwork');

        m.forgetSprite(10084, 'home');
        flushDebounce();
        expect(m.getSpriteHint(10084, 'home').resolved).toBeUndefined();
        expect(m.spriteAvailabilityStats().entries).toBe(0);
    });

    it('主 variant 恢复可用时清掉旧的回落结论（上游补了 home）', async () => {
        const m = await freshModule();
        m.recordResolvedVariant(10084, 'home', 'artwork');
        m.recordResolvedVariant(10084, 'home', 'home'); // 这次 home 成功了
        flushDebounce();

        expect(m.getSpriteHint(10084, 'home').resolved).toBeUndefined();
    });

    it('主 variant 恢复可用时也清掉 noSprite（上游补了图）', async () => {
        const m = await freshModule();
        m.recordNoSprite(10264, 'home');
        m.recordResolvedVariant(10264, 'home', 'home');
        flushDebounce();

        expect(m.getSpriteHint(10264, 'home').noSprite).toBe(false);
    });

    it('记下回落 variant 时清掉 noSprite（之前以为没图，其实 artwork 能用）', async () => {
        const m = await freshModule();
        m.recordNoSprite(10084, 'home');
        m.recordResolvedVariant(10084, 'home', 'artwork');
        flushDebounce();

        const hint = m.getSpriteHint(10084, 'home');
        expect(hint.noSprite).toBe(false);
        expect(hint.resolved).toBe('artwork');
    });

    it('forget 未知 key 不抛错', async () => {
        const m = await freshModule();
        expect(() => m.forgetSprite(999, 'home')).not.toThrow();
    });
});

describe('版本失效', () => {
    it('版本号变化 → 整份记录作废（旧结论不能指挥新资源）', async () => {
        const m = await freshModule();
        m.recordResolvedVariant(10084, 'home', 'artwork');
        flushDebounce();
        expect(stored()?.v).toBe(2);

        // 服务端 bump 到 3，重新加载模块
        version = 3;
        const m2 = await freshModule();
        expect(m2.getSpriteHint(10084, 'home').resolved).toBeUndefined();
        expect(m2.spriteAvailabilityStats().entries).toBe(0);
    });

    it('pruneSpriteAvailability 按 keepVersion 重置并立即落盘', async () => {
        const m = await freshModule();
        m.recordResolvedVariant(10084, 'home', 'artwork');
        flushDebounce();

        // 调用点在 setStoredDataVersion 之前，故传新版本号而非读 currentDataVersion
        m.pruneSpriteAvailability(3);

        expect(m.spriteAvailabilityStats()).toEqual({ entries: 0, version: 3 });
        // 不等防抖 —— prune 是同步落盘的
        expect(stored()).toEqual({ v: 3, e: {} });
    });

    it('prune 后新写入的条目挂在新版本下', async () => {
        const m = await freshModule();
        m.pruneSpriteAvailability(3);
        m.recordResolvedVariant(1, 'home', 'artwork');
        flushDebounce();

        expect(stored()?.v).toBe(3);
    });
});

describe('容错', () => {
    it('storage 里是坏 JSON → 当空记录，不抛错', async () => {
        kv.set(STORAGE_KEY, '{not json');
        const m = await freshModule();
        expect(m.getSpriteHint(1, 'home')).toEqual({ noPreview: false, noSprite: false });
    });

    it('storage 里结构不对（e 不是对象）→ 当空记录', async () => {
        kv.set(STORAGE_KEY, JSON.stringify({ v: 2, e: 'nope' }));
        const m = await freshModule();
        expect(m.spriteAvailabilityStats().entries).toBe(0);
    });

    it('缺 v 字段 → 当空记录（老格式或手改过）', async () => {
        kv.set(STORAGE_KEY, JSON.stringify({ e: { '1/home': { r: 'artwork' } } }));
        const m = await freshModule();
        expect(m.getSpriteHint(1, 'home').resolved).toBeUndefined();
    });

    it('getStorageSync 抛错 → 当空记录，不影响调用方', async () => {
        vi.stubGlobal('uni', {
            getStorageSync: () => {
                throw new Error('storage unavailable');
            },
            setStorageSync: () => {},
        });
        const m = await freshModule();
        expect(() => m.getSpriteHint(1, 'home')).not.toThrow();
    });

    it('setStorageSync 抛错（配额满）→ 静默降级，不影响当前这张图', async () => {
        vi.stubGlobal('uni', {
            getStorageSync: () => '',
            setStorageSync: () => {
                throw new Error('quota exceeded');
            },
        });
        const m = await freshModule();
        m.recordResolvedVariant(10084, 'home', 'artwork');
        expect(() => flushDebounce()).not.toThrow();
        // 内存态仍然可用（本次会话内仍能少跑 404）
        expect(m.getSpriteHint(10084, 'home').resolved).toBe('artwork');
    });
});

describe('写入防抖', () => {
    it('连续写入合并成一次落盘（首屏会连续学到多条）', async () => {
        let writes = 0;
        vi.stubGlobal('uni', {
            getStorageSync: (key: string) => kv.get(key) ?? '',
            setStorageSync: (key: string, value: unknown) => {
                writes += 1;
                kv.set(key, value);
            },
        });
        const m = await freshModule();

        for (let id = 10080; id <= 10085; id += 1) {
            m.recordResolvedVariant(id, 'home', 'artwork');
        }
        expect(writes).toBe(0); // 还没到点

        flushDebounce();
        expect(writes).toBe(1); // 6 条合并成 1 次
        expect(Object.keys(stored()!.e)).toHaveLength(6);
    });
});
