<template>
    <view class="probe-card" :class="`probe-card--${tone}`">
        <view class="probe-card__head">
            <text class="probe-card__label">{{ row.label }}</text>
            <text class="probe-card__pill">{{ statusText }}</text>
        </view>

        <!-- 图：只在明文确实是图片时渲染。非图片给 hex，不给裂图 -->
        <image v-if="row.blobUrl" :src="row.blobUrl" class="probe-card__img" mode="aspectFit" />
        <view v-else class="probe-card__slot">
            <text class="probe-card__slot-text">{{ slotText }}</text>
        </view>

        <view v-if="metaLines.length" class="probe-card__meta">
            <text v-for="line in metaLines" :key="line" class="probe-card__meta-line">{{ line }}</text>
        </view>

        <text v-if="hexLine" class="probe-card__hex">{{ hexLine }}</text>
        <text class="probe-card__path">{{ row.path }}</text>
    </view>
</template>

<script lang="ts" setup>
/**
 * 单条探测结果。dev-only 工具，文案直接写中文（不接 i18n —— 往 ui-messages 的
 * zh/en 两份里塞几十条只有开发者看得到的键纯粹是噪音）。
 *
 * 展示原则：**每种失败都说清是哪种**。应用层把 404 藏进回落链是对的，工具反过来，
 * 404 / 403 / 非 ZKDX / 解密失败必须能一眼分开，否则它诊断不出任何东西。
 */
import { computed } from 'vue';
import { rowTone, statusLabel, kb, type ProbeRow } from '@/pages/devtools/devtools-options';

const props = defineProps<{ row: ProbeRow }>();

const tone = computed(() => rowTone(props.row.outcome));
const statusText = computed(() => statusLabel(props.row.outcome));

const slotText = computed(() => {
    const o = props.row.outcome;
    if (!o) return '探测中…';
    switch (o.status) {
        case 'ok':
            // 解密成功但明文不是图片：最常见是把 fb bundle 的路径填进来了
            return o.meta.sniff.tag ? `FlatBuffers ${o.meta.sniff.tag}` : '未知明文格式';
        case 'missing':
            // 有含义的缺席（如 female 不存在 = 不分性别）说清楚，别一律报「无此资源」
            return props.row.absentNote ?? '服务端无此资源';
        case 'forbidden':
            return 'CDN 签名过期（未自动重签）';
        case 'not-zukan':
            return '响应体不是 ZKDX 密文';
        case 'decrypt-failed':
            return o.message;
        default:
            return o.message;
    }
});

const metaLines = computed<string[]>(() => {
    const o = props.row.outcome;
    if (!o) return [];
    switch (o.status) {
        case 'ok':
            return [
                `密文 ${kb(o.meta.cipherBytes)} → 明文 ${kb(o.meta.plainBytes)}`,
                `FORMAT_VERSION ${o.meta.formatVersion} · 下载 ${o.meta.fetchMs}ms · 解密 ${o.meta.decryptMs}ms`,
            ];
        case 'not-zukan':
            return [`响应 ${kb(o.cipherBytes)} · 下载 ${o.fetchMs}ms`];
        case 'decrypt-failed':
            return [`密文 ${kb(o.cipherBytes)} · FORMAT_VERSION ${o.formatVersion} · 下载 ${o.fetchMs}ms`];
        case 'missing':
        case 'forbidden':
            return [`下载 ${o.fetchMs}ms`];
        default:
            return [];
    }
});

/** 非图片时 hex 头是唯一能判断「这到底是什么」的东西 */
const hexLine = computed(() => {
    const o = props.row.outcome;
    if (!o) return '';
    if (o.status === 'ok' && !o.meta.sniff.mime) return o.meta.head;
    if (o.status === 'not-zukan') return o.head;
    return '';
});
</script>

<style scoped>
.probe-card {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 10px;
    border: 1px solid rgba(36, 38, 43, 0.08);
    border-radius: 14px;
    background: #ffffff;
}

.probe-card--ok {
    border-color: rgba(34, 168, 96, 0.35);
}

.probe-card--absent {
    border-color: rgba(36, 38, 43, 0.1);
    background: #f7f8fa;
}

.probe-card--bad {
    border-color: rgba(220, 66, 62, 0.4);
    background: #fff6f5;
}

.probe-card__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
}

.probe-card__label {
    overflow: hidden;
    font-size: 13px;
    font-weight: 800;
    color: #24262b;
    white-space: nowrap;
    text-overflow: ellipsis;
}

.probe-card__pill {
    flex-shrink: 0;
    padding: 2px 7px;
    border-radius: 999px;
    font-size: 10px;
    font-weight: 800;
    color: #5b616e;
    background: #eef1f6;
}

.probe-card--ok .probe-card__pill {
    color: #14683d;
    background: #ddf5e6;
}

.probe-card--bad .probe-card__pill {
    color: #8d2420;
    background: #ffe0dd;
}

.probe-card__img {
    width: 100%;
    height: 120px;
    border-radius: 10px;
    background: repeating-conic-gradient(#f0f2f6 0% 25%, #ffffff 0% 50%) 50% / 14px 14px;
}

.probe-card__slot {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 52px;
    padding: 8px;
    border-radius: 10px;
    background: #f2f4f8;
}

.probe-card__slot-text {
    font-size: 11px;
    font-weight: 600;
    color: #7c828e;
    text-align: center;
}

.probe-card__meta,
.probe-card__hex,
.probe-card__path {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 10px;
    line-height: 15px;
    color: #6d7380;
}

.probe-card__meta {
    display: flex;
    flex-direction: column;
}

.probe-card__meta-line {
    font-size: 10px;
}

.probe-card__hex {
    padding: 5px 6px;
    border-radius: 8px;
    color: #4b5160;
    word-break: break-all;
    background: #eef1f6;
}

.probe-card__path {
    color: #a2a7b2;
    word-break: break-all;
}
</style>
