<template>
    <view class="glass-panel probe-form">
        <ChipRow label="种类" :options="kindOptions" :model-value="kind" nowrap @update:model-value="onKindChange" />

        <view v-if="kind === 'raw'" class="probe-form__field">
            <text class="probe-form__label">路径</text>
            <input v-model="rawPath" class="probe-form__input" :placeholder="hint" confirm-type="search" />
        </view>

        <template v-else>
            <view class="probe-form__field">
                <text class="probe-form__label">id</text>
                <input v-model="idText" class="probe-form__input" type="number" :placeholder="hint" />
            </view>
            <view v-if="current.hasVariant" class="probe-form__field">
                <text class="probe-form__label">variant</text>
                <input v-model="variant" class="probe-form__input" placeholder="home" />
            </view>
        </template>

        <text class="probe-form__preview">{{ resolvedPath || '—' }}</text>

        <view class="probe-form__actions">
            <view class="probe-form__btn probe-form__btn--primary" :class="{ 'probe-form__btn--busy': busy }" @click="onProbe">
                {{ busy ? '探测中…' : '探测' }}
            </view>
            <view
                v-if="current.hasVariant"
                class="probe-form__btn"
                :class="{ 'probe-form__btn--busy': busy }"
                @click="onScan"
            >扫全部 variant</view>
        </view>
    </view>
</template>

<script lang="ts" setup>
/**
 * 探测器输入区。dev-only，文案硬编码中文（理由见 AssetProbeCard）。
 *
 * 路径不在本组件拼 —— 由 `devtools-options.ts` 的 kind 表构造，pokemon / item 那两条
 * 直接复用生产的 `imageKindSpec().remotePath`。工具要验证的正是生产请求的 URL。
 */
import { computed, ref } from 'vue';
import ChipRow from '@/components/calc/ChipRow.vue';
import {
    PROBE_KINDS,
    probeKind,
    DEFAULT_PROBE_ID,
    DEFAULT_PROBE_VARIANT,
    type ProbeKindId,
} from '@/pages/devtools/devtools-options';

const props = defineProps<{ busy: boolean }>();

const emit = defineEmits<{
    probe: [path: string, label: string];
    scan: [id: number];
}>();

const kind = ref<ProbeKindId>('pokemon');
const idText = ref(String(DEFAULT_PROBE_ID));
const variant = ref(DEFAULT_PROBE_VARIANT);
const rawPath = ref('');

const kindOptions = computed(() => PROBE_KINDS.map((k) => ({ id: k.id, label: k.label })));
const current = computed(() => probeKind(kind.value));
const hint = computed(() => current.value.idHint);

const parsedId = computed(() => {
    const n = Number.parseInt(idText.value, 10);
    return Number.isFinite(n) && n > 0 ? n : 0;
});

const resolvedPath = computed(() => {
    if (kind.value === 'raw') return rawPath.value.trim();
    if (!parsedId.value) return '';
    return current.value.buildPath(parsedId.value, variant.value.trim() || DEFAULT_PROBE_VARIANT);
});

/**
 * ChipRow 单选点已选项会 emit `''`（它的语义是可取消）。这里种类必须始终有一个，
 * 空值直接忽略 —— 改 ChipRow 会波及计算器页，不值得。
 */
function onKindChange(value: string | string[]) {
    const next = value as string;
    if (!next) return;
    kind.value = next as ProbeKindId;
}

function onProbe() {
    if (props.busy) return;
    const path = resolvedPath.value;
    if (!path) {
        uni.showToast({ title: '先填 id 或路径', icon: 'none' });
        return;
    }
    emit('probe', path, kind.value === 'raw' ? path : (path.split('/').pop() ?? path));
}

function onScan() {
    if (props.busy) return;
    if (!parsedId.value) {
        uni.showToast({ title: '先填 pokemon id', icon: 'none' });
        return;
    }
    emit('scan', parsedId.value);
}
</script>

<style scoped>
.probe-form {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 14px;
}

.probe-form__field {
    display: flex;
    align-items: center;
    gap: 10px;
}

.probe-form__label {
    flex-shrink: 0;
    width: 56px;
    font-size: 12px;
    font-weight: 800;
    color: #5b616e;
}

.probe-form__input {
    flex: 1;
    min-width: 0;
    height: 34px;
    padding: 0 10px;
    border: 1px solid rgba(36, 38, 43, 0.1);
    border-radius: 10px;
    font-size: 13px;
    color: #24262b;
    background: #f7f8fa;
}

.probe-form__preview {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 10px;
    line-height: 14px;
    color: #a2a7b2;
    word-break: break-all;
}

.probe-form__actions {
    display: flex;
    gap: 8px;
}

.probe-form__btn {
    flex: 1;
    height: 38px;
    border-radius: 12px;
    font-size: 13px;
    font-weight: 800;
    line-height: 38px;
    color: #3b3f48;
    text-align: center;
    background: #eef1f6;
}

.probe-form__btn--primary {
    color: #ffffff;
    background: linear-gradient(135deg, #ff7a6b 0%, #ef4444 100%);
}

.probe-form__btn--busy {
    opacity: 0.55;
}
</style>
