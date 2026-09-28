import uni from "@dcloudio/vite-plugin-uni";
import { createRequire } from 'node:module';
import path from 'path';
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';
import { defineConfig } from "vite";
import { UnifiedViteWeappTailwindcssPlugin as uvwt } from 'weapp-tailwindcss/vite';

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
const isApp = process.env.UNI_PLATFORM === 'app';
const isMp = !!process.env.UNI_PLATFORM?.startsWith('mp-');

// 微信小程序没有标准全局 WebAssembly（直接用会 ReferenceError），改用微信的
// WXWebAssembly（基础库 ≥2.13.0）；关键差异：WXWebAssembly.instantiate 第一参是
// 代码包内 .wasm 的「路径字符串」，不是 BufferSource，也不需要 readFileSync/fetch。
// 该插件在 Vite/uni 处理 glue 之前（enforce:'pre'，拿到 wasm-bindgen 原始 ESM 源码），
// 用正则把整个 __wbg_init 替换为直接传路径给 WXWebAssembly.instantiate 的微信版；
// __wbg_load / initSync 等含标准 WebAssembly 的函数小程序运行时不会调用，保留为死代码。
function adaptWasmToWx(): any {
    const marker = 'infra/wasm/pkg/zukan_wasm.js';
    const initRe =
        /async function __wbg_init\(module_or_path\) \{[\s\S]*?return __wbg_finalize_init\(instance, module\);\n\}/;
    const wxInit = [
        'async function __wbg_init(module_or_path) {',
        '    if (wasm !== undefined) return wasm;',
        '    if (module_or_path !== undefined && Object.getPrototypeOf(module_or_path) === Object.prototype) {',
        '        ({module_or_path} = module_or_path);',
        '    }',
        '    // 微信小程序用 WXWebAssembly（无标准 WebAssembly 全局）；instantiate 第一参',
        '    // 为代码包内 .wasm 路径字符串，不能传字节、不 fetch。',
        '    if (typeof module_or_path !== "string") {',
        '        throw new Error("微信小程序必须传入代码包内 .wasm 路径字符串");',
        '    }',
        '    const imports = __wbg_get_imports();',
        '    const { instance, module } = await WXWebAssembly.instantiate(module_or_path, imports);',
        '    return __wbg_finalize_init(instance, module);',
        '}',
    ].join('\n');
    return {
        name: 'zukan-adapt-wasm-to-wx',
        enforce: 'pre',
        transform(code: string, id: string) {
            if (!id.split('?')[0].endsWith(marker) || !initRe.test(code)) return null;
            return { code: code.replace(initRe, wxInit), map: null };
        },
    };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    uni(),
    ...(isMp ? [adaptWasmToWx()] : []),
    // weapp-tailwindcss（仅小程序）：Tailwind v3 为斜杠/冒号/任意值类生成的选择器
    // 带反斜杠转义（`\/`、`\:`、`\[`…），WXSS 不支持选择器反斜杠转义，整个 app.wxss
    // 编译失败。该插件在产物末端把 wxss / wxml / js 三处的类名一致改成无特殊字符的
    // 安全名（返回插件数组，需展开；放在 uni() 之后）。
    ...(isMp ? uvwt({ tailwindcssBasedir: process.cwd() }) ?? [] : []),
    // App 的 service 层被 uni 强制打成单文件 app-service.js（IIFE），同时又把
    // inlineDynamicImports 置为 false。我们工程里用于打破循环依赖的多处动态
    // import() 会因此产生物理 chunk，与 IIFE 冲突、构建失败（H5/小程序不受影响）。
    // 在最终配置阶段把动态 import 内联回单文件，等价于 HBuilderX 的处理方式。
    ...(isApp
      ? [
          {
            name: 'zukan-inline-app-dynamic-import',
            configResolved(c: any) {
              const output = c.build?.rollupOptions?.output;
              if (output && !Array.isArray(output)) {
                output.inlineDynamicImports = true;
                // manualChunks 与 inlineDynamicImports 互斥；uni 置了空对象
                output.manualChunks = undefined;
              }
            },
          },
        ]
      : []),
  ],
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
