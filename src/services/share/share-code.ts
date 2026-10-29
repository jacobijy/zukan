/**
 * 队伍 / 模板「分享码」编解码（格式权威定义见 `docs/data/share-codes.md`）。
 *
 * 外观就是一串不可读的 base64url（无 padding）；识别头（magic / 版本 / kind）
 * 与 JSON 信封一起编在 base64 内部，不暴露任何明文标记：
 *
 *   byte0..1  magic = 0x5A 0x4B（'ZK'）
 *   byte2     高 4 位版本（=1），低 4 位 kind（0=team, 1=template）
 *   byte3..   UTF-8 JSON 信封 { "name": string, "payload": object }
 *
 * 设计要点：
 * - 零平台依赖（不 import Vue / uni / btoa / TextEncoder —— 小程序不可用，
 *   与 team-model / template-model 手写 UTF-8 字节计数的约定一致），可直接 node 单测。
 * - 解码容忍输入前后的噪音（聊天里整段粘贴）：扫描其中的 base64url 长 token，
 *   逐个试解，首个 magic 命中的即为分享码（magic 双字节冲突概率 1/65536）。
 * - 本模块只校验识别头与信封外壳；payload 内部合法性由调用方接各自的
 *   normalizePayload 落地，前向兼容 / 异常数据安全由既有归一逻辑负责。
 */

// ── 常量 ───────────────────────────────────────────────
const MAGIC0 = 0x5a; // 'Z'
const MAGIC1 = 0x4b; // 'K'
const FORMAT_VERSION = 1;
const KIND_TEAM = 0;
const KIND_TEMPLATE = 1;
/** 分享 payload 上限与 teams/templates 服务端契约（32 KiB）同口径。 */
export const SHARE_PAYLOAD_MAX_BYTES = 32768;
/** 候选 token 最小长度：真码最短 70+ 字符，16 足以避开普通单词。 */
const MIN_TOKEN_LEN = 16;
const TOKEN_RE = new RegExp(`[A-Za-z0-9_-]{${MIN_TOKEN_LEN},}`, 'g');

export type ShareKind = 'team' | 'template';

const KIND_BITS = {
    team: KIND_TEAM,
    template: KIND_TEMPLATE,
} as const satisfies Record<ShareKind, number>;

// ── 错误 ───────────────────────────────────────────────
export type ShareCodeErrorReason =
    | 'no-code' // 输入中找不到分享码
    | 'bad-version' // 版本不被当前客户端支持（如版本 2）
    | 'bad-encoding' // base64 / 识别头 / UTF-8 / JSON 层损坏
    | 'bad-envelope' // 信封结构不合法（非对象 / payload 非对象）
    | 'payload-too-large'; // 编码时 payload 超 32 KiB

export class ShareCodeError extends Error {
    constructor(readonly reason: ShareCodeErrorReason) {
        super(`share code error: ${reason}`);
        this.name = 'ShareCodeError';
    }
}

// ── UTF-8（手写，不依赖 TextEncoder） ───────────────────
function encodeUtf8(s: string): Uint8Array {
    const bytes: number[] = [];
    for (const ch of s) {
        const cp = ch.codePointAt(0)!;
        if (cp < 0x80) {
            bytes.push(cp);
        } else if (cp < 0x800) {
            bytes.push(0xc0 | (cp >> 6), 0x80 | (cp & 0x3f));
        } else if (cp < 0x10000) {
            bytes.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
        } else {
            bytes.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 0x3f), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
        }
    }
    return Uint8Array.from(bytes);
}

const REPLACEMENT = '�';

/** UTF-8 解码；非法字节 / 截断序列 / 代理区码点一律回落 U+FFFD，不抛错。 */
function decodeUtf8(bytes: Uint8Array): string {
    let out = '';
    let cp = 0;
    let remaining = 0;
    for (let i = 0; i < bytes.length; i++) {
        const b = bytes[i];
        if (remaining === 0) {
            if (b < 0x80) {
                out += String.fromCodePoint(b);
            } else if ((b & 0xe0) === 0xc0) {
                cp = b & 0x1f;
                remaining = 1;
            } else if ((b & 0xf0) === 0xe0) {
                cp = b & 0x0f;
                remaining = 2;
            } else if ((b & 0xf8) === 0xf0) {
                cp = b & 0x07;
                remaining = 3;
            } else {
                out += REPLACEMENT;
            }
            continue;
        }
        if ((b & 0xc0) !== 0x80) {
            // 缺续字节：当前序列作废，该字节按新的 lead 重新处理
            out += REPLACEMENT;
            cp = 0;
            remaining = 0;
            i--;
            continue;
        }
        cp = (cp << 6) | (b & 0x3f);
        remaining--;
        if (remaining === 0) {
            out += cp > 0x10ffff || (cp >= 0xd800 && cp <= 0xdfff) ? REPLACEMENT : String.fromCodePoint(cp);
            cp = 0;
        }
    }
    if (remaining > 0) out += REPLACEMENT;
    return out;
}

function utf8ByteLength(s: string): number {
    return encodeUtf8(s).length;
}

// ── base64url（无 padding，手写正反查表） ────────────────
const B64URL_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

function buildRevTable(): Int8Array {
    const table = new Int8Array(128).fill(-1);
    for (let i = 0; i < B64URL_ALPHABET.length; i++) {
        table[B64URL_ALPHABET.charCodeAt(i)] = i;
    }
    return table;
}

const B64URL_REV = buildRevTable();

