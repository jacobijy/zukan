/**
 * 加密资源加载栈
 *
 * - `resourceManager` FB bundle 三层缓存（memory / storage / network）
 * - `buildCdnUrl` 签 URL
 * - `dataVersion` KV 版本号
 */
export { resourceManager } from './resourceManager';
export type { PokemonMovesKind, MovesDataKind, ResourceStats } from './resourceManager';

export { buildCdnUrl } from './cdn';

export {
  getStoredDataVersion,
  setStoredDataVersion,
  clearStoredDataVersion,
} from './dataVersion';
