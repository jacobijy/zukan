/**
 * 个人宝可梦模板 store：**云端模板（纯后端）+ 仅「新建草稿」保留本地**。
 *
 * 两个数据源：
 * - **云端模板**：`GET /templates` 摘要（仅内存、不持久），打开时 GET 详情，保存 POST/PUT；
 *   以服务端为唯一来源。
 * - **本地草稿（drafts）**：未上云的**新建**内容，持久在 `pokemonTemplates` 本地存储，
 *   列表可见、重启可续编；保存上云成功后删除草稿、转为云端记录。
 *
 * 已不再有 synced/dirty 的本地缓存、墓碑（deleted）与登录并集合并。读取旧本地数据时
 * 只迁移 `sync==='local'` 的草稿，synced/dirty/deleted 一律丢弃（云端为唯一来源）。
 *
 * 写操作（保存 / 删除云端条目）经 `confirmLogin`：未登录先弹「是否去登录」确认框、
 * 确认后再打开登录层，登录成功在同一动作内续跑；草稿的保存 / 删除不需要登录。
 *
 * 分层：取数走 `templatesApi`；payload 归一 / 校验走 services/templates/template-model。
 * 返回可判别结果（TemplateSaveOutcome 等），i18n 文案在页面映射，store 不依赖 vue-i18n。
 *
 * 注意：所有 state 与操作它们的逻辑都在 `defineStore` setup 内部（Pinia 管理、可重置），
 * 不能放模块顶层 —— 否则会变成跨实例共享的游离单例。
 */
import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { authApi, templatesApi } from '@/services/api';
import type { Template, TemplateSummary } from '@/services/api/templates';
import { RestRequestError } from '@/services/http';
import { clearSession, confirmLogin, isAuthenticated } from '@/services/session';
import {
    emptyTemplate,
    normalizePayload,
    validateTemplate,
    type TemplatePayload,
} from '@/services/templates/template-model';

// ── 结果类型 ───────────────────────────────────────────
export type TemplateInvalidReason = 'name-required' | 'name-too-long' | 'payload-too-large' | 'pokemon-required';
export type TemplateErrorReason = 'not-found' | 'conflict' | 'invalid-input' | 'session-expired';

export type TemplateSaveOutcome =
    | { status: 'saved'; id: string }
    | { status: 'aborted' }
    | { status: 'invalid'; reason: TemplateInvalidReason }
    | { status: 'error'; reason: TemplateErrorReason; message?: string };

export type TemplateRemoveOutcome = { removed: true } | { aborted: true };

// ── 记录模型 ───────────────────────────────────────────
/** 列表 / 编辑共用的视图记录。云端摘要 payload 为 null（打开时再 GET）。 */
export type TemplateSyncState = 'local' | 'synced';

export interface TemplateRecord {
    id: string;
    name: string;
    payload: TemplatePayload | null;
    createdAt: string;
    updatedAt: string;
    sync: TemplateSyncState;
}

/** 本地草稿：未上云的新建内容（落盘的就是这个形状，无 sync 字段）。 */
interface LocalDraft {
    id: string;
    name: string;
    payload: TemplatePayload;
    createdAt: string;
    updatedAt: string;
}

// ── 本地草稿存储（无 state 依赖，留模块级） ──────────────
const STORAGE_KEY = 'pokemonTemplates';
const LOCAL_PREFIX = 'local-';

function isLocalId(id: string | null): id is string {
    return !!id && id.startsWith(LOCAL_PREFIX);
}

function nowIso(): string {
    return new Date().toISOString();
}

/** 新格式（无 sync 的 LocalDraft）判别。 */
function isDraftShape(x: unknown): x is LocalDraft {
    if (typeof x !== 'object' || x === null) return false;
    const o = x as Record<string, unknown>;
    return (
        typeof o.id === 'string' &&
        o.id.startsWith(LOCAL_PREFIX) &&
        typeof o.name === 'string' &&
        typeof o.createdAt === 'string' &&
        typeof o.updatedAt === 'string' &&
        typeof o.payload === 'object' &&
        o.payload !== null
    );
}

/**
 * 读本地草稿。兼容两种历史形态：
 * - 新格式：元素本身是 LocalDraft（无 sync）；
 * - 旧格式：元素是带 sync 的 TemplateRecord —— 仅迁移 `sync==='local'` 的草稿，
 *   synced/dirty/deleted 一律丢弃（这些数据以云端为准，不再本地缓存 / 留墓碑）。
 */
