/**
 * 跨平台图片对象 URL
 *
 * H5 用标准 Blob URL（URL.createObjectURL / revokeObjectURL）。
 * 微信小程序没有 Blob URL（`URL` 整个为 undefined，直接调 createObjectURL 即
 * TypeError），改为把解密后的字节写入用户目录的本地文件、返回文件路径供 <image>
 * 使用；release 时删除该文件。
 *
 * 调用方（imageCache）的引用计数 / LRU / 限流不变，只是「对象 URL」这个原语平台相关。
 * 用运行时检测而非 #ifdef，避免 vue-tsc 直接检查时看到重复声明。
 */

const supportsBlobUrl =
    typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function';

const MIME_EXT: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/svg+xml': 'svg',
};

function safeName(s: string): string {
    return s.replace(/[^a-zA-Z0-9_-]+/g, '_');
}

export async function createImageObjectUrl(
    scope: string,
    key: number | string,
    bytes: Uint8Array,
    mime: string,
): Promise<string> {
    if (supportsBlobUrl) {
        return URL.createObjectURL(new Blob([bytes], { type: mime }));
    }

    // ── 微信小程序：写本地文件 ──────────────────────────────
    const userPath = (uni as any).env?.USER_DATA_PATH as string | undefined;
    if (!userPath) throw new Error('当前平台无 USER_DATA_PATH，无法落地解密图片');

    const dir = `${userPath}/zukan-img/${safeName(scope)}`;
    const ext = MIME_EXT[mime] ?? 'img';
    const filePath = `${dir}/${safeName(String(key))}.${ext}`;
    const fs = uni.getFileSystemManager();

    // mkdir 已存在时 fail，按成功处理（recursive 在部分基础库不生效）
    await new Promise<void>((resolve) => {
        fs.mkdir({ dirPath: dir, recursive: true, success: () => resolve(), fail: () => resolve() });
    });

    // writeFile 只收 ArrayBuffer/string；TypedArray 需取精确的底层 buffer
    const ab: ArrayBuffer =
        bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength
            ? bytes.buffer
            : bytes.slice().buffer;

    await new Promise<void>((resolve, reject) => {
        fs.writeFile({
            filePath,
            data: ab,
            success: () => resolve(),
            fail: (e) => reject(new Error(e.errMsg)),
        });
    });

    return filePath;
}

export function releaseImageObjectUrl(url: string): void {
    if (supportsBlobUrl) {
        URL.revokeObjectURL(url);
        return;
    }
    // 微信：删除落地文件（可能已被清理，fail 静默）
    try {
        uni.getFileSystemManager().unlink({ filePath: url, fail: () => {} });
    } catch {
        /* 路径已失效，忽略 */
    }
}
