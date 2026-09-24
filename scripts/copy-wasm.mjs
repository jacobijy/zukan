#!/usr/bin/env node
/**
 * 把 Rust/wasm-bindgen 产物 `src/infra/wasm/pkg/zukan_wasm_bg.wasm`
 * 同步到小程序包内可读取的位置 `src/static/wasm/zukan_wasm_bg.wasm`。
 *
 * 为什么需要：微信小程序不支持 wasm-bindgen 默认的
 * `new URL('...wasm', import.meta.url)` + fetch 初始化，运行时改为从代码包内
 * 用 FileSystemManager 读取字节再 `WebAssembly.instantiate`。只有放在 src/static
 * 下的文件才会被 uni-app 原样拷进小程序产物。
 *
 * 每次重新构建 Rust WASM 后应跑一次；已挂到 `predev:mp-weixin` /
 * `prebuild:mp-weixin`，正常开发无需手动执行。
 */
import { copyFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const SRC = `${root}src/infra/wasm/pkg/zukan_wasm_bg.wasm`;
const DEST = `${root}src/static/wasm/zukan_wasm_bg.wasm`;

if (!existsSync(SRC)) {
    console.error(`[copy-wasm] 找不到源文件：${SRC}\n请先在 src/infra/wasm 下构建 Rust WASM（wasm-pack build）。`);
    process.exit(1);
}

mkdirSync(dirname(DEST), { recursive: true });
copyFileSync(SRC, DEST);
console.log(`[copy-wasm] ${SRC.replace(root, '')} → ${DEST.replace(root, '')}`);
