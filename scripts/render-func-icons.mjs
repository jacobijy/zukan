/**
 * 功能性彩色图标：栅格化 PNG + 生成同色相浅底磁贴 CSS（可重复跑）
 *
 * 源：scripts/icons/func/*.svg（24×24 实心彩色 SVG，tmp/icons 设计稿入库版）
 * 产物：
 *   1. src/static/img/func-icons/<name>.png —— 144×144（@4 母版，与 hub-icons 同规格）
 *   2. src/static/styles/func-tiles.css     —— 每个色桶一个 .func-tile--* 浅彩底类
 *
 * 配色方案（2026-10，预览四方案对比后选定「同色相 tint」）：
 *   从每个 SVG 根标签的 fill="#..." 提取主色 → 转 HSL → 归到最近色桶 →
 *   生成该色相的浅底渐变（L 95%→88%）与深墨 ink（L 30%，供保留的单色字形着色）。
 *   新增图标自动渲图、自动归桶，无需手配底色；同组卡片出现同色相邻时，调用点
 *   改传另一个 .func-tile--* 桶即可（编排层），不必动本脚本。
 *
 * 彩色 SVG 进不了单色 ttf 字体通道，故 PNG 与 HubIcon 同模式。
 *
 * 用法：node scripts/render-func-icons.mjs
 * 依赖：@resvg/resvg-js（当前作为 fantasticon 等工具的传递依赖存在于
 *       node_modules/.pnpm，未列入 package.json；若日后 pnpm 不再安装它，
 *       需要时再显式 pnpm add -D @resvg/resvg-js）。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC_DIR = path.join(ROOT, 'scripts/icons/func');
const OUT_DIR = path.join(ROOT, 'src/static/img/func-icons');
const TILES_OUT = path.join(ROOT, 'src/static/styles/func-tiles.css');
const SIZE = 144;

// ── 色桶（基准 hue）：图标主色就近归桶，桶色由基准 hue 统一生成 ──
const TILES = [
    ['blue', 213],
    ['green', 150],
    ['gold', 39],
    ['red', 355],
    ['violet', 262],
];
// 浅底渐变两端与深墨 ink 的 HSL 参数（同色相，仅变明度/饱和）
const TINT = { satLo: 0.55, satHi: 0.62, lightLo: 0.95, lightHi: 0.88, inkSat: 0.55, inkLight: 0.3 };

// pnpm 隔离：包不在顶层 node_modules，从 .pnpm 目录解析
function resolveResvg() {
    const pnpmDir = path.join(ROOT, 'node_modules/.pnpm');
    const entry = fs
        .readdirSync(pnpmDir)
        .filter((d) => d.startsWith('@resvg+resvg-js@'))
        .map((d) => path.join(pnpmDir, d, 'node_modules/@resvg/resvg-js'))
        .find((p) => fs.existsSync(path.join(p, 'package.json')));
    if (!entry) throw new Error('未找到 @resvg/resvg-js，需要时执行 pnpm add -D @resvg/resvg-js');
    return createRequire(import.meta.url)(entry);
}

const { Resvg } = resolveResvg();

// ── 颜色工具 ────────────────────────────────────────────────
function hslToHex(h, s, l) {
    h = ((h % 360) + 360) % 360;
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;
    let r = 0, g = 0, b = 0;
    if (h < 60) [r, g, b] = [c, x, 0];
    else if (h < 120) [r, g, b] = [x, c, 0];
    else if (h < 180) [r, g, b] = [0, c, x];
    else if (h < 240) [r, g, b] = [0, x, c];
    else if (h < 300) [r, g, b] = [x, 0, c];
    else [r, g, b] = [c, 0, x];
    return '#' + [r, g, b].map((v) => Math.round((v + m) * 255).toString(16).padStart(2, '0')).join('');
}
function hueDistance(a, b) {
    const d = Math.abs(a - b) % 360;
    return d > 180 ? 360 - d : d;
}
function nearestBucket(hue) {
    return TILES.map(([name, h]) => [name, hueDistance(hue, h)]).sort((a, b) => a[1] - b[1])[0][0];
}

/**
 * 取图标主色：优先根标签 fill；缺失时（新风格把颜色写在内部 stroke/fill 上）
 * 扫描全部 fill=/stroke= 十六进制色，选饱和度高、明度居中的彩色（排除近白/近黑/灰）。
 * 都找不到返回 null，调用方再兜底 blue。
 */
