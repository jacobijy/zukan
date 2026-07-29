/**
 * HTTP 基础层：REST 客户端 + 二进制下载器
 *
 * consumers 应该 `import { rest, fetchBinary } from '@/services/http'`
 * 而不是深入到具体模块。
 */
export { rest, RestRequestError } from './request';

export { fetchBinary, BinaryRequestError } from './binaryRequest';
