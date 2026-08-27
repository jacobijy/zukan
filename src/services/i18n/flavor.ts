/**
 * 把解码后的 `I18nFlavorBundle` 构建成「物种 id → 图鉴描述」的查找表。
 *
 * 纯函数：不碰网络、不碰存储，方便单测。回落（英文覆盖）与名称组同构 ——
 * 先建英文表再 `overlayFlavor` 叠加首选语言。
 *
 * 与名称组的差异：同一物种在 flavor bundle 里按 **version_id** 存了多条
 * （每个游戏版本一条），这里只保留**最新版本**的那条（version 最大），
 * 详情页展示一句即可。
 */
import type { I18nFlavorBundle } from '@/infra/wasm';

export type SpeciesFlavor = Map<number, string>;

/** 软连字符 U+00AD：上游用来标记可断词处，展示时不应出现 */
const SOFT_HYPHEN = new RegExp(String.fromCharCode(0xad), 'g');
const WHITESPACE_RUN = /\s+/g;

/**
 * 清理上游 flavor 文本：去掉软连字符（U+00AD），把游戏内换行（`\n`/`\f`/`\r`）
 * 与连续空白折成单个空格。
 */
export function cleanFlavorText(text: string): string {
    return text.replace(SOFT_HYPHEN, '').replace(WHITESPACE_RUN, ' ').trim();
}

/**
 * 收成 speciesId → 描述。同一 id 有多条（多版本）时取 version 最大者；
 * 空文本不进表（避免空串覆盖英文基线）。
 */
export function buildSpeciesFlavor(b: I18nFlavorBundle): SpeciesFlavor {
    const best = new Map<number, { text: string; version: number }>();
    for (const f of b.species) {
        if (!f.text) continue;
        const prev = best.get(f.id);
        // 打包顺序不保证版本升序，故显式比较，仅当版本更新（或持平）时覆盖。
        if (!prev || f.version >= prev.version) {
            best.set(f.id, { text: f.text, version: f.version });
        }
    }
    const out: SpeciesFlavor = new Map();
    for (const [id, v] of best) out.set(id, cleanFlavorText(v.text));
    return out;
}

/**
 * 用 `preferred` 的描述覆盖 `base`（通常 base=英文）。首选语言某物种无描述
 * （ja-roma / cs / pt-br 缺口）时保留英文。返回新 Map，不修改入参。
 */
export function overlayFlavor(base: SpeciesFlavor, preferred: SpeciesFlavor): SpeciesFlavor {
    const out = new Map(base);
    for (const [id, text] of preferred) {
        if (text) out.set(id, text);
    }
    return out;
}
