/**
 * 平台管理对象入口：`getPlatformManager()` 按当前平台返回单例。
 * 模式与职责边界见 docs/architecture/platform-managers.md。
 */
export { getPlatformManager } from './registry';
export type { BindResult, LoginResult, PlatformManager } from './types';
