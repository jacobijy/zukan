/**
 * 本地头像：选图 → 持久化 → storage 存取。
 *
 * 服务端没有 profile / 头像接口，头像只存本机（换设备不同步）：
 * - 小程序 / App：把 `uni.chooseImage` 的临时文件写入 `USER_DATA_PATH`，storage 只记文件路径；
 * - H5：临时文件是 blob URL，转 data URL（大图先缩到 ≤512px），storage 存 data URL。
 *
 * 替换 / 清除头像时顺带删除旧的本机文件；storage 写入失败时不动旧文件。
 */

const STORAGE_KEY = 'zukan_avatar';
const FILE_NAME = 'zukan-avatar';
/** H5 缩图上限（最长边），控制 storage 占用。 */
const MAX_EDGE = 512;
/** 小程序 / App 落盘上限；chooseImage 已用 compressed，正常远小于此值。 */
const MAX_FILE_BYTES = 2 * 1024 * 1024;
/** data URL 超过此长度才解码缩图（小图直接存，避免无谓重编码）。 */
const MAX_DATA_URL_CHARS = 400 * 1024;

export type AvatarErrorReason = 'too-large' | 'pick-failed' | 'read-failed' | 'store-failed';

export class AvatarError extends Error {
    reason: AvatarErrorReason;

    constructor(reason: AvatarErrorReason) {
        super(reason);
        this.name = 'AvatarError';
        this.reason = reason;
    }
}

interface AvatarFS {
    readFileSync: (path: string) => ArrayBuffer | string;
    writeFileSync: (path: string, data: ArrayBuffer | string) => void;
    unlinkSync: (path: string) => void;
}

/** FileSystemManager 的取值方式与 `infra/storage/binaryStorage.ts` 一致：小程序只有 wx。 */
function getFS(): AvatarFS | null {
    const g = (typeof wx !== 'undefined' ? wx : typeof uni !== 'undefined' ? uni : null) as unknown as {
        getFileSystemManager?: () => AvatarFS;
    } | null;
    return g?.getFileSystemManager?.() ?? null;
}

/** USER_DATA_PATH 同样分 uni / wx 两个暴露点；H5 没有该路径（走 data URL）。 */
function userDataPath(): string | null {
    if (typeof uni !== 'undefined') {
        const uniPath = (uni as unknown as { env?: { USER_DATA_PATH?: string } }).env?.USER_DATA_PATH;
        if (uniPath) return uniPath;
    }
    if (typeof wx !== 'undefined') {
        const wxPath = (wx as unknown as { env?: { USER_DATA_PATH?: string } }).env?.USER_DATA_PATH;
        if (wxPath) return wxPath;
    }
    return null;
}

