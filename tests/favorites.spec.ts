/**
 * 收藏本地存储读写用例（`src/store/pokemon.ts` 的 loadLocalFavorites / saveLocalFavorites）
 *
 * 守的是一次静默丢数据的风险：收藏原先用裸 `localStorage.setItem(key, JSON.stringify(ids))`，
 * 改用 `uni.setStorageSync` 后落盘格式变成 `{"type":"object","data":[...]}`。
 * uni 的 `parseValue` 认不出旧的裸 JSON（没有 `type` 字段），会把**原始字符串**
 * 原样返回 —— 读取端不解析字符串形态的话，老用户的收藏会被判成非数组而清空。
 *
 * store 依赖 `uni` 全局与 Pinia，因此这里 stub 一个与 uni-h5 语义一致的 storage
 * （实现参照 `node_modules/@dcloudio/uni-h5/dist/uni-h5.es.js` 的
 * `setStorageSync` / `getStorageOrigin` / `parseValue`），再动态 import store。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

const FAV_KEY = 'pokemonFavorites';

/** 底层 KV，模拟 localStorage 的字符串存储 */
let disk: Map<string, string>;

/** 复刻 uni-h5 的 parseValue：只认带 `type` + `data` 两个键的包装对象 */
function parseValue(value: unknown): unknown {
    const types = ['object', 'string', 'number', 'boolean', 'undefined'];
    try {
        const object = typeof value === 'string' ? JSON.parse(value) : value;
        const type = (object as { type?: string }).type;
        if (type && types.includes(type)) {
            const keys = Object.keys(object as object);
            if (keys.length === 2 && 'data' in (object as object)) {
                const data = (object as { data: unknown }).data;
                if (typeof data === type) return data;
            } else if (keys.length === 1) {
                return '';
            }
        }
    } catch {
        // 非 JSON：交给调用方回退为原始字符串
    }
    return undefined;
}

function installUniStub() {
    disk = new Map();
    vi.stubGlobal('uni', {
        setStorageSync(key: string, data: unknown) {
            const type = typeof data;
            disk.set(key, type === 'string' ? (data as string) : JSON.stringify({ type, data }));
        },
        getStorageSync(key: string) {
            const value = disk.get(key);
            if (typeof value !== 'string') return '';
            const parsed = parseValue(value);
            return parsed !== undefined ? parsed : value;
        },
        removeStorageSync(key: string) {
            disk.delete(key);
        },
    });
}

/** store 在模块级读存储，必须在 stub 就位后重新 import */
async function freshStore() {
    vi.resetModules();
    setActivePinia(createPinia());
    const { usePokemonStore } = await import('@/store/pokemon');
    return usePokemonStore();
}

// services/api 会拉起 uni.request 等平台 API；收藏用例只关心本地存储，直接 stub 掉
vi.mock('@/services/api', () => ({
    favoritesApi: {
        addFavorite: vi.fn().mockResolvedValue(undefined),
        removeFavorite: vi.fn().mockResolvedValue(undefined),
        mergeFavorites: vi.fn().mockResolvedValue([]),
    },
}));
vi.mock('@/services/session', () => ({ isAuthenticated: () => false }));
vi.mock('@/services/pokemon', () => ({ fetchPokemonList: vi.fn().mockResolvedValue([]) }));

describe('收藏本地存储', () => {
    beforeEach(() => {
        installUniStub();
    });

    it('空存储 → 空列表', async () => {
        const store = await freshStore();
        expect(store.favorites).toEqual([]);
    });

    it('迁移旧格式：裸 JSON 字符串', async () => {
        // 旧实现写下的原始形态
        disk.set(FAV_KEY, JSON.stringify([1, 4, 7]));
        const store = await freshStore();
        expect(store.favorites).toEqual([1, 4, 7]);
    });

    it('读取新格式：uni 包装对象', async () => {
        disk.set(FAV_KEY, JSON.stringify({ type: 'object', data: [25, 133] }));
        const store = await freshStore();
        expect(store.favorites).toEqual([25, 133]);
    });

    it('写入用新格式，且能被再次读回', async () => {
        disk.set(FAV_KEY, JSON.stringify([9, 3]));
        const store = await freshStore();
        // 触发一次写入
        store.toggleFavorite(42);

        expect(JSON.parse(disk.get(FAV_KEY)!)).toEqual({ type: 'object', data: [9, 3, 42] });
        const reloaded = await freshStore();
        expect(reloaded.favorites).toEqual([9, 3, 42]);
    });

    it('过滤脏数据，不把 NaN / null 灌进列表', async () => {
        disk.set(FAV_KEY, JSON.stringify({ type: 'object', data: [1, 'x', null, 2, Number.NaN] }));
        const store = await freshStore();
        // JSON 里的 NaN 会序列化成 null，一并被过滤
        expect(store.favorites).toEqual([1, 2]);
    });

    it('非数组 / 无法解析的值降级为空列表', async () => {
        disk.set(FAV_KEY, JSON.stringify({ type: 'object', data: { nope: 1 } }));
        expect((await freshStore()).favorites).toEqual([]);

        installUniStub();
        disk.set(FAV_KEY, 'not json at all');
        expect((await freshStore()).favorites).toEqual([]);
    });

    it('toggleFavorite 增删都持久化', async () => {
        const store = await freshStore();
        store.toggleFavorite(7);
        expect(store.isFavorite(7)).toBe(true);
        expect((await freshStore()).favorites).toEqual([7]);

        const again = await freshStore();
        again.toggleFavorite(7);
        expect(again.isFavorite(7)).toBe(false);
        expect((await freshStore()).favorites).toEqual([]);
    });

    it('写入抛错时内存状态仍然更新（quota 场景）', async () => {
        const store = await freshStore();
        vi.stubGlobal('uni', {
            ...(globalThis as unknown as { uni: object }).uni,
            setStorageSync: () => {
                throw new Error('quota exceeded');
            },
        });

        expect(() => store.toggleFavorite(99)).not.toThrow();
        expect(store.isFavorite(99)).toBe(true);
    });
});
