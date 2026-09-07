/**
 * 探测器的资源种类表 —— 只服务开发者工具。
 *
 * pokemon / item 的路径**不在这里重写**，而是调 `imageKindSpec(...).remotePath`：
 * 工具要验证的正是生产代码请求的那个 URL，手抄一份迟早漂移，届时工具报「有图」
 * 而应用报 404，排查方向直接被带偏。
 *
 * badge / type 应用层还没消费（见 encryption-pipeline 4.5），路径只在本表定义。
 */
import { imageKindSpec } from '@/services/resources/imageKind';
import type { ProbeOutcome } from '@/services/devtools/assetProbe';

export type ProbeKindId = 'pokemon' | 'item' | 'badge' | 'type' | 'raw';

export interface ProbeKind {
    id: ProbeKindId;
    label: string;
    /** 是否有 variant 维度（只有 pokemon 有） */
    hasVariant: boolean;
    /** id 输入框的提示文案 */
    idHint: string;
    /** `raw` 时忽略 id/variant，直接用输入的路径 */
    buildPath: (id: number, variant: string) => string;
}

export const PROBE_KINDS: readonly ProbeKind[] = [
    {
        id: 'pokemon',
        label: '立绘',
        hasVariant: true,
        idHint: 'pokemon id（1–1025，形态 10001+）',
        buildPath: (id, variant) => imageKindSpec('pokemon').remotePath(id, variant),
    },
    {
        id: 'item',
        label: '道具',
        hasVariant: false,
        idHint: 'PokeAPI item id（不是英文名）',
        buildPath: (id) => imageKindSpec('item').remotePath(id, ''),
    },
    {
        id: 'badge',
        label: '徽章',
        hasVariant: false,
        idHint: '徽章序号（1–77）',
        buildPath: (id) => `/assets/encrypted/badges/${id}.bin`,
    },
    {
        id: 'type',
        label: '属性',
        hasVariant: false,
        idHint: 'PokeAPI type id（1–19）',
        buildPath: (id) => `/assets/encrypted/types/${id}.bin`,
    },
    {
        id: 'raw',
        label: '裸路径',
        hasVariant: false,
        idHint: '直接填 /assets/encrypted/... （可试 fb/gen-9.bin 看非图片提示）',
        buildPath: () => '',
    },
];

export function probeKind(id: ProbeKindId): ProbeKind {
    return PROBE_KINDS.find((k) => k.id === id) ?? PROBE_KINDS[0]!;
}

/** 默认查询：皮卡丘的 home，一定有图，方便开页就确认链路是通的 */
export const DEFAULT_PROBE_ID = 25;
export const DEFAULT_PROBE_VARIANT = 'home';

/**
 * 一条探测结果的展示模型。
 *
 * `blobUrl` 与 `outcome` 分开存：Blob URL 的生命周期归页面管（换查询 / 卸载要 revoke），
 * 而 `outcome` 是纯数据。混在一起就会出现「清结果时忘了 revoke」的泄漏。
 */
export interface ProbeRow {
    /** 展示标签：批量扫描时是 variant 名，单条时是路径尾段 */
    label: string;
    path: string;
    /** null = 还在跑 */
    outcome: ProbeOutcome | null;
    /** 仅当 `outcome.status === 'ok'` 且明文确实是图片时才有 */
    blobUrl: string | null;
}

/** 结果配色：绿=有图、灰=服务端没有、红=真故障。批量扫描一眼扫过去就是这三色 */
export function rowTone(outcome: ProbeOutcome | null): 'pending' | 'ok' | 'absent' | 'bad' {
    if (!outcome) return 'pending';
    if (outcome.status === 'ok') return 'ok';
    if (outcome.status === 'missing') return 'absent';
    return 'bad';
}

/** 字节数转 KB 展示。放模块作用域而不是组件里 —— `<script setup>` 顶层其实落在
 *  `setup()` 内部，每个实例都会重建一遍这个纯格式化函数。 */
export function kb(n: number): string {
    return `${(n / 1024).toFixed(1)} KB`;
}

export function statusLabel(outcome: ProbeOutcome | null): string {
    if (!outcome) return '…';
    switch (outcome.status) {
        case 'ok':
            return outcome.meta.sniff.mime ? outcome.meta.sniff.kind.toUpperCase() : '非图片';
        case 'missing':
            return '404';
        case 'forbidden':
            return '403 签名过期';
        case 'not-zukan':
            return '非 ZKDX';
        case 'decrypt-failed':
            return '解密失败';
        default:
            return outcome.httpStatus ? `错误 ${outcome.httpStatus}` : '错误';
    }
}
