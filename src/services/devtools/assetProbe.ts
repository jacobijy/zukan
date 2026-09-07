/**
 * 加密资源探测：取一份服务端 ZKDX 密文，解密，说清楚它到底是什么。
 *
 * **诊断工具的语义与应用层刻意相反。** `spriteLoader` / `useEncryptedImage` 的职责是
 * 「让用户看到一张图」，所以 404 走回落链、preview 的 404 连日志都不打。本模块的职责
 * 是「让开发者看到真相」，因此每种失败都单独成一个 outcome，一个都不吞：
 *
 * | outcome | 含义 | 典型原因 |
 * |---------|------|---------|
 * | `ok` | 链路全通（图不图看 `meta.sniff`） | — |
 * | `missing` | HTTP 404 | 该 id/variant 服务端确实没产出，对照 encryption-pipeline 4.3 |
 * | `forbidden` | HTTP 403 | CDN 签名过期（应用层会自动重签，这里**不重试**，就是要让人看见） |
 * | `not-zukan` | 200 但魔数不是 `ZKDX` | 拿到的是错误页 / 明文文件 / 路径打错 |
 * | `decrypt-failed` | 头对但 AES-GCM 解不开 | DEK 版本不匹配、密文被截断 |
 * | `error` | 网络失败、取 DEK 失败、其它状态码 | — |
 *
 * 同理**不碰任何缓存**（`imageCache` / `imagePersist` / `spriteAvailability` 一个都不走）：
 * 命中 LRU 或 IDB 密文就成了自欺 —— 工具要显示服务端**此刻**返回什么。顺带也避免往
 * 共享 LRU 里塞诊断用图挤掉在屏卡面、往可用性记录里写污染真实用户数据。
 *
 * 依赖全部由 `ProbeDeps` 注入，与 `spriteLoader.ts` 同一理由：`vitest.config.ts` 是
 * `environment: 'node'`，直接 import `@/services/http` / `@/infra/wasm` 会把 uni 与
 * WASM 拖进用例。
 */

/** 明文类型判定结果 */
export interface PlainSniff {
    kind: 'png' | 'jpeg' | 'gif' | 'webp' | 'bundle' | 'unknown';
    /**
     * 建 Blob 用的 MIME。**`null` 表示不该建 Blob URL** ——
     * 拿 image/png 去渲染一段 FlatBuffers 只会显示成裂图，
     * 把「这不是图片」误报成「这张图坏了」。
     */
    mime: string | null;
    /** FlatBuffers 的 4 字母 file_identifier，便于对照 encryption-pipeline 4.1；其余为 null */
    tag: string | null;
}

export interface ProbeMeta {
    cipherBytes: number;
    plainBytes: number;
    /** ZKDX 文件头第 5 字节的 FORMAT_VERSION（当前恒为 1，与 DEK 版本无关） */
    formatVersion: number;
    sniff: PlainSniff;
    /** 明文前若干字节的 hex，非图片时唯一能看的东西 */
    head: string;
    fetchMs: number;
    decryptMs: number;
}

export type ProbeOutcome =
    /** 全通。`bytes` 是明文；是否能渲染看 `meta.sniff.mime` */
    | { status: 'ok'; bytes: Uint8Array; meta: ProbeMeta }
    | { status: 'missing'; fetchMs: number }
    | { status: 'forbidden'; fetchMs: number }
    | { status: 'not-zukan'; cipherBytes: number; head: string; fetchMs: number }
    | { status: 'decrypt-failed'; message: string; cipherBytes: number; formatVersion: number; fetchMs: number }
    | { status: 'error'; message: string; httpStatus?: number };

export interface ProbeDeps {
    /** 取密文。CDN 签名 / base URL 拼接由实现方负责，本模块只给相对路径 */
    fetchCipher: (path: string) => Promise<Uint8Array>;
    /** 取 DEK hex。仅在确认拿到 ZKDX 密文后才调 —— 404 不该白等一次密钥 */
    getDek: () => Promise<string>;
    decrypt: (bytes: Uint8Array, dek: string) => Uint8Array;
    /** 校验 `ZKDX` 魔数。必须在 `versionOf` 之前调（见下） */
    isZukan: (bytes: Uint8Array) => boolean;
    versionOf: (bytes: Uint8Array) => number;
    /** 从 `fetchCipher` 抛出的错误里取 HTTP 状态码；网络层失败返回 undefined */
    httpStatusOf: (err: unknown) => number | undefined;
    /** 毫秒时钟，默认 `Date.now`。注入是为了让用例能断言耗时字段真被填过 */
    now?: () => number;
}

const FB_IDENTIFIERS = new Set(['PKMB', 'PMOV', 'PMSB', 'MDAT', 'EVO1', 'PKNM', 'PKFL']);

