<template>
    <view class="text-browser">
        <view class="text-browser__note">
            <text class="text-browser__note-text">
                与探测器相反，这里**走 resourceManager 的正常缓存** —— 诊断的是内容不是投递，
                而 en 的 flavor.bin 约 2.7 MB，每切一次表重下不可接受。代价是会往共享的 12 条
                memory LRU 里塞条目，可能挤掉 app 正在用的 bundle。
            </text>
        </view>

        <TextBrowseForm
            :lang="lang"
            :group="group"
            :table="table"
            :query="query"
            :busy="loading"
            @update:lang="onLang"
            @update:group="onGroup"
            @update:table="onTable"
            @update:query="onQuery"
        />

        <view v-if="error" class="text-browser__hint text-browser__hint--error">
            <text class="text-browser__hint-text">{{ error }}</text>
        </view>
        <view v-else-if="loading" class="text-browser__hint">
            <text class="text-browser__hint-text">加载中…</text>
        </view>
        <view v-else-if="total === 0" class="text-browser__hint">
            <text class="text-browser__hint-text">{{ emptyNote }}</text>
        </view>

        <view v-else class="glass-panel text-browser__list">
            <text class="text-browser__stats">{{ statsLine }}</text>
            <TextEntryRow v-for="(row, i) in rows" :key="i" :row="row" />
        </view>
    </view>
</template>

<script lang="ts" setup>
/**
 * i18n 文本浏览器实现体。**只在 dev 被动态 import**（见 `devtools.vue` 与
 * `services/devtools/enabled.ts`），正式构建里整个分包被 Rollup 丢掉。
 *
 * 本组件只负责三件事：
 * 1. 语言 / 组 / 表 / 搜索的状态编排与请求时序；
 * 2. 调 `resourceManager` 取 bundle（**走缓存**，与 AssetInspector 的绕开一切相反）；
 * 3. loading / 错误 / 截断的提示文案。
 *
 * 摊平 / 过滤 / 截断这些判定一行都不写在这里，全在 `textBrowse.ts`（node 用例覆盖）。
 *
 * bundle 与行数组一律用 `shallowRef`：names 有三万多条、flavor 更多，用 `ref` 会让
 * Vue 递归代理每一条 entry，切一次语言就卡住几百毫秒。这些数据只整体替换、不就地改，
 * 浅层响应足够。
 */
import { computed, shallowRef, ref } from 'vue';
import { resourceManager } from '@/services/resources/resourceManager';
import { filterRows, pageRows, type TextRow } from '@/services/devtools/textBrowse';
import {
    DEFAULT_TEXT_TABLE,
    TEXT_ROW_LIMIT,
    namesTable,
    flavorTable,
    tableOptions,
    type TextGroupId,
} from '@/pages/devtools/textbrowse-options';
import type { I18nFlavorBundle, I18nNamesBundle } from '@/infra/wasm';
import TextBrowseForm from '@/components/devtools/TextBrowseForm.vue';
import TextEntryRow from '@/components/devtools/TextEntryRow.vue';

const lang = ref('zh-hans');
const group = ref<TextGroupId>('names');
const table = ref(DEFAULT_TEXT_TABLE);
const query = ref('');

const loading = ref(false);
const error = ref('');

/** 当前表摊平后的全部行（未过滤、未截断） */
const rawRows = shallowRef<TextRow[]>([]);

const filtered = computed(() => filterRows(rawRows.value, query.value));
const paged = computed(() => pageRows(filtered.value, TEXT_ROW_LIMIT));
const rows = computed(() => paged.value.shown);
const total = computed(() => paged.value.total);

const statsLine = computed(() =>
    total.value > rows.value.length
        ? `命中 ${total.value} 条，只显示前 ${rows.value.length} 条`
        : `命中 ${total.value} 条`,
);

const emptyNote = computed(() =>
    query.value.trim() ? '没有匹配的条目' : '这张表在该语言下是空的（上游未提供）',
);

/**
 * 请求序号。切语言比 bundle 下载快得多，不带序号的话「先点 en 再点 ja」可能
 * 让先发的 en 后到、把 ja 的结果覆盖掉。只有最后一次请求允许写状态。
 */
let seq = 0;

/**
 * 已下载的 bundle，切表时复用。
 *
 * 写成判别联合而不是 `{ group: TextGroupId; bundle: unknown }`：后者取行时
 * 得断言，而两组恰好都有一张叫 `species` 的表、结构却不同，断错了没人报错。
 */
type Loaded =
    | { lang: string; group: 'names'; bundle: I18nNamesBundle }
    | { lang: string; group: 'flavor'; bundle: I18nFlavorBundle };

const loaded = shallowRef<Loaded | null>(null);

/** 把已加载的 bundle 按当前表摊平。切表走这条，不重新下载。 */
function project(l: Loaded) {
    rawRows.value =
        l.group === 'names' ? namesTable(table.value).rows(l.bundle) : flavorTable(table.value).rows(l.bundle);
}

async function load() {
    const mine = ++seq;
    const wantLang = lang.value;
    const wantGroup = group.value;

    const hit = loaded.value;
    if (hit && hit.lang === wantLang && hit.group === wantGroup) {
        project(hit);
        return;
    }

    loading.value = true;
    error.value = '';
    rawRows.value = [];

    try {
        const next: Loaded =
            wantGroup === 'names'
                ? { lang: wantLang, group: 'names', bundle: await resourceManager.getI18nNames(wantLang) }
                : { lang: wantLang, group: 'flavor', bundle: await resourceManager.getI18nFlavor(wantLang) };
        if (mine !== seq) return;
        loaded.value = next;
        project(next);
    } catch (e) {
        if (mine !== seq) return;
        error.value = e instanceof Error ? e.message : String(e);
    } finally {
        if (mine === seq) loading.value = false;
    }
}

function onLang(v: string) {
    lang.value = v;
    void load();
}

function onGroup(v: TextGroupId) {
    group.value = v;
    // 两组的表名空间不同（名称组有 natures，描述组没有），切组后表名可能落空
    if (!tableOptions(v).some((t) => t.id === table.value)) table.value = DEFAULT_TEXT_TABLE;
    void load();
}

function onTable(v: string) {
    table.value = v;
    void load();
}

function onQuery(v: string) {
    query.value = v;
}

void load();
</script>

<style scoped>
.text-browser {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.text-browser__note {
    padding: 10px 12px;
    border-radius: 12px;
    background: rgba(255, 193, 7, 0.1);
}

.text-browser__note-text {
    font-size: 11px;
    line-height: 16px;
    color: #8a6d1a;
}

.text-browser__hint {
    padding: 32px 14px;
    text-align: center;
}

.text-browser__hint-text {
    font-size: 13px;
    color: #a2a7b2;
}

.text-browser__hint--error .text-browser__hint-text {
    color: #ef4444;
    word-break: break-all;
}

.text-browser__list {
    display: flex;
    flex-direction: column;
    overflow: hidden;
}

.text-browser__stats {
    padding: 10px 12px;
    border-bottom: 1px solid rgba(36, 38, 43, 0.06);
    font-size: 11px;
    font-weight: 700;
    color: #6f7682;
}
</style>
