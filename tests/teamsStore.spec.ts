/**
 * teams store 用例（`src/store/teams.ts`）
 *
 * mock teamsApi（可控 fn）+ authGate（保留真实 LoginDismissedError，仅替换 requireLogin）。
 * 覆盖：登录闸门（关闭静默中止）、新建 POST 采用响应 id、已有 PUT、409/404 分支、
 * 客户端校验拦截、未登录 load 不抛错。
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
    teamsApi: {
        listTeams: (...a: unknown[]) => ctrl.list(...a),
        createTeam: (...a: unknown[]) => ctrl.create(...a),
        getTeam: (...a: unknown[]) => ctrl.get(...a),
        updateTeam: (...a: unknown[]) => ctrl.update(...a),
        deleteTeam: (...a: unknown[]) => ctrl.remove(...a),
    },
}));

import { RestRequestError } from '@/services/http';
import { LoginDismissedError } from '@/services/session/authGate';
import { normalizePayload } from '@/services/teams/team-model';
import { useTeamsStore } from '@/store/teams';

const gone = { id: 'gone', name: 'g', created_at: 'c', updated_at: 'u' };

beforeEach(() => {
    setActivePinia(createPinia());
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

describe('save 新建', () => {
    it('已登录直接 POST（不弹登录层），currentId 采用响应 id（非本地造），摘要新增', async () => {
        const store = useTeamsStore();
        store.beginCreate('新队');
        expect(store.currentId).toBeNull();

        const created = { id: 'srv-id', name: '新队', payload: {}, created_at: 'c', updated_at: 'u' };
        ctrl.create = vi.fn().mockResolvedValue(created);

        const out = await store.save();
        expect(ctrl.requireLogin).not.toHaveBeenCalled();
        expect(ctrl.create).toHaveBeenCalledWith('新队', expect.anything());
        expect(out).toEqual({ status: 'saved', id: 'srv-id' });
        expect(store.currentId).toBe('srv-id');
        expect(store.summaries.map((s) => s.id)).toEqual(['srv-id']);
    });

    it('未登录弹登录层，登录被关闭 → aborted，不发请求、不抛错', async () => {
        const store = useTeamsStore();
        store.beginCreate('n');
        ctrl.isAuth = false;
        ctrl.requireLogin = vi.fn().mockRejectedValue(new LoginDismissedError());

        const out = await store.save();
        expect(out).toEqual({ status: 'aborted' });
        expect(ctrl.create).not.toHaveBeenCalled();
    });
});

describe('save 已有队伍', () => {
    async function opened() {
        const store = useTeamsStore();
        ctrl.get = vi.fn().mockResolvedValue({
            id: 'srv-id',
            name: 'n',
            payload: { format: 'singles', members: [] },
            created_at: 'c',
            updated_at: 'u',
        });
        await store.open('srv-id');
        return store;
    }

    it('PUT（不 POST），并更新 updated_at', async () => {
        const store = await opened();
        store.setName('n2');
        ctrl.update = vi.fn().mockResolvedValue({ id: 'srv-id', name: 'n2', created_at: 'c', updated_at: 'u2' });

        const out = await store.save();
        expect(out).toEqual({ status: 'saved', id: 'srv-id' });
        expect(ctrl.update).toHaveBeenCalledWith('srv-id', expect.objectContaining({ name: 'n2' }));
        expect(ctrl.create).not.toHaveBeenCalled();
        expect(store.summaries[0].updated_at).toBe('u2');
    });

    it('PUT 409 → error conflict，草稿与 currentId 保留', async () => {
        const store = await opened();
        ctrl.update = vi.fn().mockRejectedValue(
            new RestRequestError('重名', 409, { error: '队伍名已存在', code: 'CONFLICT' }),
        );

        const out = await store.save();
        expect(out).toEqual({ status: 'error', reason: 'conflict', message: '队伍名已存在' });
        expect(store.currentId).toBe('srv-id');
        expect(store.draftName).toBe('n');
    });
});

describe('客户端校验拦截', () => {
    it('名字全空白 → invalid name-required，不发请求', async () => {
        const store = useTeamsStore();
        store.beginCreate('   ');
        const out = await store.save();
        expect(out).toEqual({ status: 'invalid', reason: 'name-required' });
        expect(ctrl.create).not.toHaveBeenCalled();
    });

    it('payload 超 32KiB → invalid payload-too-large', async () => {
        const store = useTeamsStore();
        store.beginCreate('n');
        store.replacePayload(normalizePayload({ note: 'x'.repeat(33000) }));

        const out = await store.save();
        expect(out).toEqual({ status: 'invalid', reason: 'payload-too-large' });
        expect(ctrl.create).not.toHaveBeenCalled();
    });
});

describe('404', () => {
    it('open 404 → 摘除摘要、currentId=null，并向上抛', async () => {
        const store = useTeamsStore();
        store.summaries = [{ ...gone }];
        ctrl.get = vi.fn().mockRejectedValue(
            new RestRequestError('x', 404, { error: '不存在', code: 'NOT_FOUND' }),
        );

        await expect(store.open('gone')).rejects.toBeInstanceOf(RestRequestError);
        expect(store.summaries).toEqual([]);
        expect(store.currentId).toBeNull();
    });

    it('remove 404 仍按已删除处理', async () => {
        const store = useTeamsStore();
        store.summaries = [{ ...gone }];
        ctrl.remove = vi.fn().mockRejectedValue(new RestRequestError('x', 404, {}));

        const out = await store.remove('gone');
        expect(out).toEqual({ removed: true });
        expect(store.summaries).toEqual([]);
    });
});

describe('load', () => {
    it('未登录 → needsLogin=true、空列表，不请求不抛错', async () => {
        const store = useTeamsStore();
        ctrl.isAuth = false;
        await expect(store.load()).resolves.toBeUndefined();
        expect(store.needsLogin).toBe(true);
        expect(store.summaries).toEqual([]);
        expect(ctrl.list).not.toHaveBeenCalled();
    });

    it('已登录 → GET 摘要', async () => {
        const store = useTeamsStore();
        ctrl.list = vi.fn().mockResolvedValue([{ ...gone }]);
        await store.load();
        expect(store.summaries).toEqual([{ ...gone }]);
    });
});

describe('rename', () => {
    it('PUT 仅 name，更新摘要', async () => {
        const store = useTeamsStore();
        store.summaries = [{ ...gone }];
        ctrl.update = vi.fn().mockResolvedValue({ ...gone, name: '新名' });

        const out = await store.rename('gone', '新名');
        expect(out).toEqual({ updated: true });
        expect(ctrl.update).toHaveBeenCalledWith('gone', { name: '新名' });
        expect(store.summaries[0].name).toBe('新名');
    });
});

describe('401 会话恢复', () => {
    it('保存遇 401 → refresh 成功后重试一次并保存成功', async () => {
        const store = useTeamsStore();
        store.beginCreate('新队');
        ctrl.create = vi
            .fn()
            .mockRejectedValueOnce(new RestRequestError('过期', 401, { code: 'UNAUTHENTICATED' }))
            .mockResolvedValueOnce({ id: 'srv', name: '新队', payload: {}, created_at: 'c', updated_at: 'u' });

        const out = await store.save();
        expect(out).toEqual({ status: 'saved', id: 'srv' });
        expect(ctrl.refresh).toHaveBeenCalledOnce();
        expect(ctrl.create).toHaveBeenCalledTimes(2);
        expect(store.currentId).toBe('srv');
    });

    it('refresh 也失败 → 清会话并返回 session-expired，不再重试', async () => {
        const store = useTeamsStore();
        store.beginCreate('新队');
        ctrl.create = vi.fn().mockRejectedValue(new RestRequestError('过期', 401, { code: 'UNAUTHENTICATED' }));
        ctrl.refresh = vi.fn().mockRejectedValue(new Error('refresh 失败'));

        const out = await store.save();
        expect(out).toEqual({ status: 'error', reason: 'session-expired' });
        expect(ctrl.sessionCleared).toBe(true);
        expect(ctrl.create).toHaveBeenCalledTimes(1);
    });

    it('非 401 错误不触发 refresh', async () => {
        const store = useTeamsStore();
        store.beginCreate('新队');
        ctrl.create = vi.fn().mockRejectedValue(new RestRequestError('重名', 409, { code: 'CONFLICT' }));

        const out = await store.save();
        expect(out).toEqual({ status: 'error', reason: 'conflict' });
        expect(ctrl.refresh).not.toHaveBeenCalled();
    });
});