function extractMainColor(svg) {
    const rootFill = svg.match(/<svg[^>]*?\sfill="(#[0-9a-fA-F]{6})"/)?.[1];
    if (rootFill) return rootFill;
    const colors = [...svg.matchAll(/(?:fill|stroke)="(#[0-9a-fA-F]{6})"/g)].map((m) => m[1]);
    let best = null;
    let bestScore = -1;
    for (const c of colors) {
        const [, s, l] = hexToHsl(c);
        if (s < 0.25 || l < 0.2 || l > 0.85) continue;
        const score = s * (1 - Math.abs(l - 0.55));
        if (score > bestScore) {
            bestScore = score;
            best = c;
        }
    }
    return best;
}
function hexToHsl(hex) {
    const n = parseInt(hex.slice(1), 16);
    const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const l = (max + min) / 2;
    const d = max - min;
    const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
    let h = 0;
    if (d !== 0) {
        if (max === r) h = ((g - b) / d) % 6;
        else if (max === g) h = (b - r) / d + 2;
        else h = (r - g) / d + 4;
        h *= 60;
        if (h < 0) h += 360;
    }
    return [h, s, l];
}

fs.mkdirSync(OUT_DIR, { recursive: true });

/**
 * 源套图形不少顶到 24 画布边缘（刻度/箭头到 y=1），aspectFit 会贴边显大。
 * 只把根标签的 viewBox 扩成 -2 -2 28 28（内容自然居中、四周留 ~7% 透气），
 * 并把输出尺寸改 144——**必须保留根标签其余属性**：这批 SVG 的主色常写在根
 * fill="#..." 上、内部 path 靠继承着色，剥掉根标签会全部回退成黑色。
 */
const files = fs.readdirSync(SRC_DIR).filter((f) => f.endsWith('.svg'));
for (const file of files) {
    const name = path.basename(file, '.svg');
    const raw = fs.readFileSync(path.join(SRC_DIR, file), 'utf8');

    // 提取主色归桶（根 fill 优先，缺失时扫内部 stroke/fill）
    const mainColor = extractMainColor(raw);
    const bucket = mainColor ? nearestBucket(hexToHsl(mainColor)[0]) : 'blue';

    const svg = raw
        .replace(/viewBox="0 0 24 24"/, 'viewBox="-2 -2 28 28"')
        .replace(/width="24"/g, 'width="144"')
        .replace(/height="24"/g, 'height="144"');
    const png = new Resvg(svg, {
        fitTo: { mode: 'width', value: SIZE },
        background: 'rgba(0,0,0,0)',
    })
        .render()
        .asPng();
    fs.writeFileSync(path.join(OUT_DIR, `${name}.png`), png);
    console.log(`✓ ${name}.png → tile ${bucket} (${mainColor ?? '无主色，兜底 blue'})`);
}

// ── 生成 func-tiles.css：每桶一个浅底类（渐变 + 深墨 ink） ──
const lines = [
    '/* 本文件由 scripts/render-func-icons.mjs 自动生成，请勿手改。',
    '   同色相浅底磁贴：.func-tile--* 给容器背景与 currentColor ink（深墨），',
    '   供 InfoCard / CalcCard 槽位与保留的单色字形共用。 */',
    '',
];
for (const [name, hue] of TILES) {
    const c1 = hslToHex(hue, TINT.satLo, TINT.lightLo);
    const c2 = hslToHex(hue, TINT.satHi, TINT.lightHi);
    const ink = hslToHex(hue, TINT.inkSat, TINT.inkLight);
    lines.push(`.func-tile--${name} {`);
    lines.push(`    background: linear-gradient(135deg, ${c1} 0%, ${c2} 100%);`);
    lines.push(`    color: ${ink};`);
    lines.push('}');
}
fs.writeFileSync(TILES_OUT, lines.join('\n') + '\n');
console.log(`✓ ${path.relative(ROOT, TILES_OUT)}（${TILES.length} 个色桶）`);
console.log(`共 ${files.length} 枚图标 → ${path.relative(ROOT, OUT_DIR)}`);
