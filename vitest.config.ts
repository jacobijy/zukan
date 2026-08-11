/**
 * Vitest 配置（与 `vite.config.ts` 分离）
 *
 * 刻意**不复用** `vite.config.ts`：那份配置装了 `@dcloudio/vite-plugin-uni`，
 * 插件会接管编译并要求完整的 uni-app 上下文（pages.json、manifest.json、
 * 平台环境变量），在 node 测试环境下跑不起来。
 *
 * 因此本配置只保留 `@` 别名，测试目标限定为**不依赖 uni API 的纯逻辑**
 * （`src/utils/*`、`src/constants/*`）。需要覆盖 `uni.getStorageSync` 这类
 * 平台 API 时，请在用例里显式 stub `globalThis.uni`，而不是引入 uni 插件。
 */
import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
    test: {
        environment: 'node',
        include: ['tests/**/*.spec.ts'],
    },
});
