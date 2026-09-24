/**
 * 编译期宿主平台标识。
 *
 * 这是全仓库唯一用条件编译判定「运行在哪类宿主」的地方：uni-app 在构建时按目标平台
 * 保留对应 `#ifdef` 分支，得到权威的宿主类型。运行时 os（iOS/Android）细分交给
 * `resolve.ts` 的纯函数处理。
 *
 * 注意：vitest（node）不剥离 `#ifdef` 注释，三个分支会共存、顺序执行，最终值恒为
 * 最后一个分支——这是已知的测试态，故本常量不直接被单测覆盖；单测直接驱动
 * `resolvePlatform(host, info)`。此处理由与 `src/services/devtools/enabled.ts` 相同。
 */

export type HostPlatform = 'h5' | 'mp-weixin' | 'app' | 'unknown';

let host: HostPlatform = 'unknown';

// #ifdef H5
host = 'h5';
// #endif

// #ifdef MP-WEIXIN
host = 'mp-weixin';
// #endif

// #ifdef APP-PLUS
host = 'app';
// #endif

export const hostPlatform: HostPlatform = host;
