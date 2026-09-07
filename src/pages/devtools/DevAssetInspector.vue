<template>
    <view class="inspector">
        <view class="inspector__note">
            <text class="inspector__note-text">
                直连服务端，不走任何缓存（LRU / IDB 密文 / 可用性记录全部绕开），也不自动回落、不自动重试 ——
                看到的就是此刻的第一手结果。
            </text>
            <text class="inspector__note-meta">{{ envLine }}</text>
        </view>

        <AssetProbeForm :busy="busy" @probe="runOne" @scan="runScan" />

        <view v-if="rows.length" class="inspector__grid">
            <AssetProbeCard v-for="row in rows" :key="row.path" :row="row" />
        </view>
        <view v-else class="inspector__empty">
            <text class="inspector__empty-text">填 id 或路径后点「探测」</text>
        </view>
    </view>
</template>

<script lang="ts" setup>
/**
 * 加密资源探测器实现体。**只在 dev 被动态 import**（见 `devtools.vue` 与
 * `services/devtools/enabled.ts`），正式构建里整个分包被 Rollup 丢掉。
 *
 * 本组件只负责三件事：
 * 1. 把生产的 http / wasm / session 模块组装成 `ProbeDeps` 注进纯逻辑；
 * 2. 管 Blob URL 的生命周期（换查询 / 卸载都要 revoke —— 这里没有 `imageCache`
 *    的引用计数帮忙兜着，漏一次就是一次泄漏）；
 * 3. 批量扫描的串行编排。
 *
 * 判定逻辑一行都不写在这里，全在 `assetProbe.ts`（node 用例覆盖）。
 */
import { computed, onUnmounted, ref } from 'vue';
import AssetProbeForm from '@/components/devtools/AssetProbeForm.vue';
import AssetProbeCard from '@/components/devtools/AssetProbeCard.vue';
import { probeAsset, type ProbeDeps, type ProbeOutcome } from '@/services/devtools/assetProbe';
import { probeKind, absentNoteFor, type ProbeRow } from '@/pages/devtools/devtools-options';
import { SPRITE_VARIANT_CATALOG } from '@/constants/spriteVariants';
import { fetchBinary, BinaryRequestError } from '@/services/http';
import { buildCdnUrl, currentDataVersion } from '@/services/resources';
import { getKey } from '@/services/session';
import { initWasm, decryptZukan, isValidZukanFile, getZukanVersion } from '@/infra/wasm';

const rows = ref<ProbeRow[]>([]);
const busy = ref(false);

const envLine = computed(
    () => `${import.meta.env.VITE_API_BASE_URL ?? '(未配置 VITE_API_BASE_URL)'} · 资源版本 v${currentDataVersion()}`,
);

const deps: ProbeDeps = {
    fetchCipher: async (path) => {
        const { cdn } = await getKey();
        // retries: 0 —— 默认会重试一次网络错误 / 5xx，那会把偶发失败藏起来。
        // 诊断要的是第一手结果，重试留给使用者自己再点一次。
        return fetchBinary(buildCdnUrl(path, cdn), { retries: 0 });
    },
    // getKey 内部有缓存，与上面那次是同一份，不会多一个往返
    getDek: async () => (await getKey()).dek,
    decrypt: (bytes, dek) => decryptZukan(bytes, dek),
    isZukan: isValidZukanFile,
    versionOf: getZukanVersion,
    httpStatusOf: (err) => (err instanceof BinaryRequestError ? err.statusCode : undefined),
};

/** 撤销并清空现有结果。换查询与卸载都必须走这里，否则 Blob URL 直接泄漏。 */
function clearRows(): void {
    for (const row of rows.value) {
        if (row.blobUrl) URL.revokeObjectURL(row.blobUrl);
    }
    rows.value = [];
}

onUnmounted(clearRows);

function toRow(label: string, path: string, outcome: ProbeOutcome, absentNote?: string): ProbeRow {
    // 明文不是图片时 mime 为 null：不建 Blob，卡片改显示 hex 头
    const mime = outcome.status === 'ok' ? outcome.meta.sniff.mime : null;
    const blobUrl =
        outcome.status === 'ok' && mime ? URL.createObjectURL(new Blob([outcome.bytes], { type: mime })) : null;
    return { label, path, outcome, blobUrl, absentNote };
}

function errorRow(label: string, path: string, err: unknown): ProbeRow {
    return {
        label,
        path,
        outcome: { status: 'error', message: err instanceof Error ? err.message : String(err) },
        blobUrl: null,
    };
}

async function runOne(path: string, label: string): Promise<void> {
    clearRows();
    busy.value = true;
    rows.value = [{ label, path, outcome: null, blobUrl: null }];
    try {
        await initWasm();
        rows.value = [toRow(label, path, await probeAsset(path, deps))];
    } catch (err) {
        // probeAsset 自己不抛，走到这里说明是 initWasm / 登录层这类外围失败
        rows.value = [errorRow(label, path, err)];
    } finally {
        busy.value = false;
    }
}

async function runScan(id: number): Promise<void> {
    clearRows();
    busy.value = true;
    const spec = probeKind('pokemon');
    rows.value = SPRITE_VARIANT_CATALOG.map((variant) => ({
        label: variant,
        path: spec.buildPath(id, variant),
        outcome: null,
        blobUrl: null,
        absentNote: absentNoteFor(variant),
    }));

    try {
        await initWasm();
        // 刻意串行：并发会把 4 个连接槽外的请求丢给浏览器排队，实测耗时就不再是
        // 单张的真实延迟了；而这是人工触发的一次性动作（10 个请求、最坏约 1 MB），
        // 不需要快。串行还能让结果逐格点亮，看得见进度。
        for (let i = 0; i < rows.value.length; i += 1) {
            const row = rows.value[i]!;
            // eslint-disable-next-line no-await-in-loop -- 串行是本意，见上
            const outcome = await probeAsset(row.path, deps);
            rows.value[i] = toRow(row.label, row.path, outcome, row.absentNote);
        }
    } catch (err) {
        console.warn('[devtools] 扫描中断', err);
    } finally {
        busy.value = false;
    }
}
</script>

<style scoped>
.inspector {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.inspector__note {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 10px 12px;
    border: 1px solid rgba(239, 68, 68, 0.18);
    border-radius: 12px;
    background: #fff6f5;
}

.inspector__note-text {
    font-size: 11px;
    line-height: 17px;
    color: #8d5450;
}

.inspector__note-meta {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 10px;
    color: #b58a86;
    word-break: break-all;
}

.inspector__grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
}

.inspector__empty {
    padding: 28px 0;
    text-align: center;
}

.inspector__empty-text {
    font-size: 12px;
    color: #a2a7b2;
}

@media (min-width: 640px) {
    .inspector__grid {
        grid-template-columns: repeat(3, minmax(0, 1fr));
    }
}
</style>
