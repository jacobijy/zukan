<template>
    <view class="min-h-screen page-bg" :style="pageSafeArea">
        <DetailNavbar :title="isNew ? t('templates.create') : t('templates.editTitle')" fallback-url="/pages/templates/templates" @back="confirmExit">
            <template #right></template>
        </DetailNavbar>

        <scroll-view scroll-y class="edit-scroll mt-[var(--navbar-total-height)] h-[calc(100vh-var(--navbar-total-height))]">
            <view class="mx-auto flex max-w-[720px] flex-col gap-4 px-4 pb-32 pt-3">
                <!-- 名称 -->
                <view class="glass-panel edit-head">
                    <input
                        class="edit-name"
                        :value="store.draftName"
                        :placeholder="t('templates.namePlaceholder')"
                        maxlength="50"
                        @input="onNameInput"
                    />
                </view>

                <!-- 共享配置内核：规则分段 + 宝可梦/等级/性格 + 六维与实时结果 -->
                <TemplateBuildEditor v-model="build" v-model:level="level" />

                <!-- 招式 -->
                <view class="glass-panel moves-panel">
                    <view class="moves-block__head">
                        <text class="panel-label">{{ t('templates.fieldMoves') }}</text>
                        <text class="moves-count">{{ (payload?.moves.length ?? 0) }}/4</text>
                    </view>
                    <view class="moves-chips">
                        <SelectedMoveChip
                            v-for="m in payload?.moves ?? []"
                            :key="m"
                            :move-id="m"
                            :type="typeOfMove(m)"
                            removable
                            @remove="removeMove(m)"
                        />
                        <view v-if="(payload?.moves.length ?? 0) < 4" class="moves-add" @click="moveSheetOpen = true">
                            <!-- #ifdef MP-WEIXIN -->
                            <text class="ic text-[14px]">{{ glyph('plus') }}</text>
                            <!-- #endif -->
                            <!-- #ifndef MP-WEIXIN -->
                            <svg data-ic="plus" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" class="h-3.5 w-3.5"><path d="M12 5v14M5 12h14"></path></svg>
                            <!-- #endif -->
                            <text>{{ t('templates.fieldMoves') }}</text>
                        </view>
                    </view>
                </view>

                <!-- 道具 -->
                <view class="glass-panel field-row" @click="itemSheetOpen = true">
                    <text class="panel-label">{{ t('templates.fieldItem') }}</text>
                    <view class="field-row__value">
                        <text :class="{ 'field-row__text--empty': !payload?.item }">{{ itemText }}</text>
                        <!-- #ifdef MP-WEIXIN -->
                        <text class="ic text-[16px] text-[#c4c7cf]">{{ glyph('chevron-right') }}</text>
                        <!-- #endif -->
                        <!-- #ifndef MP-WEIXIN -->
                        <svg data-ic="chevron-right" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4 text-[#c4c7cf]">
                            <path d="m9 18 6-6-6-6"></path>
                        </svg>
                        <!-- #endif -->
                    </view>
                </view>
            </view>
        </scroll-view>

        <!-- 底部固定保存条 -->
        <view class="save-bar">
            <button
                class="save-bar__btn"
                :class="{ 'save-bar__btn--busy': store.saving }"
                :disabled="store.saving"
                @click="onSave"
            >
                <text>{{ store.saving ? t('templates.saving') : t('templates.save') }}</text>
            </button>
        </view>

        <!-- 招式选择 -->
        <OptionSheet
            v-model:visible="moveSheetOpen"
            multi
            :max="4"
            :title="t('templates.fieldMoves')"
            :options="moveOptions"
            :model-value="(payload?.moves ?? []).map(String)"
            @update:model-value="onPickMoves"
        />
        <!-- 道具选择 -->
        <OptionSheet
            v-model:visible="itemSheetOpen"
            :title="t('templates.fieldItem')"
            :options="itemOptions"
            :model-value="payload?.item ? String(payload.item) : '0'"
            @update:model-value="onPickItem"
        />
    </view>
</template>

<script lang="ts" setup>
import { usePageSafeArea } from '@/composables/usePageSafeArea';
import { computed, ref, watch } from 'vue';
import { onBackPress, onLoad } from '@dcloudio/uni-app';
import { useI18n } from 'vue-i18n';
import DetailNavbar from '@/components/shared/DetailNavbar.vue';
import OptionSheet, { type SheetOption } from '@/components/shared/OptionSheet.vue';
import SelectedMoveChip from '@/components/teams/SelectedMoveChip.vue';
import TemplateBuildEditor from '@/components/templates/TemplateBuildEditor.vue';
import { useI18nStore } from '@/store/i18n';
import { loadMovePoolForForm } from '@/services/teams/member-options';
import { useTemplatesStore, type TemplateSaveOutcome } from '@/store/templates';
import { glyph } from '@/components/icon/glyphs';
import type { TemplatePayload } from '@/services/templates/template-model';

const pageSafeArea = usePageSafeArea();

const { t } = useI18n();
const store = useTemplatesStore();
const i18nStore = useI18nStore();

const isNew = computed(() => store.currentId === null);
const payload = computed<TemplatePayload | null>(() => store.draftPayload);
const level = ref(50); // 预览等级（不入库）

// 共享内核 v-model：读 store 草稿、写 store 草稿
const build = computed({
    get: () => store.draftPayload,
    set: (p: TemplatePayload | null) => store.replacePayload(p),
});

// ── 初始化 ──
onLoad(async (options) => {
    if (options?.id) {
        try {
            await store.open(options.id);
        } catch {
            uni.navigateBack();
            return;
        }
    } else if (store.currentId === null && store.draftPayload === null) {
        // 无预填（直接进入）→ 兜底新建
        store.beginCreate(t('templates.defaultName'));
    }
    snapshot.value = { name: store.draftName, payload: clonePayload(store.draftPayload) };
});

// ── 脏检查 ──
interface Snapshot {
    name: string;
    payload: TemplatePayload | null;
}
const snapshot = ref<Snapshot | null>(null);

const isDirty = computed(() => {
    if (!snapshot.value) return false;
    return (
        snapshot.value.name !== store.draftName ||
        JSON.stringify(snapshot.value.payload) !== JSON.stringify(store.draftPayload)
    );
});

function clonePayload(p: TemplatePayload | null): TemplatePayload | null {
    return p === null ? null : (JSON.parse(JSON.stringify(p)) as TemplatePayload);
}

/** 返回 / 导航退出时：有未保存改动 → 三选（保存草稿 / 放弃 / 取消）。 */
function confirmExit(): void {
    if (!isDirty.value) {
        uni.navigateBack();
        return;
    }
    uni.showActionSheet({
        itemList: [t('templates.saveDraft'), t('templates.discard')],
        success: (res) => {
            if (res.tapIndex === 0) {
                store.saveDraft();
                snapshot.value = { name: store.draftName, payload: clonePayload(store.draftPayload) };
                uni.navigateBack();
            } else if (res.tapIndex === 1) {
                store.clearCurrent();
                snapshot.value = null;
                uni.navigateBack();
            }
            // 其它（取消）→ 留在页面
        },
        fail: () => {
            // 用户取消弹层 → 留在页面
        },
    });
}

// 小程序手势 / 顶栏返回
onBackPress(() => {
    if (!isDirty.value) return false;
    confirmExit();
    return true;
});

// ── 名称 ──
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function onNameInput(e: any): void {
    store.setName(e.detail?.value ?? e.target?.value ?? '');
}

// ── 招式 / 道具 ──
const moveSheetOpen = ref(false);
const itemSheetOpen = ref(false);
const movePool = ref<MoveRecord[]>([]);

// 随宝可梦变化加载可学招式池
watch(
    () => payload.value?.pokemon_id,
    async (id) => {
        if (!id) {
            movePool.value = [];
            return;
        }
        try {
            movePool.value = await loadMovePoolForForm(id);
        } catch {
            movePool.value = [];
        }
    },
    { immediate: true },
);

const moveOptions = computed<SheetOption[]>(() =>
    movePool.value.map((r) => ({
        id: String(r.id),
        label: i18nStore.moveName(r.id) ?? `#${r.id}`,
        ...(typeof r.power === 'number' ? { trailing: String(r.power) } : {}),
        subtitle: `${i18nStore.typeName(r.type) ?? r.type}`,
    })),
);

const itemOptions = computed<SheetOption[]>(() => [
    { id: '0', label: t('templates.none') },
    ...[...(i18nStore.lookup?.items.keys() ?? [])]
        .toSorted((a, b) => a - b)
        .map((id) => ({ id: String(id), label: i18nStore.itemName(id) ?? `#${id}` })),
]);

function typeOfMove(id: number): string | undefined {
    return movePool.value.find((r) => r.id === id)?.type;
}

function onPickMoves(ids: string | string[]): void {
    const p = payload.value;
    if (!p) return;
    const list = Array.isArray(ids) ? ids : [];
    const moves = [...new Set(list.map(Number).filter((n) => Number.isInteger(n) && n > 0))].slice(0, 4);
    store.replacePayload({ ...p, moves });
}

function removeMove(id: number): void {
    const p = payload.value;
    if (!p) return;
    store.replacePayload({ ...p, moves: p.moves.filter((m) => m !== id) });
}

function onPickItem(id: string | string[]): void {
    const p = payload.value;
    if (!p) return;
    const value = typeof id === 'string' ? id : '';
    store.replacePayload({ ...p, item: value === '0' ? null : Number(value) });
}

const itemText = computed(() =>
    payload.value?.item ? (i18nStore.itemName(payload.value.item) ?? `#${payload.value.item}`) : t('templates.none'),
);

// ── 保存 ──
async function onSave(): Promise<void> {
    let out: TemplateSaveOutcome;
    try {
        out = await store.save();
    } catch {
        // 非 RestRequestError（网络中断等）：兜底提示，避免静默失败
        uni.showToast({ title: t('templates.errorGeneric'), icon: 'none' });
        return;
    }
    if (out.status === 'saved') {
        snapshot.value = { name: store.draftName, payload: clonePayload(store.draftPayload) };
        uni.showToast({ title: t('templates.saved'), icon: 'none' });
        setTimeout(() => uni.navigateBack(), 400);
    } else if (out.status === 'aborted') {
        // 静默：用户主动关闭了登录层
    } else if (out.status === 'invalid') {
        uni.showToast({ title: invalidText(out.reason), icon: 'none' });
    } else if (out.reason === 'session-expired') {
        // 会话已失效且刷新失败 → 引导重新登录
        uni.showToast({ title: t('templates.errorAuth'), icon: 'none' });
    } else {
        uni.showToast({ title: out.message ?? t('templates.errorGeneric'), icon: 'none' });
    }
}

function invalidText(reason: 'name-required' | 'name-too-long' | 'payload-too-large' | 'pokemon-required'): string {
    if (reason === 'name-required') return t('templates.errorNameRequired');
    if (reason === 'name-too-long') return t('templates.errorNameTooLong');
    if (reason === 'payload-too-large') return t('templates.errorPayloadTooLarge');
    return t('templates.errorPokemonRequired');
}
</script>

<style lang="scss" scoped>
.edit-scroll {
    width: 100%;
}

.save-bar {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 500;
    padding: 12px 16px calc(env(safe-area-inset-bottom, 0px) + 12px);
    background: linear-gradient(to top, rgba(247, 248, 251, 0.98) 60%, rgba(247, 248, 251, 0));
}

.save-bar__btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 50px;
    border-radius: 16px;
    color: #ffffff;
    font-size: 16px;
    font-weight: 800;
    background: linear-gradient(135deg, #ff8a7e, #e04f47);
    box-shadow: 0 12px 24px rgba(224, 79, 71, 0.22);

    &::after {
        border: none !important;
    }

    &:active {
        opacity: 0.85;
    }

    &:disabled {
        opacity: 0.6;
    }
}

.edit-head {
    display: flex;
    flex-direction: column;
    padding: 14px;
}

.edit-name {
    height: 46px;
    padding: 0 12px;
    border-radius: 14px;
    background: #f5f6fa;
    font-size: 16px;
    font-weight: 800;
    color: #24262b;
}

.panel-label {
    font-size: 13px;
    font-weight: 700;
    color: #6f7682;
}

.moves-panel {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 14px;
}

.moves-block__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
}

.moves-count {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 11px;
    font-weight: 800;
    color: #b0b5bf;
}

.moves-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
}

.moves-add {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 10px;
    border: 1px dashed #c9ced8;
    border-radius: 10px;
    color: #6f7682;
    font-size: 12px;
    font-weight: 700;
}

.field-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: 52px;
    padding: 0 14px;
}

.field-row__value {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    font-weight: 700;
    color: #24262b;
}

.field-row__text--empty {
    color: #b0b5bf;
}
</style>
