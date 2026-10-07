/**
 * template-model 纯函数用例（normalize / 性格 id 互转 / 校验 / 字节计数）
 *
 * 守的是「跨版本 / 异常数据安全落地」与提交约束，以及模板与编辑器的性格编号口径差异
 * （存储用 PokeAPI id 1..25，编辑器内部用 WASM 0..24 / Champions 0..20）。
 */
import { describe, expect, it } from 'vitest';
import { CHAMPION_ALIGNMENTS } from '@/pages/statcalc/statcalc-options';
import {
    LIMITS,
    emptyTemplate,
    emptyStats,
    natureInternalFromPokeId,
    naturePokeIdFromInternal,
    isNaturePokeIdValid,
    normalizePayload,
    payloadByteSize,
    serializePayload,
    utf8ByteLength,
    validateName,
    validateTemplate,
    type ChampionsTemplate,
    type StandardTemplate,
    type TemplatePayload,
} from '@/services/templates/template-model';

const BASE = { pokemon_id: 6, nature: 11, moves: [85, 247], item: 230 };

describe('emptyTemplate / 结构', () => {
    it('standard 默认满 IV、EV 全 0、性格回落到中性默认', () => {
        const p = emptyTemplate('standard') as StandardTemplate;
        expect(p.ruleset).toBe('standard');
        expect(p.ivs).toEqual({ hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 });
        expect(p.evs).toEqual(emptyStats());
        expect(p.moves).toEqual([]);
        expect(p.item).toBeNull();
    });

    it('champions 用 sp、无 ivs/evs', () => {
        const p = emptyTemplate('champions') as ChampionsTemplate;
        expect(p.ruleset).toBe('champions');
        expect('sp' in p).toBe(true);
        expect('ivs' in p).toBe(false);
        expect(p.sp).toEqual(emptyStats());
    });
});

describe('性格 id 互转', () => {
    it('standard：内部 WASM 编号 → PokeAPI id（Adamant 内部 3 → pokeId 11）', () => {
        expect(naturePokeIdFromInternal(3, 'standard')).toBe(11);
        expect(naturePokeIdFromInternal(0, 'standard')).toBe(1); // Hardy
    });

    it('standard：PokeAPI id → 内部编号（11 → 3）', () => {
        expect(natureInternalFromPokeId(11, 'standard')).toBe(3);
        expect(natureInternalFromPokeId(1, 'standard')).toBe(0);
    });

    it('champions：剔除 4 个中性后仅 21 种，Serious(pokeId 25) 为唯一中性默认', () => {
        expect(isNaturePokeIdValid(1, 'champions')).toBe(false); // Hardy 被剔除
        expect(isNaturePokeIdValid(25, 'champions')).toBe(true); // Serious 保留
        expect(isNaturePokeIdValid(11, 'champions')).toBe(true); // Adamant 保留
        // champions 内部 0 = 第一个合法性格（NATURES 过滤后，即 Lonely pokeId 6）
        expect(naturePokeIdFromInternal(0, 'champions')).toBe(CHAMPION_ALIGNMENTS[0].pokeId);
    });

    it('非法 pokeId → 回落该规则默认中性', () => {
        expect(natureInternalFromPokeId(999, 'standard')).toBe(0);
        expect(natureInternalFromPokeId(1, 'champions')).toBe(0); // Hardy 非法 → 回落默认
    });
});

