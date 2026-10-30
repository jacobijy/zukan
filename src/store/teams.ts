/**
 * 队伍 store：列表摘要缓存 + 当前队伍草稿 + 登录闸门 + 错误码分支。
 *
 * 分层（见 docs/data/teams.md）：
 * - 取数走 `teamsApi`（薄 HTTP 客户端）；payload 归一 / 校验走 services/teams/team-model。
 * - 写操作前统一 `confirmLogin()`：未登录先弹「是否去登录」确认框，确认后再打开登录层；
 *   确认框取消或登录层被关闭则静默中止、不发请求。
 * - 错误码按后端稳定 `code` / status 分支：404 摘除本地、409/400 交给页面展示。
 *
 * 返回可判别结果（SaveOutcome 等），**i18n 文案在页面映射**，store 不依赖 vue-i18n。
 * 不静态 import pokemon store（物种数据由组件层取），避免环。
 *
 * 注意：所有 state 与操作它们的逻辑都在 `defineStore` setup 内部（Pinia 管理、可重置），
 * 不能放模块顶层 —— 否则会变成跨实例共享的游离单例（踩过）。
 */
import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { authApi, teamsApi } from '@/services/api';
import type { TeamSummary } from '@/services/api/teams';
import { RestRequestError } from '@/services/http';
import { clearSession, confirmLogin, ensureFreshSession, isAuthenticated } from '@/services/session';
import { emptyPayload, normalizePayload, validateTeam, type TeamPayload } from '@/services/teams/team-model';
import { mapWithConcurrency } from '@/utils/concurrency';

/** 列表缩略图预取的并发上限（后端列表不带 payload，详情逐条拉）。 */
const PREVIEW_CONCURRENCY = 4;

// ── 结果类型 ───────────────────────────────────────────
export type InvalidReason = 'name-required' | 'name-too-long' | 'payload-too-large';
export type ErrorReason = 'not-found' | 'conflict' | 'invalid-input' | 'session-expired';

export type SaveOutcome =
    | { status: 'saved'; id: string }
    | { status: 'aborted' }
    | { status: 'invalid'; reason: InvalidReason }
    | { status: 'error'; reason: ErrorReason; message?: string };

// 无状态的纯工具（不触碰 state，留在模块作用域）
function isRestError(e: unknown): e is RestRequestError {
    return e instanceof RestRequestError;
}

function errBody(e: RestRequestError): { code?: string; error?: string } {
    return typeof e.data === 'object' && e.data !== null ? (e.data as { code?: string; error?: string }) : {};
}

/** payload 是 JSON-only 契约（后端不透明 JSON），用 JSON round-trip 隔离缓存与可编辑草稿。 */
function cloneTeamPayload(payload: TeamPayload): TeamPayload {
    return JSON.parse(JSON.stringify(payload)) as TeamPayload;
}

/** 摘要集合签名：id + updated_at；用于判断刷新后是否需要让在途预取作废。 */
function summarySignature(list: readonly TeamSummary[]): string {
    return list.map((s) => `${s.id}:${s.updated_at}`).join('|');
}

/**
 * 写操作登录闸门：已登录直接通过（access 过期由写请求的 401 会话恢复处理）；
 * 未登录先弹「是否去登录」确认框、确认后再打开登录层；任一步取消 → aborted。
 * 不触碰任何 store state，故置于模块作用域。
 */
async function gateOrAbort(): Promise<{ aborted: boolean }> {
    if (await confirmLogin()) return { aborted: false };
    return { aborted: true };
}

