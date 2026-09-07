/**
 * `services/devtools/assetProbe.ts` —— 探测编排与明文嗅探。
 *
 * 这个模块的价值全在「分得清」：应用层刻意把 404 藏进回落链、把 preview 的 404 静默
 * 掉，工具反过来必须把 404 / 403 / 非 ZKDX / 解密失败四种情况分别报出来。所以用例的
 * 重点不是「能跑通」，而是**每种失败都不会被归到别的桶里**。
 */
import { describe, it, expect, vi } from 'vitest';
import { probeAsset, sniffPlain, hexHead, type ProbeDeps } from '../src/services/devtools/assetProbe';

// ── 夹具 ─────────────────────────────────────────────────

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
const CIPHER = new Uint8Array([0x5a, 0x4b, 0x44, 0x58, 1, 9, 9, 9]);

/** ZKDX 密文头 + FlatBuffers 明文（root uoffset 在前，fid 在偏移 4） */
function fbBytes(tag: string): Uint8Array {
    const out = new Uint8Array(12);
    out.set([0x18, 0, 0, 0], 0);
    for (let i = 0; i < 4; i += 1) out[4 + i] = tag.charCodeAt(i);
    return out;
}

class FakeHttpError extends Error {
    statusCode?: number;
    constructor(status?: number) {
        super(status ? `status ${status}` : 'network down');
        this.statusCode = status;
    }
}

interface StubOptions {
    /** 抛出的 HTTP 错误；不传则返回 `cipher` */
    fail?: FakeHttpError;
    cipher?: Uint8Array;
    plain?: Uint8Array;
    isZukan?: boolean;
    version?: number;
    decryptThrows?: string;
    dekThrows?: string;
}

function makeDeps(opts: StubOptions = {}): ProbeDeps & { calls: { fetch: number; dek: number; decrypt: number } } {
    const calls = { fetch: 0, dek: 0, decrypt: 0 };
    let clock = 100;
    return {
        calls,
        fetchCipher: async () => {
            calls.fetch += 1;
            if (opts.fail) throw opts.fail;
            return opts.cipher ?? CIPHER;
        },
        getDek: async () => {
            calls.dek += 1;
            if (opts.dekThrows) throw new Error(opts.dekThrows);
            return 'deadbeef';
        },
        decrypt: () => {
            calls.decrypt += 1;
            if (opts.decryptThrows) throw new Error(opts.decryptThrows);
            return opts.plain ?? PNG;
        },
        isZukan: () => opts.isZukan ?? true,
        versionOf: () => opts.version ?? 1,
        httpStatusOf: (err) => (err instanceof FakeHttpError ? err.statusCode : undefined),
        // 每次调用 +7ms，于是耗时字段一定是可断言的确定值
        now: () => {
            clock += 7;
            return clock;
        },
    };
}

// ── 明文嗅探 ─────────────────────────────────────────────

describe('sniffPlain', () => {
    it('认出 PNG 并给出可渲染的 mime', () => {
        expect(sniffPlain(PNG)).toEqual({ kind: 'png', mime: 'image/png', tag: null });
    });

    it('认出 JPEG / GIF / WebP', () => {
        expect(sniffPlain(new Uint8Array([0xff, 0xd8, 0xff, 0xe0])).kind).toBe('jpeg');
        expect(sniffPlain(new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61])).kind).toBe('gif');
        const webp = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
        expect(sniffPlain(webp)).toEqual({ kind: 'webp', mime: 'image/webp', tag: null });
    });

    it('RIFF 但不是 WEBP 不算图片（避免把 wav 之类当图渲染）', () => {
        const riff = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41, 0x56, 0x45]);
        expect(sniffPlain(riff).kind).toBe('unknown');
    });

    it.each(['PKMB', 'PMOV', 'PMSB', 'MDAT', 'EVO1', 'PKNM', 'PKFL'])(
        'FlatBuffers %s 认到偏移 4，且 mime 为 null（不许建 Blob）',
        (tag) => {
            const sniff = sniffPlain(fbBytes(tag));
            expect(sniff.kind).toBe('bundle');
            expect(sniff.tag).toBe(tag);
            expect(sniff.mime).toBeNull();
        },
    );

    it('魔数写在偏移 0 的不算 bundle —— FlatBuffers 的 fid 本来就在偏移 4', () => {
        const wrong = new Uint8Array([0x50, 0x4b, 0x4d, 0x42, 0, 0, 0, 0]);
        expect(sniffPlain(wrong).kind).toBe('unknown');
    });

    it('太短的字节不会越界，判为 unknown', () => {
        expect(sniffPlain(new Uint8Array([0x89, 0x50])).kind).toBe('unknown');
        expect(sniffPlain(new Uint8Array()).kind).toBe('unknown');
    });
});

describe('hexHead', () => {
    it('小写补零、空格分隔、按 max 截断', () => {
        expect(hexHead(new Uint8Array([0x00, 0x0f, 0xff, 0xab]), 3)).toBe('00 0f ff');
    });

    it('字节不足 max 时给多少算多少', () => {
        expect(hexHead(new Uint8Array([0x01]), 8)).toBe('01');
        expect(hexHead(new Uint8Array(), 8)).toBe('');
    });
});

// ── 探测编排 ─────────────────────────────────────────────

