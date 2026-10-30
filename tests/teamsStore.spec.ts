/**
 * teams store 用例（`src/store/teams.ts`）
 *
 * mock teamsApi（可控 fn）+ confirmLogin（session 写操作闸门，mock 为可控 fn）。
 * 覆盖：登录闸门（未登录确认/登录被取消 → 静默中止）、新建 POST 采用响应 id、已有 PUT、
 * 409/404 分支、客户端校验拦截、未登录 load 不抛错。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ctrl = vi.hoisted<Record<string, any>>(() => ({}));

vi.mock('@/services/session', () => ({
    isAuthenticated: () => ctrl.isAuth,
    ensureFreshSession: () => Promise.resolve(ctrl.isAuth),
    confirmLogin: () => ctrl.confirmLogin(),
    clearSession: () => {
        ctrl.sessionCleared = true;
    },
}));

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
import { emptyMember, normalizePayload } from '@/services/teams/team-model';
import { useTeamsStore } from '@/store/teams';

const gone = { id: 'gone', name: 'g', created_at: 'c', updated_at: 'u' };

beforeEach(() => {
    setActivePinia(createPinia());
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

describe('save 新建', () => {
    it('已登录直接 POST（不弹登录层），currentId 采用响应 id（非本地造），摘要新增', async () => {
        const store = useTeamsStore();
        store.beginCreate('新队');
        expect(store.currentId).toBeNull();

        const created = { id: 'srv-id', name: '新队', payload: {}, created_at: 'c', updated_at: 'u' };
        ctrl.create = vi.fn().mockResolvedValue(created);

        const out = await store.save();
        expect(ctrl.confirmLogin).toHaveBeenCalledTimes(1);
        expect(ctrl.create).toHaveBeenCalledWith('新队', expect.anything());
        expect(out).toEqual({ status: 'saved', id: 'srv-id' });
        expect(store.currentId).toBe('srv-id');
        expect(store.summaries.map((s) => s.id)).toEqual(['srv-id']);
    });

    it('未登录且在「是否去登录」确认或登录框处取消 → aborted，不发请求、不抛错', async () => {
        const store = useTeamsStore();
        store.beginCreate('n');
        ctrl.isAuth = false;
        ctrl.confirmLogin = vi.fn().mockResolvedValue(false);

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

// ── 列表缩略图预取（previews） ─────────────────────────

function deferred<T>() {
    let resolve!: (value: T) => void;
    let reject!: (reason: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
}

const teamSummary = (id: string, updated_at = 'u') => ({ id, name: id, created_at: 'c', updated_at });

const teamDetail = (id: string, members: unknown[] = [{ species_id: 25 }], format = 'singles') => ({
    id,
    name: id,
    payload: { format, members },
    created_at: 'c',
    updated_at: 'u',
});

describe('列表缩略图预取', () => {
    it('load 先返回摘要，详情在后台填充 previews（不阻塞）', async () => {
        const store = useTeamsStore();
        const gate = deferred<ReturnType<typeof teamDetail>>();
        ctrl.list = vi.fn().mockResolvedValue([teamSummary('t1')]);
        ctrl.get = vi.fn(() => gate.promise);

        await store.load();
        expect(store.summaries.map((s) => s.id)).toEqual(['t1']);
        expect(store.previews).toEqual({});

        gate.resolve(teamDetail('t1', [{ species_id: 25 }, { species_id: 6, form_id: 10006 }]));
        await store.prefetchPreviews();

        expect(store.previews.t1.members).toHaveLength(2);
        expect(store.previews.t1.members[1]).toMatchObject({ species_id: 6, form_id: 10006 });
    });

    it('4 并发预取；已缓存 / 无新增时不重复请求', async () => {
        const store = useTeamsStore();
        let active = 0;
        let maxActive = 0;
        ctrl.list = vi.fn().mockResolvedValue(Array.from({ length: 20 }, (_, i) => teamSummary(`t${i}`)));
        ctrl.get = vi.fn(async (id: string) => {
            active++;
            maxActive = Math.max(maxActive, active);
            await new Promise((resolve) => setTimeout(resolve, 0));
            active--;
            return teamDetail(id);
        });

        await store.load();
        await store.prefetchPreviews();
        expect(ctrl.get).toHaveBeenCalledTimes(20);
        expect(maxActive).toBeLessThanOrEqual(4);
        expect(Object.keys(store.previews)).toHaveLength(20);

        ctrl.get = vi.fn();
        await store.prefetchPreviews();
        expect(ctrl.get).not.toHaveBeenCalled();
    });

    it('重复调用复用同一个预取任务（不重复发请求）', async () => {
        const store = useTeamsStore();
        const gate = deferred<ReturnType<typeof teamDetail>>();
        ctrl.list = vi.fn().mockResolvedValue([teamSummary('t1')]);
        ctrl.get = vi.fn(() => gate.promise);

        await store.load();
        // Pinia 会包装 action 返回的 Promise（每次调用拿到新包装），因此断言底层只发一次请求
        const a = store.prefetchPreviews();
        const b = store.prefetchPreviews();
        expect(ctrl.get).toHaveBeenCalledTimes(1);

        gate.resolve(teamDetail('t1'));
        await Promise.all([a, b]);
        expect(store.previews.t1).toBeDefined();
    });

    it('404 → 摘除摘要并丢弃预览', async () => {
        const store = useTeamsStore();
        ctrl.list = vi.fn().mockResolvedValue([teamSummary('gone'), teamSummary('ok')]);
        ctrl.get = vi.fn(async (id: string) => {
            if (id === 'gone') throw new RestRequestError('x', 404, { code: 'NOT_FOUND' });
            return teamDetail(id);
        });

        await store.load();
        await store.prefetchPreviews();

        expect(store.summaries.map((s) => s.id)).toEqual(['ok']);
        expect(store.previews.gone).toBeUndefined();
        expect(store.previews.ok).toBeDefined();
    });

    it('401 → 停止剩余请求且不抛错', async () => {
        const store = useTeamsStore();
        ctrl.list = vi.fn().mockResolvedValue(Array.from({ length: 20 }, (_, i) => teamSummary(`t${i}`)));
        ctrl.get = vi.fn().mockRejectedValue(new RestRequestError('过期', 401, { code: 'UNAUTHENTICATED' }));

        await store.load();
        await expect(store.prefetchPreviews()).resolves.toBeUndefined();
        expect(ctrl.get.mock.calls.length).toBeLessThanOrEqual(4);
        expect(store.previews).toEqual({});
    });

    it('open() 写预览，且草稿改动不影响缓存（克隆隔离）', async () => {
        const store = useTeamsStore();
        ctrl.get = vi.fn().mockResolvedValue(teamDetail('srv-id', [{ species_id: 25 }]));

        await store.open('srv-id');
        expect(store.previews['srv-id'].members).toHaveLength(1);

        store.draftPayload.members.push(emptyMember(6));
        expect(store.previews['srv-id'].members).toHaveLength(1);
    });

    it('save() 成功后写预览', async () => {
        const store = useTeamsStore();
        store.beginCreate('新队');
        store.replacePayload(normalizePayload({ format: 'doubles', members: [{ species_id: 25 }] }));
        ctrl.create = vi.fn().mockResolvedValue({ ...teamDetail('srv-new', [{ species_id: 25 }], 'doubles') });

        const out = await store.save();
        expect(out).toEqual({ status: 'saved', id: 'srv-new' });
        expect(store.previews['srv-new'].format).toBe('doubles');
        expect(store.previews['srv-new'].members).toHaveLength(1);
    });

    it('load(force) 按 updated_at 失效：变更才重拉，删除的 id 清缓存', async () => {
        const store = useTeamsStore();
        ctrl.list = vi.fn().mockResolvedValue([{ ...teamSummary('t1'), updated_at: 'u1' }]);
        ctrl.get = vi.fn().mockResolvedValue({ ...teamDetail('t1'), updated_at: 'u1' });
        await store.load();
        await store.prefetchPreviews();

        // updated_at 未变 → 不重拉
        ctrl.get = vi.fn().mockResolvedValue({ ...teamDetail('t1'), updated_at: 'u1' });
        await store.load(true);
        await store.prefetchPreviews();
        expect(ctrl.get).not.toHaveBeenCalled();

        // updated_at 变化 → 重拉并覆盖
        ctrl.list = vi.fn().mockResolvedValue([{ ...teamSummary('t1'), updated_at: 'u2' }]);
        ctrl.get = vi.fn().mockResolvedValue({
            ...teamDetail('t1', [{ species_id: 6 }]),
            updated_at: 'u2',
        });
        await store.load(true);
        await store.prefetchPreviews();
        expect(ctrl.get).toHaveBeenCalledTimes(1);
        expect(store.previews.t1.members[0].species_id).toBe(6);

        // 摘要被删除 → 预览一并清掉
        ctrl.list = vi.fn().mockResolvedValue([]);
        await store.load(true);
        await store.prefetchPreviews();
        expect(store.previews).toEqual({});
    });

    it('未登录 load 清空预览', async () => {
        const store = useTeamsStore();
        store.previews = { stale: normalizePayload({ format: 'singles', members: [] }) };
        ctrl.isAuth = false;

        await store.load();
        expect(store.previews).toEqual({});
    });

    it('登出后到达的过期详情不会写回缓存', async () => {
        const store = useTeamsStore();
        const gate = deferred<ReturnType<typeof teamDetail>>();
        ctrl.list = vi.fn().mockResolvedValue([teamSummary('t1')]);
        ctrl.get = vi.fn(() => gate.promise);

        await store.load(); // 预取在途
        ctrl.isAuth = false;
        await store.load(); // 清空缓存并让在途任务作废

        gate.resolve(teamDetail('t1'));
        await store.prefetchPreviews();
        expect(store.previews).toEqual({});
    });
});
