/**
 * 收藏「纯后端」用例（`src/store/pokemon.ts` 的 favorites 切片）
 *
 * 收藏不再落本地存储：
 * - `toggleFavorite` 先经 `confirmLogin` 闸门（未登录确认/登录取消则什么都不做），
 *   再乐观更新内存并调 add/remove API，失败回滚；
 * - `loadFavorites` 已登录从 `GET /favorites` 拉取，未登录不发请求；
 * - `resetFavorites` 登出时清空内存。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ctrl = vi.hoisted<Record<string, any>>(() => ({}));

vi.mock('@/services/pokemon', () => ({ fetchPokemonList: vi.fn().mockResolvedValue([]) }));
vi.mock('@/services/api', () => ({
    favoritesApi: {
        listFavorites: (...a: unknown[]) => ctrl.list(...a),
        addFavorite: (...a: unknown[]) => ctrl.add(...a),
        removeFavorite: (...a: unknown[]) => ctrl.remove(...a),
    },
}));
vi.mock('@/services/session', () => ({
    isAuthenticated: () => ctrl.isAuth,
    confirmLogin: () => ctrl.confirmLogin(),
}));

import { usePokemonStore } from '@/store/pokemon';

function newStore() {
    setActivePinia(createPinia());
    return usePokemonStore();
}

beforeEach(() => {
    setActivePinia(createPinia());
    // store/i18n 等可能在 setup 读存储；给一个最小 uni stub
    vi.stubGlobal('uni', {
        getStorageSync: () => '',
        setStorageSync: () => undefined,
        removeStorageSync: () => undefined,
    });
    ctrl.isAuth = true;
    ctrl.confirmLogin = vi.fn().mockResolvedValue(true);
    ctrl.list = vi.fn().mockResolvedValue([1, 4, 7]);
    ctrl.add = vi.fn().mockResolvedValue(undefined);
    ctrl.remove = vi.fn().mockResolvedValue(undefined);
});

describe('loadFavorites', () => {
    it('已登录从后端拉取填充', async () => {
        const store = newStore();
        await store.loadFavorites();
        expect(store.favorites).toEqual([1, 4, 7]);
        expect(store.isFavorite(4)).toBe(true);
    });

    it('未登录不发请求并置空', async () => {
        const store = newStore();
        ctrl.isAuth = false;
        await store.loadFavorites();
        expect(ctrl.list).not.toHaveBeenCalled();
        expect(store.favorites).toEqual([]);
    });

    it('已加载后不重复拉取，force 才刷新', async () => {
        const store = newStore();
        await store.loadFavorites();
        await store.loadFavorites();
        expect(ctrl.list).toHaveBeenCalledTimes(1);
        await store.loadFavorites(true);
        expect(ctrl.list).toHaveBeenCalledTimes(2);
    });

    it('拉取失败静默置空、不抛错', async () => {
        const store = newStore();
        ctrl.list = vi.fn().mockRejectedValue(new Error('net'));
        await expect(store.loadFavorites()).resolves.toBeUndefined();
        expect(store.favorites).toEqual([]);
    });

    it('脏数据被过滤为有限数字', async () => {
        const store = newStore();
        ctrl.list = vi.fn().mockResolvedValue([1, 'x', null, 2, Number.NaN]);
        await store.loadFavorites();
        expect(store.favorites).toEqual([1, 2]);
    });
});

describe('toggleFavorite', () => {
    it('未登录且在确认/登录处取消 → 不调 API、状态不变', async () => {
        const store = newStore();
        await store.loadFavorites();
        ctrl.confirmLogin = vi.fn().mockResolvedValue(false);
        await store.toggleFavorite(99);
        expect(ctrl.add).not.toHaveBeenCalled();
        expect(store.isFavorite(99)).toBe(false);
    });

    it('放行后 add：乐观加入，API 成功则保留', async () => {
        const store = newStore();
        await store.loadFavorites();
        await store.toggleFavorite(99);
        expect(ctrl.confirmLogin).toHaveBeenCalled();
        expect(ctrl.add).toHaveBeenCalledWith(99);
        expect(store.isFavorite(99)).toBe(true);
    });

    it('已收藏再点 → remove', async () => {
        const store = newStore();
        await store.loadFavorites(); // [1, 4, 7]
        await store.toggleFavorite(4);
        expect(ctrl.remove).toHaveBeenCalledWith(4);
        expect(store.isFavorite(4)).toBe(false);
    });

    it('add 失败 → 回滚内存', async () => {
        const store = newStore();
        await store.loadFavorites();
        ctrl.add = vi.fn().mockRejectedValue(new Error('500'));
        await store.toggleFavorite(99);
        expect(store.isFavorite(99)).toBe(false);
    });

    it('remove 失败 → 把 id 加回内存', async () => {
        const store = newStore();
        await store.loadFavorites();
        ctrl.remove = vi.fn().mockRejectedValue(new Error('500'));
        await store.toggleFavorite(4);
        expect(store.isFavorite(4)).toBe(true);
    });
});

describe('resetFavorites', () => {
    it('清空内存并允许下次重新拉取', async () => {
        const store = newStore();
        await store.loadFavorites();
        expect(store.favorites.length).toBeGreaterThan(0);
        store.resetFavorites();
        expect(store.favorites).toEqual([]);
        await store.loadFavorites();
        expect(ctrl.list).toHaveBeenCalledTimes(2);
    });
});
