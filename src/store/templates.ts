/**
 * 个人宝可梦模板 store：本机记录（大本营）+ 当前草稿 + 登录闸门 + 错误码分支。
 *
 * 本地优先（见 docs/data/templates.md + 变更 add-pokemon-templates design）：
 * - 未登录即可建立 / 查看 / 编辑 / 存草稿 —— 数据落在 `pokemonTemplates` 本地存储，
 *   应用重启后仍可打开续编。
 * - 只有用户点「保存」才上云：已登录 POST/PUT，未登录先 `authGate.requireLogin()`。
 * - 登录时 `mergeFromServer` 按 id 与云端合并；本地墓碑（deleted）仅在云端确含该 id 时补 DELETE。
 *
 * 分层：取数走 `templatesApi`；payload 归一 / 校验走 services/templates/template-model。
 * 返回可判别结果（TemplateSaveOutcome 等），i18n 文案在页面映射，store 不依赖 vue-i18n。
 * 不静态 import pokemon store（物种数据由组件层取），避免环。
 *
 * 注意：所有 state 与操作它们的逻辑都在 `defineStore` setup 内部（Pinia 管理、可重置），
 * 不能放模块顶层 —— 否则会变成跨实例共享的游离单例。
 */
import { ref } from 'vue';
import { defineStore } from 'pinia';
import { authApi, templatesApi } from '@/services/api';
import type { TemplateSummary } from '@/services/api/templates';
import { RestRequestError } from '@/services/http';
import { clearSession, isAuthenticated } from '@/services/session';
import { authGate, LoginDismissedError } from '@/services/session/authGate';
import {
    emptyTemplate,
    normalizePayload,
    validateTemplate,
    type TemplatePayload,
} from '@/services/templates/template-model';

// ── 结果类型 ───────────────────────────────────────────
export type TemplateInvalidReason =
    | 'name-required'
    | 'name-too-long'
    | 'payload-too-large'
    | 'pokemon-required';
export type TemplateErrorReason = 'not-found' | 'conflict' | 'invalid-input' | 'session-expired';

export type TemplateSaveOutcome =
    | { status: 'saved'; id: string }
    | { status: 'aborted' }
    | { status: 'invalid'; reason: TemplateInvalidReason }
    | { status: 'error'; reason: TemplateErrorReason; message?: string };

export type TemplateRemoveOutcome =
    | { removed: true } // 已删
    | { tombstoned: true } // 未登录删云端条目 → 墓碑，待登录补删
    | { aborted: true };

// ── 记录模型 ───────────────────────────────────────────
export type SyncState = 'local' | 'synced' | 'dirty' | 'deleted';

/** 一条模板记录：本地与云端同构，payload 为空表示「云端条目详情未载入」（打开时 GET）。 */
export interface TemplateRecord {
    id: string;
    name: string;
    payload: TemplatePayload | null;
    createdAt: string;
    updatedAt: string;
    sync: SyncState;
}

// ── 本地存储（无 state 依赖，可留模块级） ──────────────
const STORAGE_KEY = 'pokemonTemplates';
const SYNC_STATES = new Set<SyncState>(['local', 'synced', 'dirty', 'deleted']);

function isRecord(x: unknown): x is TemplateRecord {
    if (typeof x !== 'object' || x === null) return false;
    const o = x as Record<string, unknown>;
    if (typeof o.id !== 'string' || typeof o.name !== 'string') return false;
    if (typeof o.createdAt !== 'string' || typeof o.updatedAt !== 'string') return false;
    if (typeof o.sync !== 'string' || !SYNC_STATES.has(o.sync as SyncState)) return false;
    // payload 允许 null（云端摘要未载入）或对象
    if (o.payload !== null && (typeof o.payload !== 'object' || o.payload === undefined)) return false;
    return true;
}

function loadLocalTemplates(): TemplateRecord[] {
    try {
        const raw = uni.getStorageSync(STORAGE_KEY) as unknown;
        const parsed = typeof raw === 'string' ? (raw ? JSON.parse(raw) : []) : raw;
        if (!Array.isArray(parsed)) return [];
        return parsed.filter(isRecord).map((r) => ({ ...r, payload: normalizePayload(r.payload) }));
    } catch {
        return [];
    }
}

