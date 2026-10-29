/**
 * teams API 客户端用例（`src/services/api/teams.ts`）
 *
 * stub uni.request 捕获 options（url / method / body / header / dataType），
 * 验证五端点的接线、Bearer 头、201/204 处理，以及无 token / 非 2xx 的报错形状。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ token: 'tok' }));
vi.mock('@/services/session/token', () => ({ getToken: () => state.token }));

interface Captured {
    url: string;
    method: string;
    data?: string;
    header: Record<string, string>;
    dataType?: string;
}
let captured: Captured | null = null;
let response: { statusCode: number; data: unknown } = { statusCode: 200, data: {} };

/** 401 恢复用例用：记录同一请求的所有重试（验证带新 token 重试 / 只重试一次）。 */
let requestCalls: Captured[] = [];
/** 恢复用例用：按顺序消费的响应队列（401 → 200 精确模拟恢复过程）。 */
let responseQueue: { statusCode: number; data: unknown }[] = [];

vi.stubGlobal('uni', {
    request(opts: Captured & { success: (r: { statusCode: number; data: unknown }) => void }) {
        captured = { url: opts.url, method: opts.method, data: opts.data, header: opts.header, dataType: opts.dataType };
        requestCalls.push(captured);
        const next = responseQueue.length > 0 ? responseQueue.shift()! : response;
        opts.success({ statusCode: next.statusCode, data: next.data });
    },
});

import { createTeam, deleteTeam, getTeam, listTeams, updateTeam } from '@/services/api/teams';
import { setUnauthorizedHandler } from '@/services/http';

const summary = { id: 't1', name: 'n', created_at: 'c', updated_at: 'u' };

beforeEach(() => {
    state.token = 'tok';
    captured = null;
    requestCalls = [];
    responseQueue = [];
    response = { statusCode: 200, data: {} };
    // 恢复钩子默认关：避免 401 恢复络跨用例泄漏
    setUnauthorizedHandler(null);
});

it('listTeams：GET /teams，带 Bearer，返回摘要列表', async () => {
    response.data = { teams: [summary] };
    const list = await listTeams();
    expect(captured!.method).toBe('GET');
    expect(captured!.url).toContain('/api/v1/teams');
    expect(captured!.header.Authorization).toBe('Bearer tok');
    expect(list).toEqual([summary]);
});

it('createTeam：POST，body 含 name + payload，期望 201，采用响应 id', async () => {
    response.statusCode = 201;
    response.data = { ...summary, id: 'newid', payload: { a: 1 } };
    const team = await createTeam('冠军队', { a: 1 });
    expect(captured!.method).toBe('POST');
    expect(JSON.parse(captured!.data!)).toEqual({ name: '冠军队', payload: { a: 1 } });
    expect(team.id).toBe('newid');
});

it('getTeam：GET /teams/:id', async () => {
    response.data = { ...summary, payload: {} };
    await getTeam('t1');
    expect(captured!.method).toBe('GET');
    expect(captured!.url).toContain('/api/v1/teams/t1');
});

it('updateTeam：PUT，只提交提供的字段', async () => {
    response.data = { ...summary, name: '新名', payload: {} };
    await updateTeam('t1', { name: '新名' });
    expect(captured!.method).toBe('PUT');
    expect(captured!.url).toContain('/api/v1/teams/t1');
    expect(JSON.parse(captured!.data!)).toEqual({ name: '新名' });
});

it('deleteTeam：DELETE，dataType text，204 正常 resolve', async () => {
    response.statusCode = 204;
    response.data = '';
    await expect(deleteTeam('t1')).resolves.toBeUndefined();
    expect(captured!.method).toBe('DELETE');
    expect(captured!.dataType).toBe('text');
    expect(captured!.url).toContain('/api/v1/teams/t1');
});

it('无 token → reject 401（在发请求之前）', async () => {
    state.token = '';
    await expect(createTeam('n', {})).rejects.toMatchObject({ statusCode: 401 });
    expect(captured).toBeNull();
});

it('非 2xx（409）→ RestRequestError 带 status 与后端 data', async () => {
    response.statusCode = 409;
    response.data = { error: '队伍名已存在', code: 'CONFLICT' };
    await expect(createTeam('n', {})).rejects.toMatchObject({
        statusCode: 409,
        data: { code: 'CONFLICT' },
    });
});

describe('REST 401 会话恢复（http 层，recoverUnauthorized）', () => {
    it('401 → 恢复钩子换新 token → 用新 Bearer 重试成功', async () => {
        setUnauthorizedHandler(async () => {
            state.token = 'tok2'; // refresh 成功：新 access 落 storage
            return true;
        });
        responseQueue = [
            { statusCode: 401, data: { code: 'UNAUTHENTICATED' } },
            { statusCode: 200, data: { teams: [summary] } },
        ];
        const list = await listTeams();

        expect(requestCalls).toHaveLength(2);
        expect(requestCalls[0].header.Authorization).toBe('Bearer tok');
        expect(requestCalls[1].header.Authorization).toBe('Bearer tok2');
        expect(list).toEqual([summary]);
    });

    it('恢复失败（返回 false）→ 原 401 抛出不重试', async () => {
        setUnauthorizedHandler(async () => false);
        responseQueue = [{ statusCode: 401, data: { code: 'UNAUTHENTICATED' } }];
        await expect(listTeams()).rejects.toMatchObject({ statusCode: 401 });
        expect(requestCalls).toHaveLength(1);
    });

    it('未开启 recoverUnauthorized → 401 不调用恢复钩子', async () => {
        const handler = vi.fn(async () => true);
        setUnauthorizedHandler(handler);
        responseQueue = [{ statusCode: 401, data: {} }];

        await expect(rest401NoOptin()).rejects.toMatchObject({ statusCode: 401 });
        expect(handler).not.toHaveBeenCalled();
        expect(requestCalls).toHaveLength(1);
    });

    it('重试仍 401 → 只重试一次后抛出（不死循环）', async () => {
        let attempts = 0;
        setUnauthorizedHandler(async () => {
            attempts++;
            state.token = `tok${attempts}`;
            return true;
        });
        responseQueue = [
            { statusCode: 401, data: { code: 'UNAUTHENTICATED' } },
            { statusCode: 401, data: { code: 'UNAUTHENTICATED' } },
        ];
        await expect(listTeams()).rejects.toMatchObject({ statusCode: 401 });
        expect(requestCalls).toHaveLength(2); // 原请求 + 一次重试
        expect(attempts).toBe(1);
    });
});

/** 未开恢复标记的带 Bearer 请求（对照：登录 / 改密等 401 语义不同的调用不恢复）。 */
async function rest401NoOptin(): Promise<unknown> {
    const { rest } = await import('@/services/http');
    return rest.get<{ teams: unknown[] }>('/teams', {
        header: { Authorization: 'Bearer tok' }, // 不带 recoverUnauthorized
    });
}
