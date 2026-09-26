/**
 * 对战数据 adapter / 语言映射用例
 * （`src/services/meta/adapter.ts`、`battleLang.ts`）。
 *
 * 纯函数、node 环境零 stub。覆盖：排行榜/选用率按 rank、相对 rank1 的 barWidth、
 * 无效 pct 过滤、spread 取整与 0..32 钳制、队友保序、配置缺组为 []、语言映射回落。
 */
import { describe, expect, it } from 'vitest';
import {
    capFormat,
    toPokemonConfig,
    toRateRows,
    toSlugs,
    toSpreadRows,
    toTeammateNames,
} from '@/services/meta/adapter';
import { toBattleLang } from '@/services/meta/battleLang';
import type {
    LeaderboardEntryJson,
    PokemonConfigJson,
    RateRowJson,
    SpreadRowJson,
    TeammateRowJson,
} from '@/services/meta/types';

describe('toSlugs', () => {
    const entries: LeaderboardEntryJson[] = [
        { id: 'b', rank: 2 },
        { id: 'a', rank: 1 },
        { id: '', rank: 3 },
    ];
    it('丢弃空 id，按 rank 升序', () => {
        expect(toSlugs(entries)).toEqual(['a', 'b']);
    });
    it('缺省 entries 返回 []', () => {
        expect(toSlugs(undefined)).toEqual([]);
    });
});

describe('toRateRows', () => {
    const rows: RateRowJson[] = [
        { rank: 2, name: 'B', pct: 50 },
        { rank: 1, name: 'A', pct: 100 },
        { rank: 3, name: 'C', pct: Number.NaN },
    ];
    it('过滤无效 pct，按 rank 升序', () => {
        const out = toRateRows(rows);
        expect(out.map((r) => r.name)).toEqual(['A', 'B']);
    });
    it('barWidth 相对 rank1（rank1=100）', () => {
        const out = toRateRows(rows);
        expect(out.map((r) => r.barWidth)).toEqual([100, 50]);
        expect(out.map((r) => r.pct)).toEqual([100, 50]);
    });
});

describe('toSpreadRows', () => {
    const rows: SpreadRowJson[] = [
        { rank: 1, pct: 20, hp: 1.6, atk: 99, def: -5, spa: 0, spd: 7, spe: 32 },
        { rank: 2, pct: 10, hp: 0, atk: 16, def: 0, spa: 0, spd: 0, spe: 16 },
    ];
    it('六项取整并钳制在 0..32', () => {
        const out = toSpreadRows(rows);
        expect(out[0]).toMatchObject({ hp: 2, atk: 32, def: 0, spd: 7, spe: 32 });
    });
    it('barWidth 相对 rank1', () => {
        const out = toSpreadRows(rows);
        expect(out.map((r) => r.barWidth)).toEqual([100, 50]);
    });
});

describe('toTeammateNames', () => {
    const rows: TeammateRowJson[] = [
        { rank: 2, name: 'B' },
        { rank: 1, name: 'A' },
        { rank: 3, name: '' },
    ];
    it('丢弃空名，按 rank 升序', () => {
        expect(toTeammateNames(rows)).toEqual(['A', 'B']);
    });
});

describe('toPokemonConfig', () => {
    const json: PokemonConfigJson = {
        id: 'salamence',
        rank: 1,
        rows: {
            move: [{ rank: 1, name: 'Double-Edge', pct: 77.8 }],
            ability: [{ rank: 1, name: 'Intimidate', pct: 99.1 }],
        },
    };
    it('六组分流，缺组为 []', () => {
        const vm = toPokemonConfig(json);
        expect(vm.slug).toBe('salamence');
        expect(vm.moves.map((r) => r.name)).toEqual(['Double-Edge']);
        expect(vm.abilities.map((r) => r.name)).toEqual(['Intimidate']);
        expect(vm.items).toEqual([]);
        expect(vm.natures).toEqual([]);
        expect(vm.spreads).toEqual([]);
        expect(vm.teammates).toEqual([]);
    });
});

describe('capFormat', () => {
    it('小写赛制 → 上游大写段', () => {
        expect(capFormat('singles')).toBe('Singles');
        expect(capFormat('doubles')).toBe('Doubles');
    });
});

describe('toBattleLang', () => {
    it('内容语言 → 对战语言', () => {
        expect(toBattleLang('zh-hans')).toBe('zh-Hans');
        expect(toBattleLang('zh-hant')).toBe('zh-Hant');
    });
    it('日方言归一到 ja（大小写不敏感）', () => {
        expect(toBattleLang('JA-HRKT')).toBe('ja');
        expect(toBattleLang('ja-roma')).toBe('ja');
    });
    it('不支持 / 未知回落 en', () => {
        expect(toBattleLang('pt-br')).toBe('en');
        expect(toBattleLang('nope')).toBe('en');
    });
});
