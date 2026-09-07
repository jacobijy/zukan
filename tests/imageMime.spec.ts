/**
 * `services/resources/imageMime.ts` —— 按字节判定图片格式。
 *
 * 存在的理由是一个真 bug：`dream` variant 全是 SVG，而引擎原先给所有图打固定的
 * `image/png`。栅格格式浏览器会内容嗅探，标错也能显示；**SVG 不会** —— MIME 不是
 * `image/svg+xml` 就一律不渲染。所以用例的重点是：
 *
 * 1. SVG 一定要认出来（含 BOM / 前导空白 / `<?xml` 声明这些真实产物形态）；
 * 2. 不能把 HTML 之类的文本误判成 SVG（否则错误页会被当图渲染，掩盖真故障）；
 * 3. 判不出必须返回 null，不能瞎给一个 MIME。
 */
import { describe, it, expect } from 'vitest';
import { sniffImageFormat, sniffImageMime } from '../src/services/resources/imageMime';

function bytes(text: string): Uint8Array {
    const out = new Uint8Array(text.length);
    for (let i = 0; i < text.length; i += 1) out[i] = text.charCodeAt(i);
    return out;
}

/** zukan-server 上 dream.svg 的真实开头 */
const REAL_DREAM_SVG = bytes(
    `<?xml version='1.0' encoding='utf-8'?>\n<svg xmlns="http://www.w3.org/2000/svg" version="1.1" width="135px" height="169px"></svg>`,
);

describe('sniffImageFormat：栅格格式', () => {
    it('PNG 认全 8 字节签名', () => {
        const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
        expect(sniffImageFormat(png)).toEqual({ format: 'png', mime: 'image/png' });
    });

    it('JPEG / GIF', () => {
        expect(sniffImageMime(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg');
        expect(sniffImageMime(new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]))).toBe('image/gif');
    });

    it('WebP 必须连 offset 8 的 WEBP 一起验 —— RIFF 容器还装 wav', () => {
        const webp = new Uint8Array([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50]);
        expect(sniffImageMime(webp)).toBe('image/webp');
        const wav = new Uint8Array([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x41, 0x56, 0x45]);
        expect(sniffImageMime(wav)).toBeNull();
    });
});

describe('sniffImageFormat：SVG', () => {
    it('认出 zukan-server 上 dream.svg 的真实开头（`<?xml …?>` 换行后才是 `<svg`）', () => {
        expect(sniffImageFormat(REAL_DREAM_SVG)).toEqual({ format: 'svg', mime: 'image/svg+xml' });
    });

    it('直接以 <svg 开头也认', () => {
        expect(sniffImageMime(bytes('<svg viewBox="0 0 1 1"></svg>'))).toBe('image/svg+xml');
    });

    it('跳过 UTF-8 BOM', () => {
        const withBom = new Uint8Array([0xef, 0xbb, 0xbf, ...bytes('<svg></svg>')]);
        expect(sniffImageMime(withBom)).toBe('image/svg+xml');
    });

    it('跳过前导空白与换行', () => {
        expect(sniffImageMime(bytes('\n\r\t  <svg></svg>'))).toBe('image/svg+xml');
    });

    it('大小写不敏感（<SVG> 同样是合法 XML 标签写法）', () => {
        expect(sniffImageMime(bytes('<?XML version="1.0"?><SVG></SVG>'))).toBe('image/svg+xml');
    });

    it('注释或 DOCTYPE 打头也认', () => {
        expect(sniffImageMime(bytes('<!-- generated --><svg></svg>'))).toBe('image/svg+xml');
        expect(sniffImageMime(bytes('<!DOCTYPE svg PUBLIC ""><svg></svg>'))).toBe('image/svg+xml');
    });

    it('HTML 错误页不算 SVG —— 哪怕正文里含 <svg>', () => {
        // 这是关键防线：把后端错误页当图渲染会掩盖真故障
        expect(sniffImageMime(bytes('<html><body><svg></svg></body></html>'))).toBeNull();
        expect(sniffImageMime(bytes('<!DOCTYPE html><html><svg/></html>'))).toBeNull();
    });

    it('正文恰好出现 <svg 的普通文本不算（开头必须是那四种前缀之一）', () => {
        expect(sniffImageMime(bytes('random text with <svg> inside'))).toBeNull();
    });

    it('只有 XML 声明、没有 <svg> 标签不算（可能是别的 XML）', () => {
        expect(sniffImageMime(bytes("<?xml version='1.0'?><rss></rss>"))).toBeNull();
    });

    it('<svg 出现在扫描窗口之外不算 —— 避免把整份大文本都扫一遍', () => {
        const padded = bytes(`<?xml version='1.0'?>${' '.repeat(1200)}<svg></svg>`);
        expect(sniffImageMime(padded)).toBeNull();
    });
});

describe('sniffImageFormat：判不出', () => {
    it('FlatBuffers bundle 返回 null（不是图片，不该被塞进 Blob 渲染）', () => {
        const fb = new Uint8Array([0x18, 0, 0, 0, 0x50, 0x4b, 0x4d, 0x42, 0, 0]);
        expect(sniffImageFormat(fb)).toBeNull();
    });

    it('空字节 / 极短字节不越界', () => {
        expect(sniffImageFormat(new Uint8Array())).toBeNull();
        expect(sniffImageFormat(new Uint8Array([0x89]))).toBeNull();
        expect(sniffImageFormat(new Uint8Array([0x3c]))).toBeNull();
    });
});
