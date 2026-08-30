import uni from "@dcloudio/vite-plugin-uni";
import { createRequire } from 'node:module';
import path from 'path';
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';
import { defineConfig } from "vite";

// vue-i18n@9.9 依赖 @intlify/*@9.9（其 message-compiler 导出 CompileErrorCodes），
// 但 @dcloudio/uni-cli-shared 在构建期精确钉死 @intlify/*@9.1.9，pnpm 会把 9.1.9
// 提升到 .pnpm/node_modules。Vite 预构建去重时为浏览器解析会误命中 9.1.9，导致
// "does not provide an export named 'CompileErrorCodes'"。把三个包强制指回
// vue-i18n 自带的 9.9.0 物理路径。
//
// 注意：这只允许在 H5/浏览器目标上启用。mp/app 等构建会经 uni-cli-shared 自带的
// vue-i18n@9.1.9 runtime 走同一条 vite 解析，它的 @intlify/core-base 需要 9.1.9
// 的 handleFlatJson 导出；全局 alias 到 9.9.0 会让 mp-weixin 构建报
// "handleFlatJson is not exported by core-base"（两版 core-base 的 API 有差）。
// UNI_PLATFORM 由 uni CLI 在加载本配置前写入（默认 'h5'）。
const require = createRequire(import.meta.url);
const viDir = path.dirname(
  require.resolve('vue-i18n/package.json', { paths: [process.cwd()] }),
);
const coreBaseDir = path.dirname(
  require.resolve('@intlify/core-base/package.json', { paths: [viDir] }),
);
const intlify99 = (name: string) =>
  path.dirname(
    require.resolve(`${name}/package.json`, { paths: [coreBaseDir] }),
  );
const isH5 = process.env.UNI_PLATFORM === 'h5';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [uni()],
  server: {
    port: 4000, // 端口号
    host: '0.0.0.0', // 允许外部访问
    open: true, // 自动打开浏览器
    hmr: {
      overlay: false
    },
    watch: {
      // Rust WASM 增量编译产物变化极频繁，会撞爆 inotify 上限
      ignored: [
        '**/src/infra/wasm/target/**',
        '**/target/**',
      ],
    },
  },
  css: {
    postcss: {
      plugins: [tailwindcss(), autoprefixer()],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      ...(isH5
        ? {
            '@intlify/core-base': intlify99('@intlify/core-base'),
            '@intlify/message-compiler': intlify99('@intlify/message-compiler'),
            '@intlify/shared': intlify99('@intlify/shared'),
          }
        : {}),
    }
  }
});
