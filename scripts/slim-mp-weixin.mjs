#!/usr/bin/env node
/**
 * 微信小程序产物瘦身（只动 dist，不碰 src）。
 *
 * 背景：`src/static/img` 里的属性贴纸（01–18 × s/m/l）与招式分类（× s/m/l）是
 * **刻意保留的成套资源**，并有 `tests/typeIcons.spec.ts` / `moveCategory.spec.ts`
 * 守着「文件在源目录存在」，H5 也会用到全部尺寸。但微信小程序**主包 ≤ 2MB**，
 * 当前 UI 只渲染 `m` 档（见 TypeBadgeIcon / MoveCard 调用），所以构建后把暂不
 * 使用的 s/l 从产物里剔除；源文件与测试都不受影响。
 *
 * 等小程序接入列表（s）/详情（l）贴纸时，从这里删掉对应规则即可。
 *
 * 注意：只在 `build:mp-weixin` 后执行；dev 产物保留全套，方便在开发者工具里
 * 直接验证未来尺寸（模拟器不强制 2MB）。
 */
import { rmSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const outDir = fileURLToPath(new URL('../dist/build/mp-weixin/', import.meta.url));

/** 产物内相对路径 glob，用展开函数生成，避免引入 glob 依赖 */
const patterns = [
    ...Array.from({ length: 18 }, (_, i) => `static/img/type-icons/type_${String(i + 1).padStart(2, '0')}`),
    ...Array.from({ length: 3 }, (_, i) => `static/img/waza_category/waza_0${i + 1}`),
];
const suffixes = ['s.png', 'l.png'];

let removed = 0;
let bytes = 0;
for (const base of patterns) {
    for (const suffix of suffixes) {
        const file = outDir + base + suffix;
        if (existsSync(file)) {
            bytes += statSync(file).size;
            rmSync(file);
            removed += 1;
        }
    }
}

console.log(`[slim-mp] 剔除 ${removed} 个暂未使用的 s/l 图标，释放 ${(bytes / 1024).toFixed(0)} KB`);
