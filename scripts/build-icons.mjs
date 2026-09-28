/**
 * 图标字体构建（仅小程序需要）
 *
 * 从 `src/**&#47;*.vue` 中提取带 `data-ic="<name>"` 标记的内联 <svg>（H5/App 下该标记
 * 是无视觉影响的普通属性），连同 `src/components/icon/extra/*.svg`（数据驱动 / 实心
 * 变体等无法直接从模板提取的图标）一起：
 *
 *   oslllo-svg-fixer：把 stroke 线条图标转成「填充 / 单路径」（字体字形只认填充）
 *   fantasticon：生成 ttf
 *
 * 产物：
 *   src/static/fonts/zukan-icons.ttf        —— 小程序字体文件
 *   src/components/icon/glyphs.ts          —— name → unicode 映射（<text> 内联字形用）
 *
 * 源码是唯一数据源；改图标后重跑 `pnpm build:icons`（dev/build:mp-weixin 已自动调用）。
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import svgFixerPkg from 'oslllo-svg-fixer';
import { generateFonts } from 'fantasticon';

const ROOT = process.cwd();
const SRC = path.join(ROOT, 'src');
const EXTRA_DIR = path.join(SRC, 'components/icon/extra');
const FONT_OUT = path.join(SRC, 'static/fonts');
const GLYPH_OUT = path.join(SRC, 'components/icon/glyphs.ts');
const FONT_NAME = 'zukan-icons';

const SVGFixer = svgFixerPkg;

// 清理 <svg> 时保留的属性（白名单）；v-xxx / :xxx / class / data-ic 等一律丢弃
const KEEP = new Set([
    'viewbox', 'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin',
    'd', 'cx', 'cy', 'r', 'x', 'y', 'width', 'height', 'x1', 'x2', 'y1', 'y2',
    'points', 'rx', 'ry', 'opacity', 'stroke-opacity', 'fill-opacity', 'transform',
]);

function cleanTag(inner) {
    // 注意：属性前不一定有空格（`<path d="x">` 紧贴写法），分隔符须可选
    const attrs = [...inner.matchAll(/(?:^|\s)([\w:.-]+)\s*=\s*"([^"]*)"/g)];
    const kept = attrs
        .filter(([_, k]) => KEEP.has(k.toLowerCase()))
        .map(([_, k, v]) => `${k}="${v}"`)
        .join(' ');
    const tag = inner.match(/^\s*([a-zA-Z][\w.-]*)/)[1];
    return `<${tag}${kept ? ` ${kept}` : ''}>`;
}

/** 清洗 svg 到规范形式：保留属性白名单 */
function cleanSvg(block) {
    // 先压平标签之间的换行/缩进（保留 > 与 < 之间以外的空白，那是属性分隔符）
    let b = block.replace(/>\s+</g, '><');
    b = b.replace(/<([a-zA-Z][^>]*?)(\/?)>/g, (_m, inner) => cleanTag(inner));
    b = b.replace(/\sxmlns="[^"]*"/, '');
    b = b.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ', 1);
    b = b.replace(/\s{2,}/g, ' ');
    return b.trim();
}

/**
 * 等价判定键：字形由「几何 + 描边粗细」决定，颜色不进去。
 * stroke="currentColor" 在字体里天然继承 <text> 的 color，各实例的 #xxx / white
 * 属用法差异，不构成图形差异。
 */
function canonical(svg) {
    return svg
        .replace(/stroke="[^"]*"/g, '')
        .replace(/opacity="[^"]*"/g, '')
        .replace(/ stroke-linecap="[^"]*"/g, '')
        .replace(/ stroke-linejoin="[^"]*"/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
}

/** 递归收集 src 下所有 .vue */
function walkVue(dir, out = []) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) walkVue(p, out);
        else if (e.name.endsWith('.vue')) out.push(p);
    }
    return out;
}

/** 提取 .vue 中所有带 data-ic 标记的 svg 块 → { name: cleanSvg } */
function collectFromVue() {
    const found = {};
    const re = /<svg\b[^>]*\bdata-ic="([\w-]+)"[^>]*>[\s\S]*?<\/svg>/g;
    for (const file of walkVue(SRC)) {
        const t = fs.readFileSync(file, 'utf8');
        for (const m of t.matchAll(re)) {
            const name = m[1];
            const svg = cleanSvg(m[0]);
            if (found[name]) {
                // 同名 → 图形必须等价才合并；否则是真冲突
                if (canonical(found[name]) !== canonical(svg)) {
                    throw new Error(`data-ic="${name}" 同名但图形不一致：${file} 与更早文件冲突`);
                }
                continue;
            }
            found[name] = svg;
        }
    }
    return found;
}

async function main() {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'zukan-icons-'));
    const rawDir = path.join(tmp, 'raw');
    const fixedDir = path.join(tmp, 'fixed');
    fs.mkdirSync(rawDir, { recursive: true });
    fs.mkdirSync(fixedDir, { recursive: true });

    const icons = collectFromVue();

    // extra 直接是规范 svg（已是填充/或可被 fixer 处理）
    if (fs.existsSync(EXTRA_DIR)) {
        for (const f of fs.readdirSync(EXTRA_DIR).filter((f) => f.endsWith('.svg'))) {
            const name = path.basename(f, '.svg');
            if (icons[name]) throw new Error(`extra/${f} 与 data-ic="${name}" 冲突`);
            icons[name] = fs.readFileSync(path.join(EXTRA_DIR, f), 'utf8');
        }
    }

    const names = Object.keys(icons).sort();
    if (names.length === 0) {
        console.warn('[build-icons] 未发现任何 data-ic 图标，跳过');
        return;
    }
    for (const name of names) fs.writeFileSync(path.join(rawDir, `${name}.svg`), icons[name]);
    console.log(`[build-icons] ${names.length} 个图标 -> ${names.join(', ')}`);

    await new SVGFixer(rawDir, fixedDir, { traceResolution: 1024 }).fix();

    fs.mkdirSync(FONT_OUT, { recursive: true });
    fs.mkdirSync(path.dirname(GLYPH_OUT), { recursive: true });
    const result = await generateFonts({
        name: FONT_NAME,
        prefix: 'ic',
        inputDir: fixedDir,
        outputDir: FONT_OUT,
        fontTypes: ['ttf'],
        assetTypes: [],
    });

    // fantasticon 会输出到 FONT_OUT/<name>.ttf；确认存在
    const ttfPath = path.join(FONT_OUT, `${FONT_NAME}.ttf`);
    if (!fs.existsSync(ttfPath)) throw new Error('ttf 未生成');
    console.log(`[build-icons] ✅ ${path.relative(ROOT, ttfPath)} (${fs.statSync(ttfPath).size} B)`);

    const lines = [
        '// 本文件由 scripts/build-icons.mjs 自动生成，请勿手改',
        '/* eslint-disable */',
        '',
        `export const GLYPH: Record<string, string> = {`,
        ...names.map((n) => `    '${n}': '${toEscape(result.codepoints[n])}',`),
        '};',
        '',
        '/** 取图标字形（找不到返回空串） */',
        'export function glyph(name: string): string {',
        '    return GLYPH[name] ?? \'\';',
        '}',
        '',
    ];
    fs.writeFileSync(GLYPH_OUT, lines.join('\n'));
    console.log(`[build-icons] ✅ ${path.relative(ROOT, GLYPH_OUT)}`);

    fs.rmSync(tmp, { recursive: true, force: true });
}

function toEscape(cp) {
    return cp <= 0xffff ? `\\u${cp.toString(16).padStart(4, '0')}` : `\\u{${cp.toString(16)}}`;
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
