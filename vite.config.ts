import uni from "@dcloudio/vite-plugin-uni";
import path from 'path';
import { defineConfig } from "vite";

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
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    }
  }
});
