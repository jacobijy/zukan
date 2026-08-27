/**
 * 图鉴描述查找表的纯函数用例（`src/services/i18n/flavor.ts`）
 *
 * 两个重点：
 * - 同一物种在 flavor bundle 里按 version_id 存了多条，构建时只留最新版本；
 * - 回落叠加与名称组同构：首选语言缺失的物种保留英文基线。
 */
import { describe, expect, it } from 'vitest';
import {
    buildSpeciesFlavor,
    cleanFlavorText,
    overlayFlavor,
} from '@/services/i18n/flavor';
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

    it('空文本条目不进表（避免空串覆盖英文基线）', () => {
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
});

describe('overlayFlavor 回落叠加', () => {
    it('首选语言的非空描述覆盖英文', () => {
        const en = buildSpeciesFlavor(
            bundle({ species: [{ id: 1, text: 'English text', version: 40 }] }),
        );
        const ja = buildSpeciesFlavor(
            bundle({ species: [{ id: 1, text: '日本語の説明文', version: 40 }] }),
        );
        const merged = overlayFlavor(en, ja);
        expect(merged.get(1)).toBe('日本語の説明文');
    });

    it('首选语言缺该物种（ja-roma / cs / pt-br）时保留英文', () => {
        const en = buildSpeciesFlavor(
            bundle({
                species: [
                    { id: 1, text: 'English one', version: 40 },
                    { id: 25, text: 'English pika', version: 40 },
                ],
            }),
        );
        // ja-roma 仅有物种名、描述组为空
        const roma = buildSpeciesFlavor(bundle({}));
        const merged = overlayFlavor(en, roma);
        expect(merged.get(1)).toBe('English one');
        expect(merged.get(25)).toBe('English pika');
    });

    it('不修改入参（返回新 Map）', () => {
        const en = buildSpeciesFlavor(
            bundle({ species: [{ id: 1, text: 'English', version: 1 }] }),
        );
        const ja = buildSpeciesFlavor(
            bundle({ species: [{ id: 1, text: '日本語', version: 1 }] }),
        );
        const merged = overlayFlavor(en, ja);
        expect(merged.get(1)).toBe('日本語');
        expect(en.get(1)).toBe('English');
    });
});
