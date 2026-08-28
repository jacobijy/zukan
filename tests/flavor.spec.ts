/**
 * 描述/效果查找表的纯函数用例（`src/services/i18n/flavor.ts`）
 *
 * 两个重点：
 * - 同一实体在 flavor bundle 里按 version / version_group 存了多条，
 *   构建时只留最新版本；四类表（species/moves/abilities/items）同一逻辑；
 * - 描述组为空的语言（cs / pt-br / ja-roma）四张表全空，flavorSize === 0，
 *   store 据此回落英文基线——避免为每个用户都下载 ~2.7MB 英文 flavor 包。
 */
import { describe, expect, it } from 'vitest';
import { buildFlavorBundle, cleanFlavorText, flavorSize } from '@/services/i18n/flavor';
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

describe('buildFlavorBundle', () => {
    it('四类 flavor 表各按 id 收描述', () => {
        const f = buildFlavorBundle(
            bundle({
                species: [{ id: 1, text: 'Bulba dex text.', version: 1 }],
                moves: [{ id: 10, text: 'Tackle move text.', version: 1 }],
                abilities: [{ id: 20, text: 'Stench ability text.', version: 1 }],
                items: [{ id: 30, text: 'Potion item text.', version: 1 }],
            }),
        );
        expect(f.species.get(1)).toBe('Bulba dex text.');
        expect(f.moves.get(10)).toBe('Tackle move text.');
        expect(f.abilities.get(20)).toBe('Stench ability text.');
        expect(f.items.get(30)).toBe('Potion item text.');
    });

    it('同一实体多版本时取 version 最大（最新）的一条（数据集打乱顺序）', () => {
        const f = buildFlavorBundle(
            bundle({
                moves: [
                    { id: 25, text: 'OLD Red/Blue text', version: 1 },
                    { id: 25, text: 'NEW Scarlet/Violet text', version: 25 },
                    { id: 25, text: 'MID Sword/Shield text', version: 20 },
                ],
            }),
        );
        expect(f.moves.get(25)).toBe('NEW Scarlet/Violet text');
    });

    it('空文本条目不进表（完整语言也可能个别实体缺描述）', () => {
        const f = buildFlavorBundle(
            bundle({
                abilities: [
                    { id: 1, text: '', version: 1 },
                    { id: 2, text: 'has text', version: 1 },
                ],
            }),
        );
        expect(f.abilities.has(1)).toBe(false);
        expect(f.abilities.get(2)).toBe('has text');
    });

    it('效果表（仅英文有数据）收成 id → shortEffect，并清理换行', () => {
        const f = buildFlavorBundle(
            bundle({
                abilityEffects: [
                    { id: 1, shortEffect: 'Has a 10%\nchance of flinching.', effect: 'long' },
                    { id: 2, shortEffect: '', effect: 'empty short' },
                ],
                moveEffects: [{ id: 9, shortEffect: 'Inflicts damage.', effect: 'long' }],
            }),
        );
        expect(f.abilityEffects.get(1)).toBe('Has a 10% chance of flinching.');
        expect(f.abilityEffects.has(2)).toBe(false);
        expect(f.moveEffects.get(9)).toBe('Inflicts damage.');
    });

    it('描述组整体为空（cs / pt-br / ja-roma）→ flavorSize 为 0，供 store 回落英文', () => {
        expect(flavorSize(buildFlavorBundle(bundle({})))).toBe(0);
    });

    it('任一 flavor 表有条目则 flavorSize > 0（部分缺失不整包回落英文）', () => {
        const f = buildFlavorBundle(bundle({ items: [{ id: 1, text: 'x', version: 1 }] }));
        expect(flavorSize(f)).toBe(1);
    });
});
