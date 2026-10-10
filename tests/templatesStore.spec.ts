/**
 * templates store 用例（`src/store/templates.ts`）
 *
 * mock templatesApi（可控 fn）+ session（isAuthenticated / confirmLogin 可控）
 * + uni storage（内存 Map）。覆盖：
 * - 本地草稿：新建持久化与重载、草稿删除免登录、旧本地数据只迁移 local 草稿；
 * - 云端列表：load（缓存 / force）、未登录引导、401 refresh 重拉；
 * - 保存上云：草稿 POST 转云端、PUT、aborted、409/404、未选宝可梦、401 恢复；
 * - 删除云端：已登录 DELETE、未登录取消 aborted（不再有墓碑）。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ctrl = vi.hoisted<Record<string, any>>(() => ({}));

vi.mock('@/services/session', () => ({
    isAuthenticated: () => ctrl.isAuth,
    confirmLogin: () => ctrl.confirmLogin(),
    clearSession: () => {
        ctrl.sessionCleared = true;
    },
}));

vi.mock('@/services/api', () => ({
    authApi: {
        refresh: () => ctrl.refresh(),
    },
    templatesApi: {
        listTemplates: (...a: unknown[]) => ctrl.list(...a),
        createTemplate: (...a: unknown[]) => ctrl.create(...a),
        getTemplate: (...a: unknown[]) => ctrl.get(...a),
        updateTemplate: (...a: unknown[]) => ctrl.update(...a),
        deleteTemplate: (...a: unknown[]) => ctrl.remove(...a),
    },
}));

// uni storage：内存 Map，模拟持久化（直接存 / 取原值，与 store 的数组形态一致）
const storage = new Map<string, unknown>();
vi.stubGlobal('uni', {
    getStorageSync: (k: string) => storage.get(k),
    setStorageSync: (k: string, v: unknown) => void storage.set(k, v),
});

import { RestRequestError } from '@/services/http';
import { emptyTemplate, type TemplatePayload } from '@/services/templates/template-model';
import { useTemplatesStore } from '@/store/templates';

const STORAGE_KEY = 'pokemonTemplates';
const payload = (): TemplatePayload => ({ ...emptyTemplate('standard'), pokemon_id: 6 });
const summary = (id = 'srv-1', name = '云端', updated_at = 'u') => ({
    id,
    name,
    created_at: 'c',
    updated_at,
});
const full = (id: string, name: string) => ({
    id,
    name,
    payload: payload(),
    created_at: 'c',
    updated_at: 'u2',
});

function newStore() {
    setActivePinia(createPinia());
    return useTemplatesStore();
}

beforeEach(() => {
    storage.clear();
    ctrl.isAuth = true;
    ctrl.sessionCleared = false;
    ctrl.confirmLogin = vi.fn().mockResolvedValue(true);
    ctrl.refresh = vi.fn().mockResolvedValue({ access_token: 'new-token' });
    ctrl.list = vi.fn().mockResolvedValue([]);
    ctrl.create = vi.fn().mockResolvedValue({});
    ctrl.get = vi.fn().mockResolvedValue({});
    ctrl.update = vi.fn().mockResolvedValue({});
    ctrl.remove = vi.fn().mockResolvedValue(undefined);
});

describe('本地草稿', () => {
    it('saveDraft 新建 → local 草稿，写入本地存储；重载后仍可还原', () => {
        const store = newStore();
        store.beginCreate('我的喷火龙');
        store.replacePayload(payload());
        store.saveDraft();

        expect(store.currentId).toMatch(/^local-/);
        expect(store.records).toHaveLength(1);
        expect(store.records[0].sync).toBe('local');
        expect(store.records[0].payload).toEqual(payload());

        const reloaded = newStore();
        expect(reloaded.records).toHaveLength(1);
        expect(reloaded.records[0].id).toBe(store.currentId);
    });

    it('未登录删除本地草稿 → 直接移除，不调 DELETE，并清掉本地存储', async () => {
        const store = newStore();
        store.beginCreate('d');
        store.replacePayload(payload());
        store.saveDraft();
        const id = store.currentId!;

        ctrl.isAuth = false;
        const out = await store.remove(id);
        expect(out).toEqual({ removed: true });
        expect(ctrl.remove).not.toHaveBeenCalled();
        expect(store.records).toEqual([]);
        expect(newStore().records).toEqual([]);
    });

    it('旧本地数据迁移：只保留 local 草稿，synced/dirty/deleted 一律丢弃', () => {
        storage.set(STORAGE_KEY, [
            { id: 'local-a', name: '草稿', payload: payload(), createdAt: 'c', updatedAt: 'u', sync: 'local' },
            { id: 'srv-1', name: '云', payload: payload(), createdAt: 'c', updatedAt: 'u', sync: 'synced' },
            { id: 'srv-2', name: '脏', payload: payload(), createdAt: 'c', updatedAt: 'u', sync: 'dirty' },
            { id: 'srv-3', name: '墓', payload: payload(), createdAt: 'c', updatedAt: 'u', sync: 'deleted' },
        ]);
        const store = newStore();
        expect(store.records.map((r) => r.id)).toEqual(['local-a']);
        expect(store.records[0].sync).toBe('local');
    });
});

describe('云端列表 load', () => {
    it('已登录 → GET 填充云端摘要（payload null），缓存后不重复拉、force 才刷新', async () => {
        const store = newStore();
        ctrl.list = vi.fn().mockResolvedValue([summary('srv-1', '云端')]);
        await store.load();

        expect(store.needsLogin).toBe(false);
        const rec = store.records.find((r) => r.id === 'srv-1');
        expect(rec?.sync).toBe('synced');
        expect(rec?.payload).toBeNull();

        await store.load();
        expect(ctrl.list).toHaveBeenCalledTimes(1);
        await store.load(true);
        expect(ctrl.list).toHaveBeenCalledTimes(2);
    });

    it('未登录 → needsLogin、不发请求、云端为空（草稿仍保留）', async () => {
        const store = newStore();
        store.beginCreate('d');
        store.replacePayload(payload());
        store.saveDraft();

        ctrl.isAuth = false;
        await store.load();
        expect(ctrl.list).not.toHaveBeenCalled();
        expect(store.needsLogin).toBe(true);
        expect(store.records).toHaveLength(1); // 只剩本地草稿
        expect(store.records[0].sync).toBe('local');
    });

    it('load 遇 401 → refresh 后重拉', async () => {
        const store = newStore();
        ctrl.list = vi
            .fn()
            .mockRejectedValueOnce(new RestRequestError('过期', 401, { code: 'UNAUTHENTICATED' }))
            .mockResolvedValueOnce([summary('srv-1')]);
        await store.load();
        expect(ctrl.refresh).toHaveBeenCalledOnce();
        expect(ctrl.list).toHaveBeenCalledTimes(2);
        expect(store.records.some((r) => r.id === 'srv-1')).toBe(true);
    });
});

describe('保存上云', () => {
    it('草稿 POST：用响应 id 转云端、删本地草稿，storage 中草稿消失', async () => {
        const store = newStore();
        store.beginCreate('草稿');
        store.replacePayload(payload());
        store.saveDraft();
        ctrl.create = vi.fn().mockResolvedValue(full('srv-new', '草稿'));

        const out = await store.save();
        expect(ctrl.confirmLogin).toHaveBeenCalled();
        expect(ctrl.create).toHaveBeenCalledWith('草稿', expect.anything());
        expect(out).toEqual({ status: 'saved', id: 'srv-new' });
        expect(store.currentId).toBe('srv-new');
        expect(store.records[0].id).toBe('srv-new');
        expect(store.records[0].sync).toBe('synced');
        // 本地草稿已删除（重载后只剩空，云端不持久本地）
        expect(newStore().records).toEqual([]);
    });

    it('未登录取消登录 → aborted，不发请求', async () => {
        const store = newStore();
        store.beginCreate('n');
        store.replacePayload(payload());
        ctrl.confirmLogin = vi.fn().mockResolvedValue(false);

        const out = await store.save();
        expect(out).toEqual({ status: 'aborted' });
        expect(ctrl.create).not.toHaveBeenCalled();
    });

    it('未登录但完成登录 → 续跑 POST 上云', async () => {
        const store = newStore();
        store.beginCreate('n');
        store.replacePayload(payload());
        ctrl.isAuth = false;
        ctrl.create = vi.fn().mockResolvedValue(full('srv', 'n'));

        const out = await store.save();
        expect(out.status).toBe('saved');
        expect(ctrl.create).toHaveBeenCalledOnce();
    });

    it('云端已有条目（server id）→ PUT，不 POST', async () => {
        const store = newStore();
        store.cloudSummaries = [summary('srv-1', '云端')];
        store.currentId = 'srv-1';
        store.draftName = '云端改';
        store.replacePayload(payload());
        ctrl.update = vi.fn().mockResolvedValue(full('srv-1', '云端改'));

        const out = await store.save();
        expect(out).toEqual({ status: 'saved', id: 'srv-1' });
        expect(ctrl.update).toHaveBeenCalledWith('srv-1', expect.objectContaining({ name: '云端改' }));
        expect(ctrl.create).not.toHaveBeenCalled();
    });

    it('PUT 409 → conflict，当前编辑态保留', async () => {
        const store = newStore();
        store.cloudSummaries = [summary('srv-1')];
        store.currentId = 'srv-1';
        store.draftName = '云端';
        store.replacePayload(payload());
        ctrl.update = vi.fn().mockRejectedValue(
            new RestRequestError('重名', 409, { error: '模板名已存在', code: 'CONFLICT' }),
        );

        const out = await store.save();
        expect(out).toEqual({ status: 'error', reason: 'conflict', message: '模板名已存在' });
        expect(store.currentId).toBe('srv-1');
        expect(store.draftName).toBe('云端');
    });

    it('PUT 404 → not-found，摘除云端记录、currentId 清空', async () => {
        const store = newStore();
        store.cloudSummaries = [summary('srv-1')];
        store.currentId = 'srv-1';
        store.draftName = '云端';
        store.replacePayload(payload());
        ctrl.update = vi.fn().mockRejectedValue(new RestRequestError('x', 404, { code: 'NOT_FOUND' }));

        const out = await store.save();
        expect(out).toEqual({ status: 'error', reason: 'not-found' });
        expect(store.records).toEqual([]);
        expect(store.currentId).toBeNull();
    });

    it('宝可梦未选（payload null）→ invalid pokemon-required，不发请求', async () => {
        const store = newStore();
        store.beginCreate('n');
        const out = await store.save();
        expect(out).toEqual({ status: 'invalid', reason: 'pokemon-required' });
        expect(ctrl.create).not.toHaveBeenCalled();
    });

    it('保存遇 401 → refresh 成功重试并保存；refresh 失败 → session-expired', async () => {
        const store = newStore();
        store.beginCreate('n');
        store.replacePayload(payload());
        ctrl.create = vi
            .fn()
            .mockRejectedValueOnce(new RestRequestError('过期', 401, { code: 'UNAUTHENTICATED' }))
            .mockResolvedValueOnce(full('srv', 'n'));
        const ok = await store.save();
        expect(ok.status).toBe('saved');
        expect(ctrl.create).toHaveBeenCalledTimes(2);

        // 再来一次：refresh 失败
        const store2 = newStore();
        store2.beginCreate('n2');
        store2.replacePayload(payload());
        ctrl.create = vi.fn().mockRejectedValue(new RestRequestError('过期', 401, { code: 'UNAUTHENTICATED' }));
        ctrl.refresh = vi.fn().mockRejectedValue(new Error('refresh 失败'));
        const bad = await store2.save();
        expect(bad).toEqual({ status: 'error', reason: 'session-expired' });
        expect(ctrl.sessionCleared).toBe(true);
    });
});

describe('删除云端条目', () => {
    it('已登录 → DELETE 并从云端列表移除', async () => {
        const store = newStore();
        store.cloudSummaries = [summary('srv-1')];
        const out = await store.remove('srv-1');
        expect(out).toEqual({ removed: true });
        expect(ctrl.remove).toHaveBeenCalledWith('srv-1');
        expect(store.records).toEqual([]);
    });

    it('未登录取消登录 → aborted，不 DELETE、记录保留（无墓碑）', async () => {
        const store = newStore();
        store.cloudSummaries = [summary('srv-1')];
        ctrl.confirmLogin = vi.fn().mockResolvedValue(false);
        const out = await store.remove('srv-1');
        expect(out).toEqual({ aborted: true });
        expect(ctrl.remove).not.toHaveBeenCalled();
        expect(store.records.some((r) => r.id === 'srv-1')).toBe(true);
    });
});
