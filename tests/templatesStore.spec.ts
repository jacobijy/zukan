/**
 * templates store 用例（`src/store/templates.ts`）
 *
 * mock templatesApi（可控 fn）+ authGate（保留真实 LoginDismissedError，仅替换 requireLogin）
 * + uni storage（内存 Map）。覆盖：本地草稿持久化与重载、local→synced→dirty 流转、
 * 保存上云（新建 POST 采用响应 id / 已有 PUT）、409/404 分支、未登录删除墓碑与登录合并补删。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ctrl = vi.hoisted<Record<string, any>>(() => ({}));

vi.mock('@/services/session', () => ({
    isAuthenticated: () => ctrl.isAuth,
    clearSession: () => {
        ctrl.sessionCleared = true;
    },
}));

vi.mock('@/services/session/authGate', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/services/session/authGate')>();
    return {
        ...actual,
        authGate: { ...actual.authGate, requireLogin: () => ctrl.requireLogin() },
    };
});

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

// uni storage：内存 Map，模拟持久化
vi.stubGlobal('uni', {
    getStorageSync: (k: string) => storage.get(k),
    setStorageSync: (k: string, v: unknown) => void storage.set(k, v),
});
const storage = new Map<string, unknown>();

import { RestRequestError } from '@/services/http';
import { LoginDismissedError } from '@/services/session/authGate';
import { emptyTemplate, type TemplatePayload } from '@/services/templates/template-model';
import { useTemplatesStore, type TemplateRecord } from '@/store/templates';

const payload = (): TemplatePayload => ({ ...emptyTemplate('standard'), pokemon_id: 6 });

const localRec = (): TemplateRecord => ({
    id: 'local-x1',
    name: '草稿',
    payload: payload(),
    createdAt: 'c',
    updatedAt: 'u',
    sync: 'local',
});
const syncedRec = (): TemplateRecord => ({
    id: 'srv-1',
    name: '云端',
    payload: payload(),
    createdAt: 'c',
    updatedAt: 'u',
    sync: 'synced',
});

beforeEach(() => {
    setActivePinia(createPinia());
    storage.clear();
    ctrl.isAuth = true;
    ctrl.sessionCleared = false;
    ctrl.requireLogin = vi.fn().mockResolvedValue(undefined);
    ctrl.refresh = vi.fn().mockResolvedValue({ access_token: 'new-token' });
    ctrl.list = vi.fn().mockResolvedValue([]);
    ctrl.create = vi.fn().mockResolvedValue({});
    ctrl.get = vi.fn().mockResolvedValue({});
    ctrl.update = vi.fn().mockResolvedValue({});
    ctrl.remove = vi.fn().mockResolvedValue(undefined);
});

describe('本地草稿持久化', () => {
    it('saveDraft 新建 → 记 local 并写入本地存储；重载后仍可还原', () => {
        const store = useTemplatesStore();
        store.beginCreate('我的喷火龙');
        store.replacePayload(payload());
        store.saveDraft();

        expect(store.currentId).not.toBeNull();
        expect(store.records).toHaveLength(1);
        expect(store.records[0].sync).toBe('local');

        // 重载（新 pinia 实例）→ 从 storage 读回
        setActivePinia(createPinia());
        const reloaded = useTemplatesStore();
        expect(reloaded.records).toHaveLength(1);
        expect(reloaded.records[0].id).toBe(store.currentId);
        expect(reloaded.records[0].payload).toEqual(payload());
    });

    it('saveDraft 已有 synced → 置 dirty 且保留云端 id', () => {
        const store = useTemplatesStore();
        store.records = [syncedRec()];
        store.currentId = 'srv-1';
        store.draftName = '云端';
        store.replacePayload(payload());
        store.saveDraft();

        expect(store.records[0].sync).toBe('dirty');
        expect(store.records[0].id).toBe('srv-1');
    });
});

describe('保存上云', () => {
    it('已登录保存 → 直接 POST（不弹登录层），用响应 id 替换本地 id、置 synced', async () => {
        const store = useTemplatesStore();
        store.records = [localRec()];
        store.currentId = 'local-x1';
        store.draftName = '草稿';
        store.replacePayload(payload());

        const created = { id: 'srv-new', name: '草稿', payload: payload(), created_at: 'c', updated_at: 'u2' };
        ctrl.create = vi.fn().mockResolvedValue(created);

        const out = await store.save();
        expect(ctrl.requireLogin).not.toHaveBeenCalled();
        expect(ctrl.create).toHaveBeenCalledWith('草稿', expect.anything());
        expect(out).toEqual({ status: 'saved', id: 'srv-new' });
        expect(store.currentId).toBe('srv-new');
        expect(store.records[0].id).toBe('srv-new');
        expect(store.records[0].sync).toBe('synced');
    });

    it('未登录 save → 登录关闭 → aborted，不发请求', async () => {
        const store = useTemplatesStore();
        store.beginCreate('n');
        ctrl.isAuth = false;
        ctrl.requireLogin = vi.fn().mockRejectedValue(new LoginDismissedError());

        const out = await store.save();
        expect(out).toEqual({ status: 'aborted' });
        expect(ctrl.create).not.toHaveBeenCalled();
    });

    it('未登录 save → 弹登录层，成功后 POST 上云', async () => {
        const store = useTemplatesStore();
        store.beginCreate('n');
        store.replacePayload(payload());
        ctrl.isAuth = false;
        ctrl.create = vi.fn().mockResolvedValue({ id: 'srv', name: 'n', payload: payload(), created_at: 'c', updated_at: 'u' });

        const out = await store.save();
        expect(ctrl.requireLogin).toHaveBeenCalledOnce();
        expect(out.status).toBe('saved');
        expect(ctrl.create).toHaveBeenCalledOnce();
    });

    it('已有 synced/dirty → PUT（不 POST），成功后置 synced', async () => {
        const store = useTemplatesStore();
        store.records = [syncedRec()];
        store.currentId = 'srv-1';
        store.draftName = '云端改';
        store.replacePayload(payload());
        ctrl.update = vi.fn().mockResolvedValue({ id: 'srv-1', name: '云端改', created_at: 'c', updated_at: 'u2' });

        const out = await store.save();
        expect(out).toEqual({ status: 'saved', id: 'srv-1' });
        expect(ctrl.update).toHaveBeenCalledWith('srv-1', expect.objectContaining({ name: '云端改' }));
        expect(ctrl.create).not.toHaveBeenCalled();
        expect(store.records[0].sync).toBe('synced');
    });

    it('PUT 409 → error conflict，草稿与 id 保留', async () => {
        const store = useTemplatesStore();
        store.records = [syncedRec()];
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

    it('PUT 404 → error not-found，摘除本地记录', async () => {
        const store = useTemplatesStore();
        store.records = [syncedRec()];
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
        const store = useTemplatesStore();
        store.beginCreate('n');
        const out = await store.save();
        expect(out).toEqual({ status: 'invalid', reason: 'pokemon-required' });
        expect(ctrl.create).not.toHaveBeenCalled();
    });
});

describe('401 会话恢复', () => {
    it('保存遇 401 → refresh 成功后重试一次并保存成功', async () => {
        const store = useTemplatesStore();
        store.beginCreate('n');
        store.replacePayload(payload());
        ctrl.create = vi
            .fn()
            .mockRejectedValueOnce(new RestRequestError('过期', 401, { code: 'UNAUTHENTICATED' }))
            .mockResolvedValueOnce({ id: 'srv', name: 'n', payload: payload(), created_at: 'c', updated_at: 'u' });

        const out = await store.save();
        expect(out.status).toBe('saved');
        expect(ctrl.refresh).toHaveBeenCalledOnce();
        expect(ctrl.create).toHaveBeenCalledTimes(2);
        expect(store.currentId).toBe('srv');
    });

    it('refresh 也失败 → 清会话并返回 session-expired，不再重试', async () => {
        const store = useTemplatesStore();
        store.beginCreate('n');
        store.replacePayload(payload());
        ctrl.create = vi.fn().mockRejectedValue(new RestRequestError('过期', 401, { code: 'UNAUTHENTICATED' }));
        ctrl.refresh = vi.fn().mockRejectedValue(new Error('refresh 失败'));

        const out = await store.save();
        expect(out).toEqual({ status: 'error', reason: 'session-expired' });
        expect(ctrl.sessionCleared).toBe(true);
        expect(ctrl.create).toHaveBeenCalledTimes(1);
    });

    it('非 401 错误不触发 refresh', async () => {
        const store = useTemplatesStore();
        store.beginCreate('n');
        store.replacePayload(payload());
        ctrl.create = vi.fn().mockRejectedValue(new RestRequestError('重名', 409, { code: 'CONFLICT' }));

        const out = await store.save();
        expect(out).toEqual({ status: 'error', reason: 'conflict' });
        expect(ctrl.refresh).not.toHaveBeenCalled();
    });

    it('列表 load 遇 401 → refresh 后重拉', async () => {
        const store = useTemplatesStore();
        ctrl.list = vi
            .fn()
            .mockRejectedValueOnce(new RestRequestError('过期', 401, { code: 'UNAUTHENTICATED' }))
            .mockResolvedValueOnce([{ id: 'srv-1', name: '云端', created_at: 'c', updated_at: 'u' }]);

        await store.load();
        expect(ctrl.refresh).toHaveBeenCalledOnce();
        expect(ctrl.list).toHaveBeenCalledTimes(2);
        expect(store.records.some((r) => r.id === 'srv-1')).toBe(true);
    });
});

describe('删除与墓碑', () => {
    it('本地草稿删除 → 直接移除，无需登录', async () => {
        const store = useTemplatesStore();
        store.records = [localRec()];
        ctrl.isAuth = false;
        const out = await store.remove('local-x1');
        expect(out).toEqual({ removed: true });
        expect(store.records).toEqual([]);
    });

    it('synced 未登录删除 → tombstoned、置 deleted 墓碑', async () => {
        const store = useTemplatesStore();
        store.records = [syncedRec()];
        ctrl.isAuth = false;
        const out = await store.remove('srv-1');
        expect(out).toEqual({ tombstoned: true });
        expect(store.records[0].sync).toBe('deleted');
    });

    it('synced 已登录删除 → DELETE 并移除', async () => {
        const store = useTemplatesStore();
        store.records = [syncedRec()];
        const out = await store.remove('srv-1');
        expect(out).toEqual({ removed: true });
        expect(ctrl.remove).toHaveBeenCalledWith('srv-1');
        expect(store.records).toEqual([]);
    });
});

describe('登录合并', () => {
    it('墓碑在云端仍有时 → 补 DELETE 并清墓碑、云端摘要入库 synced', async () => {
        const store = useTemplatesStore();
        store.records = [{ ...syncedRec(), sync: 'deleted' }];
        ctrl.list = vi.fn().mockResolvedValue([{ id: 'srv-1', name: '云端', created_at: 'c', updated_at: 'u' }]);

        await store.load();
        expect(ctrl.remove).toHaveBeenCalledWith('srv-1'); // 墓碑补删
        const synced = store.records.find((r) => r.id === 'srv-1');
        expect(synced?.sync).toBe('synced'); // 云端独有 → 落库
        expect(store.records.some((r) => r.sync === 'deleted')).toBe(false);
    });

    it('云端已无墓碑 id → 墓碑直接清场，不发 DELETE', async () => {
        const store = useTemplatesStore();
        store.records = [{ ...syncedRec(), sync: 'deleted' }];
        ctrl.list = vi.fn().mockResolvedValue([]);

        await store.load();
        expect(ctrl.remove).not.toHaveBeenCalled();
        expect(store.records).toEqual([]);
    });

    it('本地 synced 而云端已删 → 本地移除', async () => {
        const store = useTemplatesStore();
        store.records = [syncedRec()];
        ctrl.list = vi.fn().mockResolvedValue([]);

        await store.load();
        expect(store.records).toEqual([]);
    });

    it('未登录 load → 直接用本地记录，不发请求', async () => {
        const store = useTemplatesStore();
        store.records = [localRec()];
        ctrl.isAuth = false;

        await store.load();
        expect(ctrl.list).not.toHaveBeenCalled();
        expect(store.records).toHaveLength(1);
    });
});
