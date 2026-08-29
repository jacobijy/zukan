/**
 * i18n 名称查找表的纯函数用例（`src/services/i18n/lookup.ts`）
 *
 * 重点守护回落叠加逻辑：首选语言部分/整体缺失时，英文基线必须补齐，
 * 且首选语言的非空条目要覆盖英文。这是 cs/pt-br（全空）和 ja-roma（仅物种名）
 * 两类数据缺口能否正常显示的关键。
 */
import { describe, expect, it } from 'vitest';
import { buildNamesLookup, overlay, type NamesLookup } from '@/services/i18n/lookup';
import type { I18nNamesBundle } from '@/infra/wasm';

/** 构造最小可用 bundle；只填调用方关心的字段 */
function bundle(partial: Partial<I18nNamesBundle>): I18nNamesBundle {
    return {
        languageId: 9,
        language: 'en',
        species: [],
        forms: [],
        moves: [],
        abilities: [],
        items: [],
        types: [],
        natures: [],
        stats: [],
        eggGroups: [],
        regions: [],
        versions: [],
        generations: [],
        growthRates: [],
        itemCategories: [],
        itemPockets: [],
        colors: [],
        habitats: [],
        moveAilments: [],
        moveBattleStyles: [],
        encounterMethods: [],
        evolutionTriggers: [],
        berryFirmnesses: [],
        languages: [],
        pokedexes: [],
        moveDamageClasses: [],
        moveTargets: [],
        itemFlags: [],
        moveFlags: [],
        moveCategories: [],
        itemFlingEffects: [],
        characteristics: [],
        ...partial,
    } as I18nNamesBundle;
}

describe('buildNamesLookup', () => {
    it('把 species 收成 id → {name, genus}', () => {
        const lk = buildNamesLookup(
            bundle({
                species: [
                    { id: 1, name: 'Bulbasaur', genus: 'Seed Pokémon' },
                    { id: 25, name: 'Pikachu', genus: 'Mouse Pokémon' },
                ],
            }),
        );
        expect(lk.species.get(1)).toEqual({ name: 'Bulbasaur', genus: 'Seed Pokémon' });
        expect(lk.species.get(25)?.name).toBe('Pikachu');
    });

    it('把 named 表收成 id → name', () => {
        const lk = buildNamesLookup(
            bundle({
                moves: [
                    { id: 1, name: 'Pound' },
                    { id: 2, name: 'Karate Chop' },
                ],
            }),
        );
        expect(lk.moves.get(1)).toBe('Pound');
        expect(lk.moves.get(2)).toBe('Karate Chop');
    });

    it('空名条目不进表（避免用空串覆盖英文基线）', () => {
        const lk = buildNamesLookup(
            bundle({
                moves: [{ id: 1, name: '' }],
                species: [{ id: 1, name: '', genus: '' }],
            }),
        );
        expect(lk.moves.has(1)).toBe(false);
        expect(lk.species.has(1)).toBe(false);
    });

    it('forms 收成 id → { formName, pokemonName }', () => {
        const lk = buildNamesLookup(
            bundle({
                forms: [{ id: 10033, formName: '超级妙蛙花', pokemonName: '超级妙蛙花' }],
            }),
        );
        expect(lk.forms.get(10033)).toEqual({ formName: '超级妙蛙花', pokemonName: '超级妙蛙花' });
    });

    it('forms：form_name 为空但 pokemon_name 有全名仍进表（getter 据此回落全名，而非「形态 #id」）', () => {
        // 图腾 / 羁绊变身等形态 form_name 在所有语言都为空，全名只在 pokemon_name
        const lk = buildNamesLookup(
            bundle({
                forms: [{ id: 10093, formName: '', pokemonName: 'Totem Alolan Raticate' }],
            }),
        );
        const f = lk.forms.get(10093);
        expect(f).toBeDefined();
        expect(f?.formName).toBe('');
        expect(f?.pokemonName).toBe('Totem Alolan Raticate');
        // getter 的回落契约：formName || pokemonName
        expect(f?.formName || f?.pokemonName).toBe('Totem Alolan Raticate');
    });

    it('forms：form_name 与 pokemon_name 皆空才跳过', () => {
        const lk = buildNamesLookup(
            bundle({
                forms: [{ id: 999, formName: '', pokemonName: '' }],
            }),
        );
        expect(lk.forms.has(999)).toBe(false);
    });
});

describe('overlay 回落叠加', () => {
    function en(): NamesLookup {
        return buildNamesLookup(
            bundle({
                species: [
                    { id: 1, name: 'Bulbasaur', genus: 'Seed Pokémon' },
                    { id: 25, name: 'Pikachu', genus: 'Mouse Pokémon' },
                ],
                moves: [
                    { id: 1, name: 'Pound' },
                    { id: 2, name: 'Karate Chop' },
                ],
            }),
        );
    }

    it('首选语言的非空名覆盖英文基线', () => {
        const ja = buildNamesLookup(
            bundle({
                species: [{ id: 1, name: 'フシギダネ', genus: 'たねポケモン' }],
                moves: [{ id: 1, name: 'はたく' }],
            }),
        );
        const merged = overlay(en(), ja);

        // 覆盖
        expect(merged.species.get(1)?.name).toBe('フシギダネ');
        expect(merged.moves.get(1)).toBe('はたく');
        // 未覆盖的 id 保留英文
        expect(merged.species.get(25)?.name).toBe('Pikachu');
        expect(merged.moves.get(2)).toBe('Karate Chop');
    });

    it('首选语言整表为空（cs/pt-br 场景）→ 全部回落英文', () => {
        const empty = buildNamesLookup(bundle({}));
        const merged = overlay(en(), empty);

        expect(merged.species.get(1)?.name).toBe('Bulbasaur');
        expect(merged.species.get(25)?.name).toBe('Pikachu');
        expect(merged.moves.get(1)).toBe('Pound');
    });

    it('首选语言仅物种名（ja-roma 场景）→ 物种覆盖、其余回落英文', () => {
        const roma = buildNamesLookup(
            bundle({
                species: [{ id: 1, name: 'Fushigidane', genus: 'Tane Pokémon' }],
                // moves 等其余表为空
            }),
        );
        const merged = overlay(en(), roma);

        expect(merged.species.get(1)?.name).toBe('Fushigidane');
        // moves 在 ja-roma 中为空 → 保留英文
        expect(merged.moves.get(1)).toBe('Pound');
        // 物种表里未覆盖的 id 也保留英文
        expect(merged.species.get(25)?.name).toBe('Pikachu');
    });

    it('不修改入参（返回新对象）', () => {
        const base = en();
        const ja = buildNamesLookup(bundle({ moves: [{ id: 1, name: 'はたく' }] }));
        const merged = overlay(base, ja);

        expect(merged.moves.get(1)).toBe('はたく');
        // base 未被污染
        expect(base.moves.get(1)).toBe('Pound');
    });
});
