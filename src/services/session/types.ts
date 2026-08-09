/**
 * 会话相关类型：DEK 响应 + CDN 签名 token
 *
 * 与 `/api/v1/zukan/key` 端点响应共享类型；也被 `resources/cdn.ts` 消费。
 */

/**
 * CDN 签名 token。与 DEK 一起下发，用于给 `/assets/encrypted/*` URL 签名。
 * `sign` / `t` 对客户端不透明，原样拼到 query；签名密钥仅在 origin 与 CDN 边缘之间共享。
 */
export interface CdnToken {
    sign: string;
    t: number;
    /** scheme+host（可含公共前缀），末尾无斜杠 */
    base_url: string;
    /** 相对秒 TTL，仅参考；实际失效走 403 lazy refresh */
    expires_in?: number;
}

export interface DekResponse {
    dek: string;
    version?: number;
    algorithm?: string;
    /** 老后端 / 本地无 CDN 时缺席；缺席则 `buildCdnUrl` fallback 到 origin */
    cdn?: CdnToken;
}