function loadLocalDrafts(): LocalDraft[] {
    let raw: unknown;
    try {
        raw = uni.getStorageSync(STORAGE_KEY) as unknown;
    } catch {
        return [];
    }
    let parsed: unknown;
    try {
        parsed = typeof raw === 'string' ? (raw ? JSON.parse(raw) : []) : raw;
    } catch {
        return [];
    }
    if (!Array.isArray(parsed)) return [];

    const drafts: LocalDraft[] = [];
    for (const item of parsed) {
        if (isDraftShape(item)) {
            const p = normalizePayload(item.payload) ?? emptyTemplate('standard');
            drafts.push({ ...item, payload: p });
            continue;
        }
        const o = (item ?? {}) as Record<string, unknown>;
        if (o.sync !== 'local' || typeof o.id !== 'string' || !o.id.startsWith(LOCAL_PREFIX)) continue;
        const p = normalizePayload(o.payload);
        if (p && typeof o.name === 'string' && typeof o.createdAt === 'string' && typeof o.updatedAt === 'string') {
            drafts.push({ id: o.id, name: o.name, payload: p, createdAt: o.createdAt, updatedAt: o.updatedAt });
        }
    }
    return drafts;
}

function saveLocalDrafts(drafts: LocalDraft[]): void {
    try {
        uni.setStorageSync(STORAGE_KEY, drafts);
    } catch (err) {
        // quota / 沙箱错误：内存 state 保持，仅丢失持久化
        console.warn('[templates] 写入本地草稿失败', err);
    }
}

// ── 无状态的纯工具（不触碰 state，留在模块作用域） ──────
function isRestError(e: unknown): e is RestRequestError {
    return e instanceof RestRequestError;
}

function errBody(e: RestRequestError): { code?: string; error?: string } {
    return typeof e.data === 'object' && e.data !== null ? (e.data as { code?: string; error?: string }) : {};
}

function clonePayload(p: TemplatePayload | null): TemplatePayload | null {
    return p === null ? null : (JSON.parse(JSON.stringify(p)) as TemplatePayload);
}

type CloudMeta = Pick<TemplateSummary, 'id' | 'name' | 'created_at' | 'updated_at'>;

