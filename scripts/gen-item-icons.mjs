/**
 * 道具图标 manifest 生成脚本。
 *
 * 扫描 `src/static/img/Artwork Items/aitem_<PokeAPI item id>.png`（官方道具
 * 大图，随包发布的静态资源），生成 `src/constants/itemIcons.ts`：
 * - `ITEM_ICON_IDS`：有本地图标的道具 id 集合；
 * - `itemIconUrl(id)`：有图标返回 `/static/...` URL（目录名含空格，做
 *   percent-encode），无则 null（调用方回落占位图）。
 *
 * 不用 `import.meta.glob`：src/static 不经过 vite 模块图（原样拷贝），
 * 且 glob 在小程序端不兼容。新增/删除道具图后跑 `pnpm gen:item-icons`。
 *
 * 用法：node scripts/gen-item-icons.mjs
 */
import { readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const ICON_DIR = 'src/static/img/Artwork Items';
const OUT = 'src/constants/itemIcons.ts';

const ids = [];
for (const f of readdirSync(join(root, ICON_DIR))) {
    const m = /^aitem_(\d+)\.png$/.exec(f);
    if (m) ids.push(Number(m[1]));
}
ids.sort((a, b) => a - b);

const body = `/**
 * 道具图标 manifest —— 由 scripts/gen-item-icons.mjs 扫描
 * \`src/static/img/Artwork Items/aitem_<id>.png\` 自动生成，请勿手改。
 * 新增/删除道具图后跑 \`pnpm gen:item-icons\`。
 */

/** 有本地大图的道具 id（PokeAPI item id）集合 */
export const ITEM_ICON_IDS: ReadonlySet<number> = new Set([${ids.join(', ')}]);

const ICON_BASE = '/static/img/Artwork%20Items';

/** 有本地图标则返回 URL，否则返回 null（调用方回落占位图） */
export function itemIconUrl(id: number): string | null {
    return ITEM_ICON_IDS.has(id) ? \`\${ICON_BASE}/aitem_\${id}.png\` : null;
}
`;

writeFileSync(join(root, OUT), body);
console.log(`gen-item-icons: ${ids.length} icons → ${OUT}`);
