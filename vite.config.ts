import uni from "@dcloudio/vite-plugin-uni";
import { createRequire } from 'node:module';
import path from 'path';
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';
import { defineConfig } from "vite";

// vue-i18n@9.9 依赖 @intlify/*@9.9（其 message-compiler 导出 CompileErrorCodes），
// 但 @dcloudio/uni-cli-shared 在构建期精确钉死 @intlify/*@9.1.9，pnpm 会把 9.1.9
// 提升到 .pnpm/node_modules。Vite 为浏览器解析时会误命中 9.1.9，导致
// "does not provide an export named 'CompileErrorCodes'"。这里把三个包强制指回
// vue-i18n 自带的 9.9.0 物理路径（只影响浏览器 bundle，不影响 dcloudio 构建期）。
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
      '@intlify/core-base': intlify99('@intlify/core-base'),
      '@intlify/message-compiler': intlify99('@intlify/message-compiler'),
      '@intlify/shared': intlify99('@intlify/shared'),
    }
  }
});
