/**
 * HTTP 基础层：REST 客户端 + 二进制下载器
 *
 * consumers 应该 `import { rest, fetchBinary } from '@/services/http'`
 * 而不是深入到具体模块。
 */
export { rest, request, RestRequestError } from './request';
export type { RestRequestOptions } from './request';

export { fetchBinary, BinaryRequestError } from './binaryRequest';
export type { BinaryRequestOptions } from './binaryRequest';
