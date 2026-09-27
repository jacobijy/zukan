/**
 * team-model 纯函数用例（normalize / clamp / 校验 / 字节计数）
 *
 * 守的是“跨版本 / 异常数据安全落地”与提交约束。边界要覆盖真正会出错的形状：
 * 成员超上限、招式超上限 + 去重、SP 越界 / 非整数、默认形态 form_id、未知字段透传。
 */
import { describe, expect, it } from 'vitest';
import {
    DEFAULT_NATURE,
    LIMITS,
    emptyPayload,
    payloadByteSize,
    serializePayload,
    utf8ByteLength,
    validateName,
    validateTeam,
    normalizeMember,
    normalizePayload,
    type TeamPayload,
} from '@/services/teams/team-model';

describe('normalizeMember', () => {
    it('species_id 非正整数 / 非对象 → null', () => {
        expect(normalizeMember(null)).toBeNull();
        expect(normalizeMember('x')).toBeNull();
        expect(normalizeMember({ species_id: 0 })).toBeNull();
        expect(normalizeMember({ species_id: -3 })).toBeNull();
        expect(normalizeMember({ species_id: '25' })).toBeNull();
    });

    it('moves：滤非正整数 → 按 id 去重保序 → 限 4 招', () => {
        const m = normalizeMember({ species_id: 25, moves: [25, 25, 133, 0, -7, 9] })!;
        expect(m.moves).toEqual([25, 133, 9]);

        const capped = normalizeMember({ species_id: 1, moves: [1, 2, 3, 4, 5] })!;
        expect(capped.moves).toEqual([1, 2, 3, 4]);
        expect(capped.moves).toHaveLength(LIMITS.maxMoves);
    });

    it('form_id：默认形态（== species_id）/ 非法 → 剔除；非默认保留', () => {
        expect(normalizeMember({ species_id: 25, form_id: 25 })!.form_id).toBeUndefined();
        expect(normalizeMember({ species_id: 25, form_id: 0 })!.form_id).toBeUndefined();
        expect(normalizeMember({ species_id: 25, form_id: 10026 })!.form_id).toBe(10026);
    });

    it('ability/item：非正整数剔除', () => {
        expect(normalizeMember({ species_id: 25, ability_id: 4 })!.ability_id).toBe(4);
        expect(normalizeMember({ species_id: 25, ability_id: 0 })!.ability_id).toBeUndefined();
        expect(normalizeMember({ species_id: 25, item_id: 17 })!.item_id).toBe(17);
        expect(normalizeMember({ species_id: 25, item_id: -1 })!.item_id).toBeUndefined();
    });

    it('nature：合法 slug 保留；被 Champions 移除 / 非字符串 → serious', () => {
        expect(normalizeMember({ species_id: 1, nature: 'adamant' })!.nature).toBe('adamant');
        // hardy 是真实性格但不在 Champions 的 21 种内
        expect(normalizeMember({ species_id: 1, nature: 'hardy' })!.nature).toBe(DEFAULT_NATURE);
        expect(normalizeMember({ species_id: 1, nature: 123 })!.nature).toBe(DEFAULT_NATURE);
    });

    it('未知字段透传，已知字段被归一值覆盖', () => {
        const m = normalizeMember({ species_id: 25, custom: 'keep', moves: ['x', 7] })!;
        expect((m as unknown as Record<string, unknown>).custom).toBe('keep');
        expect(m.moves).toEqual([7]);
    });
});

describe('normalizeSpread', () => {
    it('六维 clamp：32 保留 / 33→32 / -1→0；字符串·NaN·null·缺失 → 0', () => {
        const m = normalizeMember({
            species_id: 1,
            spread: { hp: 32, atk: 33, def: -1, spa: '5', spd: Number.NaN, spe: null, extra: 1 },
        })!;
        expect(m.spread).toEqual({ hp: 32, atk: 32, def: 0, spa: 0, spd: 0, spe: 0 });
    });
});

describe('normalizePayload', () => {
    it('非对象 → 空 payload（默认 singles）', () => {
        expect(normalizePayload(null)).toEqual(emptyPayload());
        expect(normalizePayload('x').members).toEqual([]);
    });

    it('format：doubles 保留；非法 / 缺失 → singles', () => {
        expect(normalizePayload({ format: 'doubles' }).format).toBe('doubles');
        expect(normalizePayload({ format: 'triples' }).format).toBe('singles');
        expect(normalizePayload({}).format).toBe('singles');
    });

    it('members：7 个 → 留 6；null 成员被过滤', () => {
        const members = Array.from({ length: 7 }, (_, i) => ({ species_id: i + 1 }));
        const p = normalizePayload({ format: 'singles', members });
        expect(p.members).toHaveLength(LIMITS.maxMembers);
        expect(p.members.map((m) => m.species_id)).toEqual([1, 2, 3, 4, 5, 6]);

        const withGarbage = normalizePayload({ members: [{ species_id: 25 }, { species_id: 0 }, null] });
        expect(withGarbage.members.map((m) => m.species_id)).toEqual([25]);
    });

    it('未知顶层字段透传', () => {
        const p = normalizePayload({ format: 'singles', members: [], season: 5 });
        expect((p as unknown as Record<string, unknown>).season).toBe(5);
    });
});

describe('utf8ByteLength', () => {
    it('ASCII=1 / 拉丁=2 / BMP 中文=3 / emoji（代理对）=4', () => {
        expect(utf8ByteLength('A')).toBe(1);
        expect(utf8ByteLength('é')).toBe(2);
        expect(utf8ByteLength('中')).toBe(3);
        expect(utf8ByteLength('😀')).toBe(4);
        expect(utf8ByteLength('A中')).toBe(4);
    });
});

describe('validateName', () => {
    it('trim 后按码点计长，1..50；多字节 / emoji 按 1 个字符', () => {
        expect(validateName('  x  ')).toEqual({ ok: true, trimmed: 'x' });
        expect(validateName('   ').ok).toBe(false);
        expect(validateName('a'.repeat(50)).ok).toBe(true);
        expect(validateName('a'.repeat(51)).tooLong).toBe(true);
        // 50 个 emoji = 50 码点（字节再多也不影响“字符数”）
        expect(validateName('😀'.repeat(50)).ok).toBe(true);
        expect(validateName('中'.repeat(51)).tooLong).toBe(true);
    });
});

describe('validateTeam / payloadByteSize', () => {
    it('名字空 / 超长 → nameError', () => {
        expect(validateTeam('', emptyPayload()).nameError).toBe('required');
        expect(validateTeam('a'.repeat(51), emptyPayload()).nameError).toBe('tooLong');
    });

    it('payload 超 32KiB → tooLarge', () => {
        const oversized = normalizePayload({ note: 'x'.repeat(33000) }) as TeamPayload;
        expect(payloadByteSize(oversized)).toBeGreaterThan(LIMITS.payloadMaxBytes);
        expect(validateTeam('队', oversized).tooLarge).toBe(true);
    });

    it('合法队伍通过，且 trim 掉名字首尾空白', () => {
        const v = validateTeam('  冠军队  ', emptyPayload());
        expect(v.ok).toBe(true);
        expect(v.trimmedName).toBe('冠军队');
        // 序列化结果为 JSON 字符串
        expect(serializePayload(emptyPayload())).toBe('{"format":"singles","members":[]}');
    });
});