export const useTeamsStore = defineStore('teams', () => {
    // ── state ──
    const summaries = ref<TeamSummary[]>([]);
    const listLoaded = ref(false);
    const listLoading = ref(false);
    /** 未登录（含 token 失效）标志：列表页据此显示登录引导空态，不主动弹层 */
    const needsLogin = ref(false);

    /** 列表缩略图：id → 归一化 payload（仅内存，不持久）。 */
    const previews = ref<Record<string, TeamPayload>>({});
    /** 预览对应的摘要 updated_at（非响应式）：force 刷新时只失效变更项。 */
    const previewVersions = new Map<string, string>();
    /** 同一时刻只跑一批预取；重复调用复用同一个 Promise。 */
    let previewTask: Promise<void> | null = null;
    /** 列表 / 会话变更计数：在途预取据此丢弃过期结果并在结束后补跑。 */
    let previewGeneration = 0;

    const currentId = ref<string | null>(null);
    const draftName = ref('');
    const draftPayload = ref<TeamPayload>(emptyPayload());
    const saving = ref(false);

    // ── getters ──
    const draft = computed(() => ({
        id: currentId.value,
        name: draftName.value,
        payload: draftPayload.value,
    }));

    // ── helpers（操作本 store 的 state） ──
    function removeSummary(id: string): void {
        summaries.value = summaries.value.filter((s) => s.id !== id);
    }

    /** 用服务端返回的队伍更新 / 插入摘要，并按 updated_at 降序重排。 */
    function upsertSummary(team: TeamSummary): void {
        const idx = summaries.value.findIndex((s) => s.id === team.id);
        if (idx >= 0) summaries.value.splice(idx, 1, { ...team });
        else summaries.value.unshift({ ...team });
        summaries.value = [...summaries.value].toSorted((a, b) => b.updated_at.localeCompare(a.updated_at));
    }

    // ── 列表缩略图（previews） ──
    function setPreview(id: string, payload: TeamPayload, updatedAt: string): void {
        previews.value[id] = cloneTeamPayload(payload);
        previewVersions.set(id, updatedAt);
    }

    function dropPreview(id: string): void {
        if (id in previews.value) delete previews.value[id];
        previewVersions.delete(id);
    }

    /** 清空预览缓存（登出 / 列表清空时调用）。 */
    function clearPreviews(): void {
        previewGeneration++;
        previews.value = {};
        previewVersions.clear();
    }

    /** 摘要已删除或 updated_at 变化 → 丢弃对应预览，下次预取重拉。 */
    function syncPreviews(): void {
        const versions = new Map(summaries.value.map((s) => [s.id, s.updated_at]));
        for (const id of Object.keys(previews.value)) {
            if (versions.get(id) !== previewVersions.get(id)) dropPreview(id);
        }
    }

    /**
     * 后台预取列表缩略图：跳过已缓存项、4 并发、永不抛错。
     * 401（REST 层 refresh 也无法恢复）→ 停止剩余请求，不弹层、不改列表；
     * 404 → 摘除摘要（与 open 一致）；其它错误静默，下次 load 可重试。
     */
    function prefetchPreviews(): Promise<void> {
        if (previewTask) return previewTask;
        const ids = summaries.value.filter((s) => !(s.id in previews.value)).map((s) => s.id);
        if (ids.length === 0) return Promise.resolve();

        const generation = previewGeneration;
        previewTask = (async () => {
            let aborted = false;
            await mapWithConcurrency(ids, PREVIEW_CONCURRENCY, async (id) => {
                if (aborted || generation !== previewGeneration) return;
                try {
                    const team = await teamsApi.getTeam(id);
                    // 列表 / 会话已变（如登出、force 刷新）或前台已写入更新数据（open/save）→ 丢弃
                    if (generation === previewGeneration && !(id in previews.value)) {
                        setPreview(id, normalizePayload(team.payload), team.updated_at);
                    }
                } catch (e) {
                    if (isRestError(e) && e.statusCode === 404) {
                        removeSummary(id);
                        dropPreview(id);
                    } else if (isRestError(e) && e.statusCode === 401) {
                        aborted = true;
                        console.warn('[teams] 缩略图预取 401，停止剩余请求');
                    } else {
                        console.warn('[teams] 缩略图预取失败', id, e);
                    }
                }
            });
        })()
            .catch((e) => {
                console.warn('[teams] 缩略图预取中止', e);
            })
            .finally(() => {
                previewTask = null;
                // 预取期间列表变过 → 为新列表补跑一轮（失败项同样会重试一次）
                if (generation !== previewGeneration) void prefetchPreviews();
            });
        return previewTask;
    }

    // ── 列表 ──
    /**
     * 加载队伍摘要。未登录 → needsLogin=true、空列表（不抛错、不弹层）。
     * 已登录且未加载过 → GET；401（token 失效）回落登录空态。
     */
    async function load(force = false): Promise<void> {
        if (!isAuthenticated()) {
            needsLogin.value = true;
            summaries.value = [];
            clearPreviews();
            listLoaded.value = true;
            return;
        }
        needsLogin.value = false;
        if (listLoaded.value && !force) {
            void prefetchPreviews();
            return;
        }
        // access 过期时先续期，避免列表请求先打一发必 401 的请求再重试。
        if (!(await ensureFreshSession())) {
            needsLogin.value = true;
            summaries.value = [];
            clearPreviews();
            return;
        }

        listLoading.value = true;
        try {
            const before = summarySignature(summaries.value);
            summaries.value = await teamsApi.listTeams();
            listLoaded.value = true;
            if (summarySignature(summaries.value) !== before) previewGeneration++;
            syncPreviews();
            void prefetchPreviews();
        } catch (e) {
            if (isRestError(e) && e.statusCode === 401) {
                needsLogin.value = true;
                summaries.value = [];
                clearPreviews();
            } else {
                throw e;
            }
        } finally {
            listLoading.value = false;
        }
    }

    // ── 草稿 ──
    /** 开始新建：默认名由页面传入（store 不依赖 i18n）。 */
    function beginCreate(name: string): void {
        currentId.value = null;
        draftName.value = name;
        draftPayload.value = emptyPayload();
    }

    /** 打开已有队伍：GET 详情并归一；404 摘除摘要并向上抛（页面返回上一级）。 */
    async function open(id: string): Promise<void> {
        currentId.value = id;
        try {
            const team = await teamsApi.getTeam(id);
            const payload = normalizePayload(team.payload);
            draftName.value = team.name;
            draftPayload.value = payload;
            setPreview(id, payload, team.updated_at);
        } catch (e) {
            if (isRestError(e) && e.statusCode === 404) {
                removeSummary(id);
                dropPreview(id);
                currentId.value = null;
            }
            throw e;
        }
    }

    function setName(name: string): void {
        draftName.value = name;
    }

    function replacePayload(payload: TeamPayload): void {
        draftPayload.value = payload;
    }

    // ── 保存 ──
    /**
     * 保存当前草稿：
     * 1. confirmLogin（确认框取消或登录层关闭 → aborted，静默中止）
     * 2. 归一 payload → validateTeam（名字 / 大小不合法 → invalid，不发请求）
     * 3. 新建（currentId=null）→ POST，**用响应 id 置 currentId**；已有 → PUT
     * 4. 404 → 摘除 + not-found；409/400 → error（保留草稿与 id）
     */
    async function save(): Promise<SaveOutcome> {
        const gated = await gateOrAbort();
        if (gated.aborted) return { status: 'aborted' };

        const payload = normalizePayload(draftPayload.value);
        draftPayload.value = payload;
        const v = validateTeam(draftName.value, payload);
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
                        dropPreview(currentId.value);
                        removeSummary(currentId.value);
                    }
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

    /** 发一次保存请求并更新摘要；不处理 401（由 save 外层做会话恢复重试）。 */
    async function saveOnce(trimmedName: string, payload: TeamPayload): Promise<SaveOutcome> {
        if (currentId.value === null) {
            const created = await teamsApi.createTeam(trimmedName, payload);
            currentId.value = created.id;
            upsertSummary(created);
            setPreview(created.id, payload, created.updated_at);
            return { status: 'saved', id: created.id };
        }
        const updated = await teamsApi.updateTeam(currentId.value, { name: trimmedName, payload });
        upsertSummary(updated);
        setPreview(updated.id, payload, updated.updated_at);
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
    /** 删除：confirmLogin（确认/登录取消 → aborted）；DELETE；404 也按已删除处理。 */
    async function remove(id: string): Promise<{ removed: true } | { aborted: true }> {
        const gated = await gateOrAbort();
        if (gated.aborted) return { aborted: true };

        try {
            await teamsApi.deleteTeam(id);
        } catch (e) {
            if (!(isRestError(e) && e.statusCode === 404)) throw e;
        }
        removeSummary(id);
        dropPreview(id);
        if (currentId.value === id) clearCurrent();
        return { removed: true };
    }

    /** 退出编辑页时清空草稿。 */
    function clearCurrent(): void {
        currentId.value = null;
        draftName.value = '';
        draftPayload.value = emptyPayload();
    }

    return {
        // state
        summaries,
        listLoaded,
        listLoading,
        needsLogin,
        previews,
        currentId,
        draftName,
        draftPayload,
        saving,
        // getter
        draft,
        // actions
        load,
        prefetchPreviews,
        clearPreviews,
        beginCreate,
        open,
        setName,
        replacePayload,
        save,
        remove,
        clearCurrent,
    };
});