function extensionOf(path: string): string {
    const ext = /\.([a-zA-Z0-9]+)(?:[?#].*)?$/.exec(path)?.[1]?.toLowerCase() ?? '';
    return ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext) ? ext : 'jpg';
}

function removeAvatarFile(src: string): void {
    const userPath = userDataPath();
    if (!userPath || !src.startsWith(userPath)) return;
    try {
        getFS()?.unlinkSync(src);
    } catch {
        /* 文件已被系统清理，忽略 */
    }
}

/** 读取已保存的头像（本地文件路径或 data URL）；没有则空字符串。 */
export function getAvatar(): string {
    try {
        const raw = uni.getStorageSync(STORAGE_KEY) as unknown;
        return typeof raw === 'string' ? raw : '';
    } catch {
        return '';
    }
}

/** 写入 / 清除头像；成功后删除上一张的本机文件。返回是否写入成功。 */
export function setAvatar(src: string | null): boolean {
    const prev = getAvatar();
    try {
        if (src) uni.setStorageSync(STORAGE_KEY, src);
        else uni.removeStorageSync(STORAGE_KEY);
    } catch (err) {
        // 配额 / 沙箱错误：保留 storage 原值，避免把旧文件删了却记住新值
        console.warn('[avatar] 写入头像失败', err);
        return false;
    }
    if (prev && prev !== src) removeAvatarFile(prev);
    return true;
}

export function clearAvatar(): void {
    setAvatar(null);
}

function chooseImagePath(): Promise<string | null> {
    return new Promise((resolve, reject) => {
        uni.chooseImage({
            count: 1,
            sizeType: ['compressed'],
            sourceType: ['album', 'camera'],
            success: (res) => {
                const path = (res.tempFilePaths as string[] | undefined)?.[0];
                if (path) resolve(path);
                else reject(new AvatarError('pick-failed'));
            },
            fail: (err) => {
                const msg = String((err as { errMsg?: string } | undefined)?.errMsg ?? '');
                // 用户取消不算错误
                if (msg.includes('cancel')) resolve(null);
                else reject(new AvatarError('pick-failed'));
            },
        });
    });
}

function persistToUserFile(fs: AvatarFS, userPath: string, tempPath: string): string {
    // App 可能带 file:// 前缀，FileSystemManager 只收纯路径
    const srcPath = tempPath.startsWith('file://') ? tempPath.slice('file://'.length) : tempPath;
    const raw = fs.readFileSync(srcPath);
    if (typeof raw === 'string') throw new AvatarError('read-failed');
    if (raw.byteLength > MAX_FILE_BYTES) throw new AvatarError('too-large');

    const dest = `${userPath.replace(/\/+$/, '')}/${FILE_NAME}.${extensionOf(srcPath)}`;
    fs.writeFileSync(dest, raw);
    return dest;
}

function blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        if (typeof FileReader === 'undefined') {
            reject(new AvatarError('read-failed'));
            return;
        }
        const reader = new FileReader();
        reader.addEventListener('load', () => resolve(typeof reader.result === 'string' ? reader.result : ''), {
            once: true,
        });
        reader.addEventListener('error', () => reject(new AvatarError('read-failed')), { once: true });
        reader.readAsDataURL(blob);
    });
}

/** 大图按最长边缩到 MAX_EDGE 并重编码为 JPEG；无法解码时原样返回。 */
function downscaleDataUrl(dataUrl: string): Promise<string> {
    if (typeof document === 'undefined' || dataUrl.length <= MAX_DATA_URL_CHARS) {
        return Promise.resolve(dataUrl);
    }
    return new Promise((resolve) => {
        const img = new Image();
        img.addEventListener(
            'load',
            () => {
                const edge = Math.max(img.width, img.height);
                const scale = edge > MAX_EDGE ? MAX_EDGE / edge : 1;
                if (scale === 1) {
                    resolve(dataUrl);
                    return;
                }
                const canvas = document.createElement('canvas');
                canvas.width = Math.max(1, Math.round(img.width * scale));
                canvas.height = Math.max(1, Math.round(img.height * scale));
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    resolve(dataUrl);
                    return;
                }
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                resolve(canvas.toDataURL('image/jpeg', 0.85));
            },
            { once: true },
        );
        img.addEventListener('error', () => resolve(dataUrl), { once: true });
        img.src = dataUrl;
    });
}

async function persistToDataUrl(tempPath: string): Promise<string> {
    if (typeof fetch !== 'function') throw new AvatarError('read-failed');
    let blob: Blob;
    try {
        blob = await (await fetch(tempPath)).blob();
    } catch {
        throw new AvatarError('read-failed');
    }
    return downscaleDataUrl(await blobToDataUrl(blob));
}

async function persistAvatar(tempPath: string): Promise<string> {
    // 少数平台 chooseImage 直接回 data URL
    if (tempPath.startsWith('data:')) return downscaleDataUrl(tempPath);

    const fs = getFS();
    const userPath = userDataPath();
    if (fs && userPath) {
        try {
            return persistToUserFile(fs, userPath, tempPath);
        } catch (err) {
            if (err instanceof AvatarError && err.reason === 'too-large') throw err;
            // 某些 H5 运行时暴露的是虚拟 fs，读不了 blob —— 回落 data URL
        }
    }
    return persistToDataUrl(tempPath);
}

/**
 * 选一张图并落地为头像。用户取消 → null；失败抛 `AvatarError`。
 * 成功后已经写入 storage（调用方只需更新展示）。
 */
export async function pickAvatar(): Promise<string | null> {
    const temp = await chooseImagePath();
    if (!temp) return null;
    const src = await persistAvatar(temp);
    if (!setAvatar(src)) throw new AvatarError('store-failed');
    return src;
}
