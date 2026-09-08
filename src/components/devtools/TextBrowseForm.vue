<template>
    <view class="glass-panel text-form">
        <ChipRow label="语言" :options="langOptions" :model-value="lang" nowrap @update:model-value="pick('lang', $event)" />
        <ChipRow label="组" :options="groupOptions" :model-value="group" @update:model-value="pick('group', $event)" />
        <ChipRow label="表" :options="tables" :model-value="table" nowrap @update:model-value="pick('table', $event)" />

        <view class="text-form__field">
            <text class="text-form__label">搜索</text>
            <input
                class="text-form__input"
                :value="query"
                placeholder="文本片段，或纯数字 = 精确 id"
                confirm-type="search"
                @input="onQuery"
            />
        </view>

        <text class="text-form__preview">{{ busy ? '加载中…' : path }}</text>
    </view>
</template>

<script lang="ts" setup>
/**
 * 文本浏览器输入区。dev-only，文案硬编码中文（理由同 AssetProbeCard）。
 *
 * 表清单**跟着组走**，所以在本组件里由 `tableOptions(group)` 算，不从页面传 ——
 * 页面只持有「当前选了哪张表」这一个值。切组时表名可能落空（名称组有 `natures`、
 * 描述组没有），回落规则在 `tableOptions` 的消费方 `namesTable`/`flavorTable` 里，
 * 这里不重复判断。
 */
import { computed } from 'vue';
import ChipRow from '@/components/calc/ChipRow.vue';
import { LANGUAGES } from '@/services/i18n/languages';
import { TEXT_GROUPS, tableOptions, type TextGroupId } from '@/pages/devtools/textbrowse-options';

const props = defineProps<{
    lang: string;
    group: TextGroupId;
    table: string;
    query: string;
    busy: boolean;
}>();

const emit = defineEmits<{
    'update:lang': [value: string];
    'update:group': [value: TextGroupId];
    'update:table': [value: string];
    'update:query': [value: string];
}>();

const langOptions = computed(() => LANGUAGES.map((l) => ({ id: l.id, label: l.label })));
const groupOptions = computed(() => TEXT_GROUPS.map((g) => ({ id: g.id, label: g.label })));
const tables = computed(() => tableOptions(props.group));

/** 当前会去拉哪个 bundle —— 和探测器一样，把真实请求路径摊开给人看 */
const path = computed(() => `/assets/encrypted/fb/i18n/${props.lang}/${props.group}.bin`);

/**
 * ChipRow 单选点已选项会 emit `''`（它的语义是可取消）。这三个都必须始终有值，
 * 空值直接忽略 —— 与 AssetProbeForm 同样的处置。
 */
function pick(field: 'lang' | 'group' | 'table', value: string | string[]) {
    const next = value as string;
    if (!next) return;
    if (field === 'lang') emit('update:lang', next);
    else if (field === 'group') emit('update:group', next as TextGroupId);
    else emit('update:table', next);
}

/** `any`：H5 是 `e.target.value`、小程序是 `e.detail.value`，两端形状不同（同 SearchBar） */
function onQuery(e: any) {
    emit('update:query', e.detail?.value ?? e.target?.value ?? '');
}
</script>

<style scoped>
.text-form {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 14px;
}

.text-form__field {
    display: flex;
    align-items: center;
    gap: 10px;
}

.text-form__label {
    flex-shrink: 0;
    width: 40px;
    font-size: 12px;
    font-weight: 800;
    color: #5b616e;
}

.text-form__input {
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

.text-form__preview {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 10px;
    line-height: 14px;
    color: #a2a7b2;
    word-break: break-all;
}
</style>