function ascii(bytes: Uint8Array, from: number, len: number): string {
    if (bytes.length < from + len) return '';
    let out = '';
    for (let i = from; i < from + len; i += 1) out += String.fromCharCode(bytes[i]!);
    return out;
}

function startsWith(bytes: Uint8Array, sig: readonly number[]): boolean {
    if (bytes.length < sig.length) return false;
    return sig.every((b, i) => bytes[i] === b);
}

/** 明文前 `max` 字节的 hex（空格分隔，小写），字节不够就给多少算多少 */
export function hexHead(bytes: Uint8Array, max = 32): string {
    const n = Math.min(max, bytes.length);
    const parts: string[] = [];
    for (let i = 0; i < n; i += 1) parts.push(bytes[i]!.toString(16).padStart(2, '0'));
    return parts.join(' ');
}

/**
 * 按魔数判断明文是什么。
 *
 * FlatBuffers 的坑：`file_identifier` 在**偏移 4**，不是 0 —— 文件开头 4 字节是指向
 * root table 的 uoffset（实测 `gen-1.bin` 为 `18 00 00 00 50 4b 4d42`）。按偏移 0 找
 * `PKMB` 会永远不匹配，于是所有 FB bundle 都被判成 unknown，看不出「你填的是数据
 * bundle 的路径，不是图片」。
 */
export function sniffPlain(bytes: Uint8Array): PlainSniff {
    if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
        return { kind: 'png', mime: 'image/png', tag: null };
    }
    if (startsWith(bytes, [0xff, 0xd8, 0xff])) {
        return { kind: 'jpeg', mime: 'image/jpeg', tag: null };
    }
    if (startsWith(bytes, [0x47, 0x49, 0x46, 0x38])) {
        return { kind: 'gif', mime: 'image/gif', tag: null };
    }
    if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && ascii(bytes, 8, 4) === 'WEBP') {
        return { kind: 'webp', mime: 'image/webp', tag: null };
    }

    const fid = ascii(bytes, 4, 4);
    if (FB_IDENTIFIERS.has(fid)) {
        // 数据 bundle，不是图片：mime 留 null，调用方据此改显示 hex 而不是渲染
        return { kind: 'bundle', mime: null, tag: fid };
    }

    return { kind: 'unknown', mime: null, tag: null };
}

function messageOf(err: unknown): string {
    if (err instanceof Error) return err.message;
    return String(err);
}

/**
 * 探测一个加密资源路径。
 *
 * 顺序上有两处刻意安排：
 * 1. **先取密文再取 DEK**。404 是最常见的结果（缺口表那些 id），先问密钥等于每次
 *    白等一个 `getKey` 往返；而且 `getKey` 可能弹登录层，为一个注定 404 的路径弹窗很蠢。
 * 2. **先 `isZukan` 再 `versionOf`**。后者直接读第 5 字节，喂它一段非 ZKDX 数据
 *    （比如后端返回的 HTML 错误页）读出来的「版本号」纯属噪音，还可能在 Rust 侧越界。
 */
export async function probeAsset(path: string, deps: ProbeDeps): Promise<ProbeOutcome> {
    const now = deps.now ?? Date.now;

    const t0 = now();
    let cipher: Uint8Array;
    try {
        cipher = await deps.fetchCipher(path);
    } catch (err) {
        const fetchMs = now() - t0;
        const httpStatus = deps.httpStatusOf(err);
        if (httpStatus === 404) return { status: 'missing', fetchMs };
        // 403 刻意不自动重签重试（应用层会）：签名过期本身就是要暴露的现象
        if (httpStatus === 403) return { status: 'forbidden', fetchMs };
        return { status: 'error', message: messageOf(err), httpStatus };
    }
    const fetchMs = now() - t0;

    if (!deps.isZukan(cipher)) {
        return { status: 'not-zukan', cipherBytes: cipher.length, head: hexHead(cipher), fetchMs };
    }
    const formatVersion = deps.versionOf(cipher);

    let dek: string;
    try {
        dek = await deps.getDek();
    } catch (err) {
        return { status: 'error', message: messageOf(err) };
    }

    const t1 = now();
    let plain: Uint8Array;
    try {
        plain = deps.decrypt(cipher, dek);
    } catch (err) {
        return {
            status: 'decrypt-failed',
            message: messageOf(err),
            cipherBytes: cipher.length,
            formatVersion,
            fetchMs,
        };
    }
    const decryptMs = now() - t1;

    return {
        status: 'ok',
        bytes: plain,
        meta: {
            cipherBytes: cipher.length,
            plainBytes: plain.length,
            formatVersion,
            sniff: sniffPlain(plain),
            head: hexHead(plain),
            fetchMs,
            decryptMs,
        },
    };
}
