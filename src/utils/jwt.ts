/**
 * 极简 JWT 载荷解析：只读 `exp`（Unix 秒），**不验签**。
 *
 * 用途是前端本地判断 access token 是否快过期、要不要提前 refresh，
 * 安全边界仍在服务端（签名校验 + 401）。JWT 载荷只含 ASCII claims
 * （sub / exp / iat / token_type），这里按字节直接拼字符串，避免依赖
 * `atob` / `TextDecoder`（小程序端不可靠）。
 */

const BASE64URL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

function decodeBase64Url(input: string): string {
    const bytes: number[] = [];
    let buffer = 0;
    let bits = 0;
    for (const ch of input) {
        const value = BASE64URL.indexOf(ch);
        if (value < 0) throw new Error('invalid base64url');
        buffer = (buffer << 6) | value;
        bits += 6;
        if (bits >= 8) {
            bits -= 8;
            bytes.push((buffer >> bits) & 0xff);
        }
    }
    let out = '';
    for (const byte of bytes) out += String.fromCharCode(byte);
    return out;
}

/** 读取 JWT 的 `exp`（Unix 秒）；格式不对 / 没有 exp 返回 null。 */
export function jwtExpiresAt(token: string): number | null {
    const payloadPart = token.split('.')[1];
    if (!payloadPart) return null;
    try {
        const payload: unknown = JSON.parse(decodeBase64Url(payloadPart));
        if (typeof payload !== 'object' || payload === null) return null;
        const exp = (payload as { exp?: unknown }).exp;
        return typeof exp === 'number' && Number.isFinite(exp) ? exp : null;
    } catch {
        return null;
    }
}
