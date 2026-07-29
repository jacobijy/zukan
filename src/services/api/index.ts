/**
 * 后端 API 调用聚合
 *
 * 每个模块对应一组 backend route prefix。用 namespace 导出避免命名冲突：
 *   `import { authApi, favoritesApi } from '@/services/api'`
 *   `authApi.login(...)`
 */
export * as authApi from './auth';
export * as favoritesApi from './favorites';

// 常用 error 类型直接导出，方便 catch 分支 instanceof
export { AuthApiError } from './auth';