function base64UrlEncode(bytes: Uint8Array): string {
    let out = '';
    for (let i = 0; i < bytes.length; i += 3) {
        const remaining = Math.min(3, bytes.length - i);
        // 拼进 24bit 缓冲；不足 3 字节时左补 0 到 24bit 边界，再取前 remaining+1 个 6bit 组
        let buffer = 0;
        for (let j = 0; j < remaining; j++) {
            buffer = (buffer << 8) | bytes[i + j];
        }
        buffer <<= (3 - remaining) * 8;
        const groups = remaining + 1; // 1 字节→2 组, 2 字节→3 组, 3 字节→4 组
        for (let g = 0; g < groups; g++) {
            out += B64URL_ALPHABET[(buffer >> (18 - g * 6)) & 0x3f];
        }
    }
    return out;
}

/** base64url 解码；长度 %4===1、非法字符、尾部位非 0 均抛 bad-encoding。 */
function base64UrlDecode(s: string): Uint8Array {
    if (s.length === 0 || s.length % 4 === 1) throw new ShareCodeError('bad-encoding');
    const out: number[] = [];
    let buffer = 0;
    let bits = 0;
    for (let i = 0; i < s.length; i++) {
        const code = s.charCodeAt(i);
        const v = code < 128 ? B64URL_REV[code] : -1;
        if (v < 0) throw new ShareCodeError('bad-encoding');
        buffer = (buffer << 6) | v;
        bits += 6;
        if (bits >= 8) {
            bits -= 8;
            out.push((buffer >> bits) & 0xff);
            buffer &= (1 << bits) - 1;
        }
    }
    // tail 残余位必须是 0（canonical base64）；非 0 说明编码损坏
    if (bits > 0 && buffer !== 0) throw new ShareCodeError('bad-encoding');
    return Uint8Array.from(out);
}

// ── 编码 ───────────────────────────────────────────────
/**
 * 把一条队伍 / 模板编码成分享码（纯 base64url，识别信息在内部二进制头）。
 * @param name 原始名称（非字符串按空串处理）
 * @param payload 完整 TeamPayload / TemplatePayload 对象
 * @throws ShareCodeError('payload-too-large') payload JSON 超过 32 KiB
 */
export function encodeShareCode(kind: ShareKind, name: string, payload: object): string {
    const payloadJson = JSON.stringify(payload);
    if (utf8ByteLength(payloadJson) > SHARE_PAYLOAD_MAX_BYTES) {
        throw new ShareCodeError('payload-too-large');
    }
    const envelope = JSON.stringify({ name: typeof name === 'string' ? name : '', payload });
    const body = encodeUtf8(envelope);
    const bytes = new Uint8Array(3 + body.length);
    bytes[0] = MAGIC0;
    bytes[1] = MAGIC1;
    bytes[2] = (FORMAT_VERSION << 4) | KIND_BITS[kind];
    bytes.set(body, 3);
    return base64UrlEncode(bytes);
}

// ── 解码 ───────────────────────────────────────────────
export interface DecodedShare {
    kind: ShareKind;
    /** 原始名称（可能为空串；trim / 回落默认名由调用方决定）。 */
    name: string;
    /** 信封内 payload（unknown；由调用方接 normalizePayload 落地）。 */
    payload: unknown;
}

/** 解析一个已确认是 base64url 的候选 token；magic 不匹配返回 null（不是分享码）。 */
function decodeToken(token: string): DecodedShare | null {
    let bytes: Uint8Array;
    try {
        bytes = base64UrlDecode(token);
    } catch {
        return null; // 连合法 base64 都不是，交给下一个候选
    }
    if (bytes.length < 4 || bytes[0] !== MAGIC0 || bytes[1] !== MAGIC1) return null;

    // magic 命中：从此刻起它就是分享码，后续损坏直接报对应错误
    const version = bytes[2] >> 4;
    const kindBit = bytes[2] & 0x0f;
    if (version === 0 || version > FORMAT_VERSION) throw new ShareCodeError('bad-version');
    let kind: ShareKind;
    if (kindBit === KIND_TEAM) kind = 'team';
    else if (kindBit === KIND_TEMPLATE) kind = 'template';
    else throw new ShareCodeError('bad-encoding');

    let parsed: unknown;
    try {
        parsed = JSON.parse(decodeUtf8(bytes.slice(3)));
    } catch {
        throw new ShareCodeError('bad-encoding');
    }

    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        throw new ShareCodeError('bad-envelope');
    }
    const envelope = parsed as Record<string, unknown>;
    if (typeof envelope.payload !== 'object' || envelope.payload === null || Array.isArray(envelope.payload)) {
        throw new ShareCodeError('bad-envelope');
    }

    return {
        kind,
        name: typeof envelope.name === 'string' ? envelope.name : '',
        payload: envelope.payload,
    };
}

/**
 * 从任意文本中扫描并解析分享码（容忍前后噪音）：取所有 base64url 长 token，
 * 按出现顺序试解，首个 magic 命中者决定结果。
 * @throws ShareCodeError，reason 区分 no-code / bad-version / bad-encoding / bad-envelope
 */
export function decodeShareCode(input: string): DecodedShare {
    if (typeof input !== 'string') throw new ShareCodeError('no-code');
    const tokens = input.match(TOKEN_RE);
    if (!tokens) throw new ShareCodeError('no-code');
    for (const token of tokens) {
        const decoded = decodeToken(token);
        if (decoded !== null) return decoded;
    }
    throw new ShareCodeError('no-code');
}
