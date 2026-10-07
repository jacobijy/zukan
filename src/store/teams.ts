/**
 * 队伍 store：列表摘要缓存 + 当前队伍草稿 + 登录闸门 + 错误码分支。
 *
 * 分层（见 docs/data/teams.md）：
 * - 取数走 `teamsApi`（薄 HTTP 客户端）；payload 归一 / 校验走 services/teams/team-model。
 * - 写操作前统一 `authGate.requireLogin()`：未登录弹登录层，用户关闭（LoginDismissedError）
 *   则静默中止、不发请求。
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
import { clearSession, isAuthenticated } from '@/services/session';
import { authGate, LoginDismissedError } from '@/services/session/authGate';
import { emptyPayload, normalizePayload, validateTeam, type TeamPayload } from '@/services/teams/team-model';

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

export const useTeamsStore = defineStore('teams', () => {
    // ── state ──
    const summaries = ref<TeamSummary[]>([]);
    const listLoaded = ref(false);
    const listLoading = ref(false);
    /** 未登录（含 token 失效）标志：列表页据此显示登录引导空态，不主动弹层 */
    const needsLogin = ref(false);

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

    // ── 列表 ──
    /**
     * 加载队伍摘要。未登录 → needsLogin=true、空列表（不抛错、不弹层）。
     * 已登录且未加载过 → GET；401（token 失效）回落登录空态。
     */
    async function load(force = false): Promise<void> {
        if (!isAuthenticated()) {
            needsLogin.value = true;
            summaries.value = [];
            listLoaded.value = true;
            return;
        }
        needsLogin.value = false;
        if (listLoaded.value && !force) return;

        listLoading.value = true;
        try {
            summaries.value = await teamsApi.listTeams();
            listLoaded.value = true;
        } catch (e) {
            if (isRestError(e) && e.statusCode === 401) {
                needsLogin.value = true;
                summaries.value = [];
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
            draftName.value = team.name;
            draftPayload.value = normalizePayload(team.payload);
        } catch (e) {
            if (isRestError(e) && e.statusCode === 404) {
                removeSummary(id);
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
     * 1. requireLogin（关闭 → aborted，静默中止）
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
                    if (currentId.value) removeSummary(currentId.value);
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
            return { status: 'saved', id: created.id };
        }
        const updated = await teamsApi.updateTeam(currentId.value, { name: trimmedName, payload });
        upsertSummary(updated);
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
    /** 删除：requireLogin（关闭 → aborted）；DELETE；404 也按已删除处理。 */
    async function remove(id: string): Promise<{ removed: true } | { aborted: true }> {
        const gated = await gateOrAbort();
        if (gated.aborted) return { aborted: true };

        try {
            await teamsApi.deleteTeam(id);
        } catch (e) {
            if (!(isRestError(e) && e.statusCode === 404)) throw e;
        }
        removeSummary(id);
        if (currentId.value === id) clearCurrent();
        return { removed: true };
    }

    /** 改名：PUT 仅 {name}；页面先校验名字，409 向上抛由页面提示。 */
    async function rename(id: string, name: string): Promise<{ updated: true } | { aborted: true }> {
        const gated = await gateOrAbort();
        if (gated.aborted) return { aborted: true };

        const updated = await teamsApi.updateTeam(id, { name });
        upsertSummary(updated);
        return { updated: true };
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
        currentId,
        draftName,
        draftPayload,
        saving,
        // getter
        draft,
        // actions
        load,
        beginCreate,
        open,
        setName,
        replacePayload,
        save,
        remove,
        rename,
        clearCurrent,
    };
});