describe('normalizePayload', () => {
    it('非对象 / pokemon_id 非正整数 → null', () => {
        expect(normalizePayload(null)).toBeNull();
        expect(normalizePayload('x')).toBeNull();
        expect(normalizePayload({ pokemon_id: 0 })).toBeNull();
        expect(normalizePayload({ pokemon_id: '6' })).toBeNull();
    });

    it('standard：IV/EV 越界钳制、EV 对齐 4 倍数且总和 ≤510', () => {
        const p = normalizePayload({
            ...BASE,
            ruleset: 'standard',
            ivs: { hp: 40, atk: -1, def: 31, spa: 31, spd: 31, spe: 31 },
            evs: { hp: 252, atk: 252, def: 252, spa: 1, spd: 254, spe: 4 },
        })! as StandardTemplate;
        expect(p.ruleset).toBe('standard');
        expect(p.ivs.hp).toBe(31);
        expect(p.ivs.atk).toBe(0);
        const evTotal = p.evs.hp + p.evs.atk + p.evs.def + p.evs.spa + p.evs.spd + p.evs.spe;
        expect(evTotal).toBeLessThanOrEqual(LIMITS.evTotal);
        // 每一项都是 4 的倍数
        for (const key of ['hp', 'atk', 'def', 'spa', 'spd', 'spe'] as const) {
            expect(p.evs[key] % 4).toBe(0);
        }
    });

    it('champions：SP 越界钳制、总和 ≤66', () => {
        const p = normalizePayload({
            ...BASE,
            ruleset: 'champions',
            sp: { hp: 32, atk: 32, def: 32, spa: 32, spd: 32, spe: 32 },
        })! as ChampionsTemplate;
        const total = p.sp.hp + p.sp.atk + p.sp.def + p.sp.spa + p.sp.spd + p.sp.spe;
        expect(total).toBeLessThanOrEqual(LIMITS.spTotal);
        expect(p.sp.hp).toBe(32);
    });

    it('招式：滤非正整数 → 去重保序 → 限 4 个', () => {
        const p = normalizePayload({ ...BASE, ruleset: 'standard', moves: [85, 85, 247, 0, -7, 9] })!;
        expect(p.moves).toEqual([85, 247, 9]);

        const capped = normalizePayload({ ...BASE, ruleset: 'standard', moves: [1, 2, 3, 4, 5] })!;
        expect(capped.moves).toEqual([1, 2, 3, 4]);
        expect(capped.moves).toHaveLength(LIMITS.maxMoves);
    });

    it('道具：正整数保留，其余 → null', () => {
        expect(normalizePayload({ ...BASE, ruleset: 'standard', item: 230 })!.item).toBe(230);
        expect(normalizePayload({ ...BASE, ruleset: 'standard', item: 0 })!.item).toBeNull();
        expect(normalizePayload({ ...BASE, ruleset: 'standard', item: -1 })!.item).toBeNull();
    });

    it('性格：非法 pokeId 回落到该规则默认', () => {
        const p = normalizePayload({ ...BASE, ruleset: 'standard', nature: 999 })!;
        expect(p.nature).toBe(naturePokeIdFromInternal(0, 'standard'));
    });

    it('未知字段保留，已知字段被归一值覆盖', () => {
        const p = normalizePayload({
            ...BASE,
            ruleset: 'standard',
            note: 'keep',
            moves: ['x', 7],
        })!;
        expect((p as unknown as Record<string, unknown>).note).toBe('keep');
        expect(p.moves).toEqual([7]);
    });

    it('ruleset 非法 → 回落 standard', () => {
        const p = normalizePayload({ ...BASE, ruleset: 'weird' })!;
        expect(p.ruleset).toBe('standard');
        expect('ivs' in p).toBe(true);
    });
});

describe('utf8ByteLength / validateName / validateTemplate', () => {
    it('ASCII=1 / 拉丁=2 / BMP 中文=3 / emoji（代理对）=4', () => {
        expect(utf8ByteLength('A')).toBe(1);
        expect(utf8ByteLength('é')).toBe(2);
        expect(utf8ByteLength('中')).toBe(3);
        expect(utf8ByteLength('😀')).toBe(4);
    });

    it('名称 trim 后按码点计长，1..50', () => {
        expect(validateName('  x  ')).toEqual({ ok: true, trimmed: 'x' });
        expect(validateName('   ').ok).toBe(false);
        expect(validateName('a'.repeat(50)).ok).toBe(true);
        expect(validateName('a'.repeat(51)).tooLong).toBe(true);
        expect(validateName('😀'.repeat(50)).ok).toBe(true);
    });

    it('payload 为 null → pokemonMissing（未选宝可梦）', () => {
        expect(validateTemplate('名', null).pokemonMissing).toBe(true);
    });

    it('名字空 / 超长 → nameError；合法通过且 trim', () => {
        const good = emptyTemplate('standard');
        expect(validateTemplate('', good).nameError).toBe('required');
        expect(validateTemplate('a'.repeat(51), good).nameError).toBe('tooLong');
        expect(validateTemplate('  喷火龙  ', good).trimmedName).toBe('喷火龙');
        expect(validateTemplate('  喷火龙  ', good).ok).toBe(true);
    });

    it('payload 超 32KiB → tooLarge', () => {
        const oversized = normalizePayload({ ...BASE, ruleset: 'standard', note: 'x'.repeat(33000) }) as TemplatePayload;
        expect(payloadByteSize(oversized)).toBeGreaterThan(LIMITS.payloadMaxBytes);
        expect(validateTemplate('队', oversized).tooLarge).toBe(true);
        expect(serializePayload(emptyTemplate())).toContain('"ruleset":"standard"');
    });
});
