/**
 * CDN 签名 URL 构造
 *
 * 把 `/assets/encrypted/*` 相对路径升级为已签名的绝对 CDN URL。
 * 签名密钥仅在 origin 与 CDN 边缘节点之间共享，客户端只搬运 `sign` + `t`。
 *
 * - `cdn` 缺席（老后端 / 本地无 CDN）：返回裸相对路径，交给 `fetchBinary` 的 `buildUrl` 拼 origin
 * - `cdn` 存在：拼 `base_url` + `?sign=...&t=...`
 * - 已是绝对 URL：透传（避免二次签名 / 死循环）
 *
 * 与 `binaryRequest.buildUrl` 语义正交：本函数只管"加 CDN 前缀与签名"，
 * `fetchBinary` 保持"给个 URL 就下"的 dumb 语义。
 */
import type { CdnToken } from '@/services/auth';

export function buildCdnUrl(remotePath: string, cdn: CdnToken | undefined): string {
  if (/^https?:\/\//.test(remotePath)) return remotePath;
  const path = `/${remotePath.replace(/^\//, '')}`;
  if (!cdn) return path;
  const base = cdn.base_url.replace(/\/$/, '');
  const sep = path.includes('?') ? '&' : '?';
  return `${base}${path}${sep}sign=${encodeURIComponent(cdn.sign)}&t=${cdn.t}`;
}
