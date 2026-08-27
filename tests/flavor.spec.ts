/**
 * 图鉴描述查找表的纯函数用例（`src/services/i18n/flavor.ts`）
 *
 * 两个重点：
 * - 同一物种在 flavor bundle 里按 version_id 存了多条，构建时只留最新版本；
 * - 描述组为空的语言（cs / pt-br / ja-roma）构建出空 Map（`size === 0`），
 *   store 据此回落英文基线——避免为每个用户都下载 ~2.7MB 英文 flavor 包。
 */
import { describe, expect, it } from 'vitest';
import { buildSpeciesFlavor, cleanFlavorText } from '@/services/i18n/flavor';
import type { I18nFlavorBundle } from '@/infra/wasm';

function bundle(partial: Partial<I18nFlavorBundle>): I18nFlavorBundle {
    return {
        languageId: 9,
        language: 'en',
        species: [],
        moves: [],
        abilities: [],
        items: [],
        abilityEffects: [],
        moveEffects: [],
        ...partial,
    } as I18nFlavorBundle;
}

describe('cleanFlavorText', () => {
    it('把游戏内换行 / 换页折成空格', () => {
        expect(cleanFlavorText('A strange\nseed was\nplanted.')).toBe(
            'A strange seed was planted.',
        );
        expect(cleanFlavorText('line1\fline2\rline3')).toBe('line1 line2 line3');
    });

    it('去掉软连字符 U+00AD', () => {
        const shy = String.fromCharCode(0xad);
        expect(cleanFlavorText(`Poke${shy}mon`)).toBe('Pokemon');
    });

    it('压缩连续空白并去首尾空白', () => {
        expect(cleanFlavorText('  a   b\tc  ')).toBe('a b c');
    });
});

describe('buildSpeciesFlavor', () => {
    it('收成 speciesId → 描述', () => {
        const m = buildSpeciesFlavor(
            bundle({
                species: [{ id: 1, text: 'Bulba dex text.', version: 1 }],
            }),
        );
        expect(m.get(1)).toBe('Bulba dex text.');
    });

    it('同一物种多版本时取 version 最大（最新）的一条', () => {
        const m = buildSpeciesFlavor(
            bundle({
                species: [
                    { id: 25, text: 'OLD Red/Blue text', version: 1 },
                    { id: 25, text: 'NEW Scarlet/Violet text', version: 40 },
                    { id: 25, text: 'MID Sword/Shield text', version: 33 },
                ],
            }),
        );
        // 数据集特意打乱版本顺序，验证不是简单取最后一条
        expect(m.get(25)).toBe('NEW Scarlet/Violet text');
    });

    it('打包顺序逆序（新版本在前）时仍取最大版本', () => {
        const m = buildSpeciesFlavor(
            bundle({
                species: [
                    { id: 25, text: 'NEW', version: 40 },
                    { id: 25, text: 'OLD', version: 1 },
                ],
            }),
        );
        expect(m.get(25)).toBe('NEW');
    });

    it('空文本条目不进表（完整语言也可能个别物种缺描述）', () => {
        const m = buildSpeciesFlavor(
            bundle({
                species: [
                    { id: 1, text: '', version: 1 },
                    { id: 2, text: 'has text', version: 1 },
                ],
            }),
        );
        expect(m.has(1)).toBe(false);
        expect(m.get(2)).toBe('has text');
    });

    it('描述组整体为空（cs / pt-br / ja-roma）→ 空 Map，供 store 回落英文', () => {
        const m = buildSpeciesFlavor(bundle({}));
        expect(m.size).toBe(0);
    });
});