function saveLocalTemplates(records: TemplateRecord[]): void {
    try {
        uni.setStorageSync(STORAGE_KEY, records);
    } catch (err) {
        // quota / 沙箱错误：内存 state 保持，仅丢失持久化
        console.warn('[templates] 写入本地存储失败', err);
    }
}

// ── 无状态的纯工具（不触碰 state，留在模块作用域） ──────
function isRestError(e: unknown): e is RestRequestError {
    return e instanceof RestRequestError;
}

function errBody(e: RestRequestError): { code?: string; error?: string } {
    return typeof e.data === 'object' && e.data !== null ? (e.data as { code?: string; error?: string }) : {};
}

function nowIso(): string {
    return new Date().toISOString();
}

function clonePayload(p: TemplatePayload | null): TemplatePayload | null {
    return p === null ? null : (JSON.parse(JSON.stringify(p)) as TemplatePayload);
}

export const useTemplatesStore = defineStore('templates', () => {
    // ── state ──
    const records = ref<TemplateRecord[]>(loadLocalTemplates());
    const listLoading = ref(false);

    const currentId = ref<string | null>(null);
    const draftName = ref('');
    const draftPayload = ref<TemplatePayload | null>(null);
    const saving = ref(false);

    // ── helpers（操作本 store 的 state） ──
    function find(id: string): TemplateRecord | undefined {
        return records.value.find((r) => r.id === id);
    }

    function sortAndPersist(): void {
        records.value = [...records.value].toSorted((a, b) => b.updatedAt.localeCompare(a.updatedAt));
        saveLocalTemplates(records.value);
    }

    /** requireLogin：已登录直接通过（access 过期由 save 的 401 会话恢复处理）；未登录弹层，用户关闭 → aborted。 */
    async function gateOrAbort(): Promise<{ aborted: boolean }> {
        if (isAuthenticated()) return { aborted: false };
        try {
            await authGate.requireLogin();
            return { aborted: false };
        } catch (e) {
            if (e instanceof LoginDismissedError) return { aborted: true };
            throw e;
        }
    }

    // ── 列表 / 合并 ──
    /** 未登录直接展示本机记录；已登录先把云端摘要并入本地（401 先 refresh 重试一次）。 */
    async function load(force = false): Promise<void> {
        if (!isAuthenticated()) return;
        try {
            const summaries = await templatesApi.listTemplates();
            mergeFromServer(summaries);
        } catch (e) {
            if (isRestError(e) && e.statusCode === 401) {
                try {
                    await authApi.refresh();
                    const summaries = await templatesApi.listTemplates();
                    mergeFromServer(summaries);
                } catch {
                    clearSession();
                }
            } else {
                throw e;
            }
        }
        void force;
    }

    /**
     * 登录合并：云端摘要按 id 与本地并集。
     * - 本地墓碑：云端有该 id → 补 DELETE；云端无 → 移除墓碑。
     * - 本地 synced / dirty 而云端已无该 id → 本地移除。
     * - 云端独有 → 落库（synced，payload 待打开时 GET）。
     * - 本地 dirty / local 保留本地名（保存时全量提交，重名由 409 提示）。
     */
    function mergeFromServer(summaries: TemplateSummary[]): void {
        const cloud = new Map(summaries.map((s) => [s.id, s]));
        const next: TemplateRecord[] = [];

        for (const rec of records.value) {
            if (rec.sync === 'deleted') {
                const c = cloud.get(rec.id);
                if (c) {
                    templatesApi
                        .deleteTemplate(rec.id)
                        .catch((err) => console.warn('[templates] 墓碑补删失败', err));
                }
                continue; // 墓碑清场
            }
            if ((rec.sync === 'synced' || rec.sync === 'dirty') && !cloud.has(rec.id)) {
                continue; // 云端已删
            }
            next.push(rec);
        }

        for (const s of summaries) {
            const local = next.find((r) => r.id === s.id);
            if (!local) {
                next.push({
                    id: s.id,
                    name: s.name,
                    payload: null,
                    createdAt: s.created_at,
                    updatedAt: s.updated_at,
                    sync: 'synced',
                });
            } else {
                // synced 采用服务端名（可能被其它设备改名）；dirty/local 保留本地名
                if (local.sync === 'synced') local.name = s.name;
                local.updatedAt = s.updated_at;
            }
        }

        records.value = next;
        sortAndPersist();
    }

    // ── 草稿 ──
    /** 开始新建：默认名由页面传入；可选起始 payload（计算器「存为模板」预填）。 */
    function beginCreate(name: string, payload: TemplatePayload | null = null): void {
        currentId.value = null;
        draftName.value = name;
        draftPayload.value = payload ?? emptyTemplate('standard');
    }

    /** 打开已有记录：本地草稿直接用；云端条目详情未载入时 GET 并归一。404 → 摘除并向上抛。 */
    async function open(id: string): Promise<void> {
        const rec = find(id);
        if (!rec) throw new RestRequestError('模板不存在', 404);

        if (rec.payload === null) {
            try {
                const t = await templatesApi.getTemplate(id);
                rec.payload = normalizePayload(t.payload);
                rec.name = t.name;
                rec.updatedAt = t.updated_at;
                sortAndPersist();
            } catch (e) {
                if (isRestError(e) && e.statusCode === 404) {
                    records.value = records.value.filter((r) => r.id !== id);
                    sortAndPersist();
                }
                throw e;
            }
        }

        currentId.value = id;
        draftName.value = rec.name;
        draftPayload.value = clonePayload(rec.payload);
    }

    function setName(name: string): void {
        draftName.value = name;
    }

    function replacePayload(payload: TemplatePayload | null): void {
        draftPayload.value = payload;
    }

    /** 保存草稿：仅落本地，不上云。新建记 local；已上云改动置 dirty。 */
    function saveDraft(): void {
        if (currentId.value === null) {
            const rec: TemplateRecord = {
                id: `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
                name: draftName.value,
                payload: draftPayload.value,
                createdAt: nowIso(),
                updatedAt: nowIso(),
                sync: 'local',
            };
            records.value.unshift(rec);
            currentId.value = rec.id;
            sortAndPersist();
            return;
        }
        const rec = find(currentId.value);
        if (rec) {
            if (rec.sync === 'synced') rec.sync = 'dirty';
            rec.name = draftName.value;
            rec.payload = draftPayload.value;
            rec.updatedAt = nowIso();
            sortAndPersist();
        }
    }

    // ── 保存（上云） ──
    /**
     * 保存当前草稿到账号：
     * 1. requireLogin（关闭 → aborted，静默中止）
     * 2. 校验（宝可梦未选 / 名字 / 大小不合法 → invalid，不发请求）
     * 3. 新建（无记录或 sync=local）→ POST，**用响应 id 替换本地 id**；已有 → PUT 全量
     * 4. 成功后置 synced；409/400 → error（保留草稿与 id）；404 → 摘除 + not-found
     */
    async function save(): Promise<TemplateSaveOutcome> {
        const gated = await gateOrAbort();
        if (gated.aborted) return { status: 'aborted' };

        // 先归一：宝可梦未选（pokemon_id 非法）→ 归一为 null → pokemon-required
        const payload = normalizePayload(draftPayload.value);
        if (payload === null) return { status: 'invalid', reason: 'pokemon-required' };

        const v = validateTemplate(draftName.value, payload);
        if (!v.ok) {
            if (v.nameError === 'required') return { status: 'invalid', reason: 'name-required' };
            if (v.nameError === 'tooLong') return { status: 'invalid', reason: 'name-too-long' };
            return { status: 'invalid', reason: 'payload-too-large' };
        }

        saving.value = true;
        try {
            return await runWithRetry(() => saveOnce(v.trimmedName, payload));
        } catch (e) {
            if (isRestError(e) && e.statusCode === 401) {
                // refresh 也失败 → 会话已清；提示重新登录
                return { status: 'error', reason: 'session-expired' };
            }
            if (isRestError(e)) {
                const body = errBody(e);
                if (e.statusCode === 404) {
                    if (currentId.value) {
                        records.value = records.value.filter((r) => r.id !== currentId.value);
                        currentId.value = null;
                        sortAndPersist();
                    }
                    return { status: 'error', reason: 'not-found', message: body.error };
                }
                if (e.statusCode === 409) {
                    return { status: 'error', reason: 'conflict', message: body.error };
                }
                if (e.statusCode === 400) {
                    return { status: 'error', reason: 'invalid-input', message: body.error };
                }
            }
            throw e;
        } finally {
            saving.value = false;
        }
    }

    /** 发一次保存请求并落本地；不处理 401（由 save 外层做会话恢复重试）。 */
    async function saveOnce(trimmedName: string, payload: TemplatePayload): Promise<TemplateSaveOutcome> {
        const rec = currentId.value ? find(currentId.value) : null;
        const isNew = rec == null || rec.sync === 'local';

        if (isNew) {
            const created = await templatesApi.createTemplate(trimmedName, payload);
            currentId.value = created.id;
            if (rec) {
                rec.id = created.id;
                rec.name = created.name;
                rec.payload = payload;
                rec.sync = 'synced';
                rec.updatedAt = created.updated_at;
            } else {
                records.value.unshift({
                    id: created.id,
                    name: created.name,
                    payload,
                    createdAt: created.created_at,
                    updatedAt: created.updated_at,
                    sync: 'synced',
                });
            }
            sortAndPersist();
            return { status: 'saved', id: created.id };
        }

        // 新建分支已返回；此处 currentId 必为云端 id
        const id = currentId.value;
        if (id === null) return { status: 'error', reason: 'invalid-input' };
        const updated = await templatesApi.updateTemplate(id, {
            name: trimmedName,
            payload,
        });
        const existing = find(id);
        if (existing) {
            existing.name = updated.name;
            existing.payload = payload;
            existing.sync = 'synced';
            existing.updatedAt = updated.updated_at;
            sortAndPersist();
        }
        return { status: 'saved', id: updated.id };
    }

    /** 401 → refresh 后重试一次；refresh 失败清会话并抛 401 由调用方映射。 */
    async function runWithRetry<T>(fn: () => Promise<T>): Promise<T> {
        try {
            return await fn();
        } catch (e) {
            if (!(isRestError(e) && e.statusCode === 401)) throw e;
            try {
                await authApi.refresh();
            } catch {
                clearSession();
                throw new RestRequestError('会话过期', 401);
            }
            return await fn();
        }
    }

    // ── 删除 / 改名 ──
    /**
     * 删除：本地草稿直接删；已上云条目已登录 DELETE、未登录标墓碑（deleted）待登录补删。
     */
    async function remove(id: string): Promise<TemplateRemoveOutcome> {
        const rec = find(id);
        if (!rec) return { removed: true };

        if (rec.sync === 'local') {
            records.value = records.value.filter((r) => r.id !== id);
            if (currentId.value === id) clearCurrent();
            sortAndPersist();
            return { removed: true };
        }

        if (!isAuthenticated()) {
            rec.sync = 'deleted';
            rec.updatedAt = nowIso();
            sortAndPersist();
            return { tombstoned: true };
        }

        try {
            await templatesApi.deleteTemplate(id);
        } catch (e) {
            if (!(isRestError(e) && e.statusCode === 404)) throw e;
        }
        records.value = records.value.filter((r) => r.id !== id);
        if (currentId.value === id) clearCurrent();
        sortAndPersist();
        return { removed: true };
    }

    /** 改名：一律落本地；已上云条目置 dirty，由用户保存上云。 */
    function rename(id: string, name: string): void {
        const rec = find(id);
        if (!rec) return;
        rec.name = name;
        if (rec.sync === 'synced') rec.sync = 'dirty';
        rec.updatedAt = nowIso();
        sortAndPersist();
    }

    /** 退出编辑页时清空草稿。 */
    function clearCurrent(): void {
        currentId.value = null;
        draftName.value = '';
        draftPayload.value = null;
    }

    return {
        // state
        records,
        listLoading,
        currentId,
        draftName,
        draftPayload,
        saving,
        // actions
        load,
        beginCreate,
        open,
        setName,
        replacePayload,
        saveDraft,
        save,
        remove,
        rename,
        clearCurrent,
    };
});
