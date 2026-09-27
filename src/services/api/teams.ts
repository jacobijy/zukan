/**
 * 队伍 API 客户端（对接 `docs/data/teams.md`）
 *
 * 后端 5 个端点（前缀 `/api/v1/teams`，全部要求 `Authorization: Bearer <access>`）：
 * - `GET /teams`        列出队伍摘要（不含 payload，按 updated_at 降序）
 * - `POST /teams`       新建队伍（name + payload 都必填），201
 * - `GET /teams/:id`    读取详情（含 payload）
 * - `PUT /teams/:id`    部分更新（只改提供的 name / payload）
 * - `DELETE /teams/:id` 删除，204
 *
 * 与 `favorites.ts` 风格一致：手动读 `getToken()` 拼 Bearer，无 token 时抛 401；
 * 本模块只是薄 HTTP 客户端，**不做领域 clamp**（归一在 services/teams/team-model.ts）。
 */
import { rest, RestRequestError } from '@/services/http';
import { getToken } from '@/services/session/token';

function authHeader(): Record<string, string> {
    const access = getToken();
    if (!access) {
        throw new RestRequestError('未登录', 401);
    }
    return { Authorization: `Bearer ${access}` };
}

/** 队伍摘要（列表项，不含内容） */
export interface TeamSummary {
    id: string;
    name: string;
    created_at: string;
    updated_at: string;
}

/** 完整队伍（比摘要多 payload；边界处 payload 为 unknown，由 store 归一） */
export interface Team extends TeamSummary {
    payload: unknown;
}

interface TeamsListResponse {
    teams: TeamSummary[];
}

/** 列出队伍摘要。 */
export async function listTeams(): Promise<TeamSummary[]> {
    const res = await rest.get<TeamsListResponse>('/teams', { header: authHeader() });
    return res?.teams ?? [];
}

/** 新建队伍（201）；返回完整队伍，调用方以响应 id 作为之后更新键。 */
export async function createTeam(name: string, payload: unknown): Promise<Team> {
    return rest.post<Team, { name: string; payload: unknown }>('/teams', { name, payload }, { header: authHeader() });
}

/** 读取队伍详情（含 payload）。 */
export async function getTeam(id: string): Promise<Team> {
    return rest.get<Team>(`/teams/${id}`, { header: authHeader() });
}

/** 部分更新：只提交要改的 name / payload（至少一个）。 */
export async function updateTeam(id: string, fields: { name?: string; payload?: unknown }): Promise<Team> {
    return rest.put<Team, { name?: string; payload?: unknown }>(`/teams/${id}`, fields, { header: authHeader() });
}

/** 删除队伍（204）；dataType:'text' 跳过空 body 的 JSON 解析。 */
export async function deleteTeam(id: string): Promise<void> {
    await rest.delete<void>(`/teams/${id}`, { header: authHeader(), dataType: 'text' });
}
