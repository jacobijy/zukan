/**
 * 按字节内容判定图片格式与 MIME。
 *
 * ## 为什么不能只靠「这个种类固定是 PNG」
 *
 * `ImageKindSpec.mime` 原本是每种类一个常量（pokemon / item 都写死 `image/png`）。
 * 这对栅格图无害 —— 浏览器在 `<img>` 里会**内容嗅探**，PNG 字节标成 image/jpeg 照样
 * 显示。但 **SVG 是例外：MIME 不是 `image/svg+xml` 就一律不渲染**，因为浏览器不允许
 * 靠嗅探进入 SVG 这条会解析外部实体的路径。
 *
 * 而立绘里 `dream`（Dream World 立绘）**全部是 SVG**（实测 1012 个数字 id，png 零个），
 * 于是它经共享引擎解出来后被塞进 `type: 'image/png'` 的 Blob，永远显示成裂图。
 * 明文类型是**资源自身的属性**，不是种类的属性，所以改成按字节判定，
 * `spec.mime` 退化为判不出时的兜底。
 *
 * 判定放在解密之后、建 Blob 之前，代价是几次字节比较，可忽略。
 */

export type ImageFormat = 'png' | 'jpeg' | 'gif' | 'webp' | 'svg';

export interface ImageFormatInfo {
    format: ImageFormat;
    mime: string;
}

/** SVG 是文本格式，没有魔数，只能在头部一段里找 `<svg` */
const SVG_SCAN_LIMIT = 1024;

function startsWith(bytes: Uint8Array, sig: readonly number[]): boolean {
    if (bytes.length < sig.length) return false;
    return sig.every((b, i) => bytes[i] === b);
}

function asciiLower(bytes: Uint8Array, from: number, len: number): string {
    let out = '';
    const end = Math.min(from + len, bytes.length);
    for (let i = from; i < end; i += 1) out += String.fromCharCode(bytes[i]!);
    return out.toLowerCase();
}

function isSpace(b: number): boolean {
    return b === 0x20 || b === 0x09 || b === 0x0a || b === 0x0d;
}

/**
 * SVG 判定。文本格式，必须比魔数那几行谨慎，两道关：
 *
 * 1. 跳过 UTF-8 BOM 与前导空白（上游产物实测是 `<?xml version='1.0' …?>\n<svg …`，
 *    但别的工具链会加 BOM 或缩进）；
 * 2. **开头只接受 `<svg` / `<?xml` / `<!--` / `<!doctype svg` 四种，且正文含 `<svg`。**
 *    这一条同时挡掉两类误判：正文恰好出现 `<svg` 字样的普通文本（开头不是 `<`），
 *    以及后端 HTML 错误页（`<html>…<svg>…</html>` 开头是 `<html`）。把错误页当图
 *    渲染会掩盖真故障，比不渲染更糟。
 *
 * 曾经在这两关之间还有一句「第一个非空白字符必须是 `<`」—— 变异测试证明它是死代码：
 * 第 2 关的四个前缀本身就都以 `<` 开头，没有任何输入能区分有没有它。已删。
 */
function looksLikeSvg(bytes: Uint8Array): boolean {
    let i = 0;
    if (startsWith(bytes, [0xef, 0xbb, 0xbf])) i = 3;
    while (i < bytes.length && isSpace(bytes[i]!)) i += 1;

    const head = asciiLower(bytes, i, SVG_SCAN_LIMIT);
    const opens =
        head.startsWith('<svg') ||
        head.startsWith('<?xml') ||
        head.startsWith('<!--') ||
        head.startsWith('<!doctype svg');
    if (!opens) return false;

    return head.includes('<svg');
}

/** 判不出返回 `null`（可能是 FlatBuffers bundle 或别的非图片数据） */
export function sniffImageFormat(bytes: Uint8Array): ImageFormatInfo | null {
    if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
        return { format: 'png', mime: 'image/png' };
    }
    if (startsWith(bytes, [0xff, 0xd8, 0xff])) {
        return { format: 'jpeg', mime: 'image/jpeg' };
    }
    if (startsWith(bytes, [0x47, 0x49, 0x46, 0x38])) {
        return { format: 'gif', mime: 'image/gif' };
    }
    // RIFF 容器还装 wav 等，必须连 offset 8 的 'WEBP' 一起验
    if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && asciiLower(bytes, 8, 4) === 'webp') {
        return { format: 'webp', mime: 'image/webp' };
    }
    if (looksLikeSvg(bytes)) {
        return { format: 'svg', mime: 'image/svg+xml' };
    }
    return null;
}

/** 只要 MIME 的便捷包装 */
export function sniffImageMime(bytes: Uint8Array): string | null {
    return sniffImageFormat(bytes)?.mime ?? null;
}