describe('probeAsset', () => {
    it('全链路通：返回明文与完整元信息', async () => {
        const deps = makeDeps({ cipher: new Uint8Array(64), plain: PNG, version: 1 });
        const out = await probeAsset('/assets/encrypted/pokemon/25/home.bin', deps);

        expect(out.status).toBe('ok');
        if (out.status !== 'ok') return;
        expect(out.bytes).toBe(PNG);
        expect(out.meta.cipherBytes).toBe(64);
        expect(out.meta.plainBytes).toBe(PNG.length);
        expect(out.meta.formatVersion).toBe(1);
        expect(out.meta.sniff.mime).toBe('image/png');
        expect(out.meta.head.startsWith('89 50 4e 47')).toBe(true);
        // 耗时字段必须真被填过：now() 每次 +7，一段测量跨两次调用
        expect(out.meta.fetchMs).toBeGreaterThan(0);
        expect(out.meta.decryptMs).toBeGreaterThan(0);
    });

    it('404 → missing，且不去取 DEK（省一次密钥往返 / 不为注定失败的路径弹登录层）', async () => {
        const deps = makeDeps({ fail: new FakeHttpError(404) });
        const out = await probeAsset('/x.bin', deps);

        expect(out.status).toBe('missing');
        expect(deps.calls.dek).toBe(0);
        expect(deps.calls.decrypt).toBe(0);
    });

    it('403 → forbidden，不归入 missing，也不自动重签重试', async () => {
        const deps = makeDeps({ fail: new FakeHttpError(403) });
        const out = await probeAsset('/x.bin', deps);

        expect(out.status).toBe('forbidden');
        expect(deps.calls.fetch).toBe(1);
    });

    it('其它状态码 → error，并带上状态码', async () => {
        const out = await probeAsset('/x.bin', makeDeps({ fail: new FakeHttpError(500) }));
        expect(out.status).toBe('error');
        if (out.status !== 'error') return;
        expect(out.httpStatus).toBe(500);
    });

    it('网络失败（无状态码）→ error 且 httpStatus 为 undefined', async () => {
        const out = await probeAsset('/x.bin', makeDeps({ fail: new FakeHttpError() }));
        expect(out.status).toBe('error');
        if (out.status !== 'error') return;
        expect(out.httpStatus).toBeUndefined();
        expect(out.message).toContain('network down');
    });

    it('200 但不是 ZKDX → not-zukan，给 hex 头，且不读版本号也不解密', async () => {
        const html = new Uint8Array([0x3c, 0x21, 0x64, 0x6f, 0x63]);
        const deps = makeDeps({ isZukan: false, cipher: html });
        const versionSpy = vi.spyOn(deps, 'versionOf');
        const out = await probeAsset('/x.bin', deps);

        expect(out.status).toBe('not-zukan');
        if (out.status !== 'not-zukan') return;
        expect(out.head).toBe('3c 21 64 6f 63');
        expect(out.cipherBytes).toBe(5);
        // versionOf 读的是第 5 字节；喂它非 ZKDX 数据读出来的"版本"是噪音
        expect(versionSpy).not.toHaveBeenCalled();
        expect(deps.calls.decrypt).toBe(0);
    });

    it('头对但解不开 → decrypt-failed，保留 FORMAT_VERSION 供对照 DEK 版本', async () => {
        const deps = makeDeps({ decryptThrows: 'aead::Error', version: 1, cipher: new Uint8Array(32) });
        const out = await probeAsset('/x.bin', deps);

        expect(out.status).toBe('decrypt-failed');
        if (out.status !== 'decrypt-failed') return;
        expect(out.message).toBe('aead::Error');
        expect(out.formatVersion).toBe(1);
        expect(out.cipherBytes).toBe(32);
    });

    it('取 DEK 失败（如用户关掉登录层）→ error，不误报成解密失败', async () => {
        const deps = makeDeps({ dekThrows: 'LoginDismissed' });
        const out = await probeAsset('/x.bin', deps);

        expect(out.status).toBe('error');
        if (out.status !== 'error') return;
        expect(out.message).toBe('LoginDismissed');
        expect(deps.calls.decrypt).toBe(0);
    });

    it('明文是 FB bundle：status 仍是 ok（链路确实通），但 mime 为 null 且 head 可读', async () => {
        const deps = makeDeps({ plain: fbBytes('PKMB') });
        const out = await probeAsset('/assets/encrypted/fb/gen-9.bin', deps);

        expect(out.status).toBe('ok');
        if (out.status !== 'ok') return;
        // 不能建 Blob —— 拿 image/png 渲染 FB 二进制会显示裂图，
        // 把「这不是图片」误报成「这张图坏了」
        expect(out.meta.sniff.mime).toBeNull();
        expect(out.meta.sniff.tag).toBe('PKMB');
        expect(out.meta.head).toContain('50 4b 4d 42');
    });

    it('先取密文再取 DEK —— 顺序不能反', async () => {
        const order: string[] = [];
        const deps = makeDeps();
        const orig = deps.fetchCipher;
        deps.fetchCipher = async (p) => {
            order.push('fetch');
            return orig(p);
        };
        const origDek = deps.getDek;
        deps.getDek = async () => {
            order.push('dek');
            return origDek();
        };

        await probeAsset('/x.bin', deps);
        expect(order).toEqual(['fetch', 'dek']);
    });
});
