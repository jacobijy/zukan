/**
 * teams API 客户端用例（`src/services/api/teams.ts`）
 *
 * stub uni.request 捕获 options（url / method / body / header / dataType），
 * 验证五端点的接线、Bearer 头、201/204 处理，以及无 token / 非 2xx 的报错形状。
 */
import { beforeEach, expect, it, vi } from 'vitest';

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

vi.stubGlobal('uni', {
    request(opts: Captured & { success: (r: { statusCode: number; data: unknown }) => void }) {
        captured = { url: opts.url, method: opts.method, data: opts.data, header: opts.header, dataType: opts.dataType };
        opts.success({ statusCode: response.statusCode, data: response.data });
    },
});

import { createTeam, deleteTeam, getTeam, listTeams, updateTeam } from '@/services/api/teams';

const summary = { id: 't1', name: 'n', created_at: 'c', updated_at: 'u' };

beforeEach(() => {
    state.token = 'tok';
    captured = null;
    response = { statusCode: 200, data: {} };
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
