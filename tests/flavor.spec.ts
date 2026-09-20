/**
 * 描述/效果查找表的纯函数用例（`src/services/i18n/flavor.ts`）
 *
 * 两个重点：
 * - 同一实体在 flavor bundle 里按 version / version_group 存了多条：
 *   species（图鉴描述）**全部保留**供详情页按版本切换，moves/abilities/items
 *   只留最新版本一条；
 * - 描述组为空的语言（cs / pt-br / ja-roma）四张表全空，flavorSize === 0，
 *   store 据此回落英文基线——避免为每个用户都下载 ~2.7MB 英文 flavor 包。
 */
import { describe, expect, it } from 'vitest';
import {
    buildFlavorBundle,
    cleanFlavorText,
    EFFECT_LANGS,
    EMPTY_FLAVOR_LANGS,
    flavorSize,
    latestVersionText,
    mergeFlavorRefs,
    mergeVersionedFlavorRefs,
    resolveFlavorLang,
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
        // species 保留全部版本（这里只有一条），返回按 version 升序的数组
        expect(f.species.get(1)).toEqual([{ version: 1, text: 'Bulba dex text.' }]);
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

describe('mergeFlavorRefs（分片合并）', () => {
    it('把一片的原始行追加进查找表，返回新 Map、不改入参', () => {
        const target = new Map([[1, '已有描述']]);
        const next = mergeFlavorRefs(target, [
            { id: 2, text: '片内新条目', version: 1 },
            { id: 3, text: '', version: 1 },
        ]);

        expect(next.get(1)).toBe('已有描述'); // 目标条目原样保留
        expect(next.get(2)).toBe('片内新条目');
        expect(next.has(3)).toBe(false); // 空文本被跳过
        expect(target.size).toBe(1); // 入参未被就地修改
    });

    it('同一片内同一 id 多版本仍取 version 最大（数据不保证按版本排序）', () => {
        const next = mergeFlavorRefs(new Map(), [
            { id: 25, text: 'MID', version: 20 },
            { id: 25, text: 'NEW', version: 25 },
            { id: 25, text: 'OLD', version: 1 },
        ]);

        expect(next.get(25)).toBe('NEW');
    });

    it('追加的条目带软连字符 / 换行会被清理', () => {
        const shy = String.fromCharCode(0xad);
        const next = mergeFlavorRefs(new Map(), [{ id: 7, text: `A strange\nseed${shy}.`, version: 1 }]);

        expect(next.get(7)).toBe('A strange seed.');
    });
});

describe('mergeVersionedFlavorRefs（species 多版本保留）', () => {
    it('同一 id 的多个版本全保留，按 version 升序（输入打乱顺序）', () => {
        const next = mergeVersionedFlavorRefs(new Map(), [
            { id: 1, text: 'Violet', version: 41 },
            { id: 1, text: 'X', version: 23 },
            { id: 1, text: 'Sword', version: 33 },
        ]);
        expect(next.get(1)?.map((v) => v.version)).toEqual([23, 33, 41]);
        expect(next.get(1)?.map((v) => v.text)).toEqual(['X', 'Sword', 'Violet']);
    });

    it('不同 id 互不干扰（数据交错出现）', () => {
        const next = mergeVersionedFlavorRefs(new Map(), [
            { id: 1, text: 'bulba-v', version: 40 },
            { id: 25, text: 'pika-x', version: 23 },
            { id: 1, text: 'bulba-x', version: 23 },
        ]);
        expect(next.get(1)?.map((v) => v.version)).toEqual([23, 40]);
        expect(next.get(25)).toEqual([{ version: 23, text: 'pika-x' }]);
    });

    it('空文本版本被丢弃', () => {
        const next = mergeVersionedFlavorRefs(new Map(), [
            { id: 1, text: '', version: 1 },
            { id: 1, text: 'real', version: 40 },
        ]);
        expect(next.get(1)?.map((v) => v.version)).toEqual([40]);
    });

    it('同一 (id, version) 重复时后到的覆盖，并清理文本', () => {
        const next = mergeVersionedFlavorRefs(new Map(), [
            { id: 1, text: 'old\nline', version: 40 },
            { id: 1, text: 'new line', version: 40 },
        ]);
        expect(next.get(1)).toEqual([{ version: 40, text: 'new line' }]);
    });

    it('与 target 已有版本合并（跨片累积），返回新 Map、不改入参', () => {
        const target = mergeVersionedFlavorRefs(new Map(), [{ id: 1, text: 'X', version: 23 }]);
        const next = mergeVersionedFlavorRefs(target, [{ id: 1, text: 'Violet', version: 41 }]);
        expect(next.get(1)?.map((v) => v.version)).toEqual([23, 41]);
        expect(target.get(1)?.map((v) => v.version)).toEqual([23]);
    });

    it('没有任何非空版本的 id 不进表', () => {
        const next = mergeVersionedFlavorRefs(new Map(), [{ id: 9, text: '', version: 1 }]);
        expect(next.has(9)).toBe(false);
    });
});

describe('latestVersionText', () => {
    it('取升序数组末条（最新版本）文本', () => {
        expect(
            latestVersionText([
                { version: 23, text: 'X' },
                { version: 41, text: 'Violet' },
            ]),
        ).toBe('Violet');
    });

    it('空数组返回 null', () => {
        expect(latestVersionText([])).toBeNull();
    });
});

describe('描述组语言静态名单', () => {
    it('空语言（cs / pt-br / ja-roma）一律定位英文分片', () => {
        for (const lang of EMPTY_FLAVOR_LANGS) {
            expect(resolveFlavorLang(lang)).toBe('en');
        }
        // 不修改入参约定外的语言
        expect(resolveFlavorLang('zh-hans')).toBe('zh-hans');
        expect(resolveFlavorLang('en')).toBe('en');
    });

    it('效果文件只有 en / fr / de 产出，其余语言不应去拉', () => {
        expect(EFFECT_LANGS).toContain('en');
        expect(EFFECT_LANGS).toContain('fr');
        expect(EFFECT_LANGS).toContain('de');
        expect(EFFECT_LANGS).not.toContain('zh-hans');
    });
});
