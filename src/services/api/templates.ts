/**
 * 个人宝可梦模板 API 客户端（对接 `docs/data/templates.md`）
 *
 * 后端 5 个端点（前缀 `/api/v1/templates`，全部要求 `Authorization: Bearer <access>`）：
 * - `GET /templates`        列出模板摘要（不含 payload，按 updated_at 降序）
 * - `POST /templates`       新建模板（name + payload 都必填），201
 * - `GET /templates/:id`    读取详情（含 payload）
 * - `PUT /templates/:id`    部分更新（只改提供的 name / payload）
 * - `DELETE /templates/:id` 删除，204
 *
 * 与 `teams.ts` 风格一致：手动读 `getToken()` 拼 Bearer，无 token 时抛 401；
 * 本模块只是薄 HTTP 客户端，**不做领域 clamp**（归一在 services/templates/template-model.ts）。
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

/** 模板摘要（列表项，不含内容） */
export interface TemplateSummary {
    id: string;
    name: string;
    created_at: string;
    updated_at: string;
}

/** 完整模板（比摘要多 payload；边界处 payload 为 unknown，由 store 归一） */
export interface Template extends TemplateSummary {
    payload: unknown;
}

interface TemplatesListResponse {
    templates: TemplateSummary[];
}

/** 列出模板摘要。 */
export async function listTemplates(): Promise<TemplateSummary[]> {
    const res = await rest.get<TemplatesListResponse>('/templates', { header: authHeader() });
    return res?.templates ?? [];
}

/** 新建模板（201）；返回完整模板，调用方以响应 id 作为之后更新键。 */
export async function createTemplate(name: string, payload: unknown): Promise<Template> {
    return rest.post<Template, { name: string; payload: unknown }>(
        '/templates',
        { name, payload },
        { header: authHeader() },
    );
}

/** 读取模板详情（含 payload）。 */
export async function getTemplate(id: string): Promise<Template> {
    return rest.get<Template>(`/templates/${id}`, { header: authHeader() });
}

/** 部分更新：只提交要改的 name / payload（至少一个）。 */
export async function updateTemplate(
    id: string,
    fields: { name?: string; payload?: unknown },
): Promise<Template> {
    return rest.put<Template, { name?: string; payload?: unknown }>(`/templates/${id}`, fields, {
        header: authHeader(),
    });
}

/** 删除模板（204）；dataType:'text' 跳过空 body 的 JSON 解析。 */
export async function deleteTemplate(id: string): Promise<void> {
    await rest.delete<void>(`/templates/${id}`, { header: authHeader(), dataType: 'text' });
}
