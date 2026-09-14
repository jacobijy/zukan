<template>
    <view class="text-browser">
        <view class="text-browser__note">
            <text class="text-browser__note-text">
                与探测器相反，这里**走 resourceManager 的正常缓存** —— 诊断的是内容不是投递。
                描述组按族 × 档分片：选「图鉴描述」这类族表时从 `s00` 聚合到最大片号、容忍空档
                404；切到效果表拉 `effects.bin`（仅 en/fr/de）。代价是会把分片塞进共享的
                memory LRU，可能挤掉 app 正在用的 bundle —— 浏览一两种语言可忽略。
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
        <view v-else-if="mismatch" class="text-browser__hint text-browser__hint--notice">
            <text class="text-browser__hint-text">{{ mismatch }}</text>
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
 * 行数组一律用 `shallowRef`：names 有三万多条、flavor 更多，用 `ref` 会让 Vue 递归
 * 代理每一条 entry，切一次语言就卡住几百毫秒。这些数据只整体替换、不就地改，浅层
 * 响应足够。描述组的聚合结果按 `(lang, table)` 存在普通 `Map` 里（非响应式 ——
 * 切表时手动投影，不靠 Vue 追踪）。
 */
import { computed, shallowRef, ref } from 'vue';
import { resourceManager } from '@/services/resources/resourceManager';
import { cleanFlavorText } from '@/services/i18n/flavor';
import {
    filterRows,
    pageRows,
    idPrefixNotice,
    mergeFlavorSlices,
    type TextRow,
} from '@/services/devtools/textBrowse';
import {
    DEFAULT_TEXT_TABLE,
    FLAVOR_MAX_SLICE,
    TEXT_ROW_LIMIT,
    namesTable,
    flavorTable,
    tableOptions,
    type TextGroupId,
} from '@/pages/devtools/textbrowse-options';
import type { I18nNamesBundle } from '@/infra/wasm';
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

/**
 * 当前表描述：`namesTable/flavorTable` 已对切组残留的旧表名回落，project() 也用它们，
 * 保证「看到的表」与「按哪个实体校验前缀」始终一致。
 */
const tableCtx = computed(() => {
    const t = group.value === 'names' ? namesTable(table.value) : flavorTable(table.value);
    return { entity: t.entity, label: t.label };
});

const filtered = computed(() => filterRows(rawRows.value, query.value, tableCtx.value.entity));
/** `p25` 敲在道具表这类前缀 / 表实体不符时的指路提示（此刻 filtered 刻意为空） */
const mismatch = computed(() => idPrefixNotice(query.value, tableCtx.value));
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

/** 名称组整包，切表时复用（一个语言一个包，字段结构固定）。 */
const namesLoaded = shallowRef<{ lang: string; bundle: I18nNamesBundle } | null>(null);

/**
 * 描述组聚合结果缓存：`${lang}:${tableId}` → 摊平后的全部行。
 * 族表一次性从 `s00` 聚合到 `FLAVOR_MAX_SLICE`（容忍空档 404），效果表拉
 * `effects.bin`。按 (lang, table) 缓存，切回同一张表不再重新聚合。
 * 普通 `Map`（非响应式）：切表时手动投影，不靠 Vue 追踪。
 */
const flavorCache = new Map<string, TextRow[]>();

/**
 * 聚合描述组一张表的全部行。族表（species/moves/abilities/items）把该族各片
 * **并行**拉下来、按 id 排序合并 —— 空档位 / 空语言（cs/pt-br/ja-roma）的 404
 * 属「该档无描述」，跳过不报错，这正是「看服务端到底给了什么」要看到的形状。
 * 效果表拉 `effects.bin`（404 = 该语言无效果文本）。
 */
async function aggregateFlavorTable(lang: string, tableId: string): Promise<TextRow[]> {
    const t = flavorTable(tableId);
    if (t.family) {
        const family = t.family;
        const slices = Array.from({ length: FLAVOR_MAX_SLICE[family] + 1 }, (_, i) => i);
        const bundles = await Promise.all(
            slices.map(async (slice) => {
                try {
                    return await resourceManager.getI18nFlavorSlice(lang, family, slice);
                } catch {
                    return null; // 空档位 / 空语言 404 属「该档无描述」，跳过
                }
            }),
        );
        return mergeFlavorSlices(bundles, family, cleanFlavorText);
    }
    try {
        const b = await resourceManager.getI18nFlavorEffects(lang);
        return t.rows(b);
    } catch {
        return [];
    }
}

async function load() {
    const mine = ++seq;
    const wantLang = lang.value;
    const wantGroup = group.value;

    // ── 名称组：整包缓存，切表直接投影 ──
    if (wantGroup === 'names') {
        const hit = namesLoaded.value;
        if (hit && hit.lang === wantLang) {
            rawRows.value = namesTable(table.value).rows(hit.bundle);
            return;
        }
        loading.value = true;
        error.value = '';
        rawRows.value = [];
        try {
            const bundle = await resourceManager.getI18nNames(wantLang);
            if (mine !== seq) return;
            namesLoaded.value = { lang: wantLang, bundle };
            rawRows.value = namesTable(table.value).rows(bundle);
        } catch (e) {
            if (mine !== seq) return;
            error.value = e instanceof Error ? e.message : String(e);
        } finally {
            if (mine === seq) loading.value = false;
        }
        return;
    }

    // ── 描述组：按 (lang, table) 聚合，缓存命中直接投影 ──
    const cacheKey = `flavor:${wantLang}:${table.value}`;
    const cached = flavorCache.get(cacheKey);
    if (cached) {
        rawRows.value = cached;
        return;
    }
    loading.value = true;
    error.value = '';
    rawRows.value = [];
    try {
        const rows = await aggregateFlavorTable(wantLang, table.value);
        if (mine !== seq) return;
        flavorCache.set(cacheKey, rows);
        rawRows.value = rows;
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

/* 前缀 / 表实体不符：琥珀色指路盒（与顶部说明条同色系），左对齐便于读整句 */
.text-browser__hint--notice {
    margin: 0 12px;
    padding: 12px 14px;
    border-radius: 12px;
    text-align: left;
    background: rgba(255, 193, 7, 0.1);
}

.text-browser__hint--notice .text-browser__hint-text {
    color: #8a6d1a;
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
