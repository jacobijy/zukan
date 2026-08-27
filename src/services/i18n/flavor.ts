/**
 * 把解码后的 `I18nFlavorBundle` 构建成「物种 id → 图鉴描述」的查找表。
 *
 * 纯函数：不碰网络、不碰存储，方便单测。
 *
 * 与名称组的差异：同一物种在 flavor bundle 里按 **version_id** 存了多条
 * （每个游戏版本一条），这里只保留**最新版本**的那条（version 最大），
 * 详情页展示一句即可。
 *
 * 回落不在本文件做：完整语言（zh-hans / ja / en … 共 11 种）的物种描述本身
 * 齐全，直接用；cs / pt-br / ja-roma 的描述组为空（返回的 Map `size === 0`），
 * 由调用方据此回落英文基线——避免为每个用户都下载 ~2.7MB 的英文 flavor 包。
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
 * 空文本不进表。描述组为空的语言（cs / pt-br / ja-roma）返回空 Map，
 * 调用方据 `size === 0` 回落英文。
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