export const useTemplatesStore = defineStore('templates', () => {
    // ── state ──
    /** 未上云的新建草稿（本地持久）。 */
    const drafts = ref<LocalDraft[]>(loadLocalDrafts());
    /** 云端模板摘要（仅内存，load 时 GET）。 */
    const cloudSummaries = ref<TemplateSummary[]>([]);
    /** 云端列表是否已在本次会话加载过。 */
    let listLoaded = false;
    /** 未登录（无法看云端）时，列表页显示登录引导。 */
    const needsLogin = ref(false);

    const currentId = ref<string | null>(null);
    const draftName = ref('');
    const draftPayload = ref<TemplatePayload | null>(null);
    const saving = ref(false);

    // ── 对外视图：草稿(local) + 云端(synced, payload 待打开时载入)，updatedAt 降序 ──
    const records = computed<TemplateRecord[]>(() => {
        const local: TemplateRecord[] = drafts.value.map((d) => ({ ...d, sync: 'local' }));
        const cloud: TemplateRecord[] = cloudSummaries.value.map((s) => ({
            id: s.id,
            name: s.name,
            payload: null,
            createdAt: s.created_at,
            updatedAt: s.updated_at,
            sync: 'synced',
        }));
        return [...local, ...cloud].toSorted((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    });

    // ── helpers ──
    function persistDrafts(): void {
        saveLocalDrafts(drafts.value);
    }

    function findDraft(id: string | null): LocalDraft | undefined {
        return id ? drafts.value.find((d) => d.id === id) : undefined;
    }

    /** 插入 / 更新一条云端摘要并按 updated_at 降序。 */
    function upsertCloud(t: CloudMeta): void {
        const next = cloudSummaries.value.filter((s) => s.id !== t.id);
        next.unshift({ id: t.id, name: t.name, created_at: t.created_at, updated_at: t.updated_at });
        cloudSummaries.value = next.toSorted((a, b) => b.updated_at.localeCompare(a.updated_at));
    }

    function removeCloud(id: string): void {
        cloudSummaries.value = cloudSummaries.value.filter((s) => s.id !== id);
    }

    // ── 列表 ──
    /**
     * 加载云端摘要。未登录 → needsLogin=true、清空云端（草稿仍在），不发请求、不弹层。
     * 已登录且未加载 → GET；401 先 refresh 重试一次，再失败清会话。
     */
    async function load(force = false): Promise<void> {
        if (!isAuthenticated()) {
            needsLogin.value = true;
            cloudSummaries.value = [];
            listLoaded = false;
            return;
        }
        needsLogin.value = false;
        if (listLoaded && !force) return;

        try {
            cloudSummaries.value = await templatesApi.listTemplates();
            listLoaded = true;
        } catch (e) {
            if (isRestError(e) && e.statusCode === 401) {
                try {
                    await authApi.refresh();
                    cloudSummaries.value = await templatesApi.listTemplates();
                    listLoaded = true;
                } catch {
                    clearSession();
                    needsLogin.value = true;
                    cloudSummaries.value = [];
                    listLoaded = false;
                }
            } else {
                throw e;
            }
        }
    }

    // ── 草稿 ──
    /** 开始新建：默认名由页面传入；可选起始 payload（计算器「存为模板」预填）。 */
    function beginCreate(name: string, payload: TemplatePayload | null = null): void {
        currentId.value = null;
        draftName.value = name;
        draftPayload.value = payload ?? emptyTemplate('standard');
    }

    /**
     * 打开一条记录进入编辑：
     * - 本地草稿：直接用草稿内容（克隆，避免编辑直接改到草稿对象）；
     * - 云端条目：GET 详情填当前草稿（不持久）；404 → 移出云端列表并向上抛。
     */
    async function open(id: string): Promise<void> {
        const draft = findDraft(id);
        if (draft) {
            currentId.value = id;
            draftName.value = draft.name;
            draftPayload.value = clonePayload(draft.payload);
            return;
        }

        try {
            const t = await templatesApi.getTemplate(id);
            currentId.value = id;
            draftName.value = t.name;
            draftPayload.value = normalizePayload(t.payload);
        } catch (e) {
            if (isRestError(e) && e.statusCode === 404) {
                removeCloud(id);
                currentId.value = null;
            }
            throw e;
        }
    }

    function setName(name: string): void {
        draftName.value = name;
    }

    function replacePayload(payload: TemplatePayload | null): void {
        draftPayload.value = payload;
    }

    /** 当前编辑对象是否为本地新建草稿（或尚未存草稿的新建）。 */
    function editingLocalDraft(): boolean {
        return currentId.value === null || isLocalId(currentId.value);
    }

    /**
     * 保存草稿（仅本地，不上云，无需登录）：新建（currentId=null）生成 local id；
     * 已是本地草稿则原地更新。云端条目不产生本地草稿（无 dirty）。
     */
    function saveDraft(): void {
        const payload = draftPayload.value ?? emptyTemplate('standard');
        const existing = findDraft(currentId.value);
        if (existing) {
            existing.name = draftName.value;
            existing.payload = payload;
            existing.updatedAt = nowIso();
        } else {
            const draft: LocalDraft = {
                id: `${LOCAL_PREFIX}${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
                name: draftName.value,
                payload,
                createdAt: nowIso(),
                updatedAt: nowIso(),
            };
            drafts.value.unshift(draft);
            currentId.value = draft.id;
        }
        persistDrafts();
    }

    // ── 保存（上云） ──
    /**
     * 保存当前草稿到账号：
     * 1. confirmLogin（确认框取消 / 登录层关闭 → aborted，静默中止）
     * 2. 归一 + 校验（宝可梦未选 / 名字 / 大小不合法 → invalid，不发请求）
     * 3. 新建（无 id 或本地草稿）→ POST，成功后删草稿、摘要入云端；已有云端 id → PUT
     * 4. 404 → 摘除 + not-found；409/400 → error（保留当前编辑态）
     */
    async function save(): Promise<TemplateSaveOutcome> {
        if (!(await confirmLogin())) return { status: 'aborted' };

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
                return { status: 'error', reason: 'session-expired' };
            }
            if (isRestError(e)) {
                const body = errBody(e);
                if (e.statusCode === 404) {
                    if (currentId.value) removeCloud(currentId.value);
                    currentId.value = null;
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

    /** 发一次保存请求并更新数据源；不处理 401（由 save 外层做会话恢复重试）。 */
    async function saveOnce(trimmedName: string, payload: TemplatePayload): Promise<TemplateSaveOutcome> {
        const draft = findDraft(currentId.value);
        if (currentId.value === null || draft) {
            const created = await templatesApi.createTemplate(trimmedName, payload);
            if (draft) drafts.value = drafts.value.filter((d) => d.id !== draft.id);
            persistDrafts();
            upsertCloud(created);
            currentId.value = created.id;
            return { status: 'saved', id: created.id };
        }

        const id = currentId.value;
        if (!id) return { status: 'error', reason: 'invalid-input' };
        const updated: Template = await templatesApi.updateTemplate(id, { name: trimmedName, payload });
        upsertCloud(updated);
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

    // ── 删除 ──
    /**
     * 删除：本地草稿直接删（无需登录、不发请求）；云端条目经 confirmLogin 后 DELETE，
     * 404 也按已删除处理。确认框取消 / 登录层关闭 → aborted。
     */
    async function remove(id: string): Promise<TemplateRemoveOutcome> {
        const draft = findDraft(id);
        if (draft) {
            drafts.value = drafts.value.filter((d) => d.id !== id);
            if (currentId.value === id) clearCurrent();
            persistDrafts();
            return { removed: true };
        }

        if (!(await confirmLogin())) return { aborted: true };
        try {
            await templatesApi.deleteTemplate(id);
        } catch (e) {
            if (!(isRestError(e) && e.statusCode === 404)) throw e;
        }
        removeCloud(id);
        if (currentId.value === id) clearCurrent();
        return { removed: true };
    }

    /** 退出编辑页时清空草稿。 */
    function clearCurrent(): void {
        currentId.value = null;
        draftName.value = '';
        draftPayload.value = null;
    }

    return {
        // state
        drafts,
        cloudSummaries,
        needsLogin,
        records,
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
        editingLocalDraft,
        save,
        remove,
        clearCurrent,
    };
});
