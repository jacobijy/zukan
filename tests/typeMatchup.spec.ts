/**
 * 属性相克纯函数用例（`src/services/pokemon/typeMatchup.ts`）
 *
 * 档位语义：chart[def].damageTaken[atk] 0=普通 1=弱点(2×) 2=抵抗(0.5×) 3=免疫。
 * attackMatchups(slug)：以 slug 为攻方；defenseMatchups(slug)：以 slug 为防方。
 */
import { describe, expect, it } from 'vitest';
import { attackMatchups, defenseMatchups } from '@/services/pokemon/typeMatchup';

describe('attackMatchups（攻击视角）', () => {
    it('火属性招式：对草/冰/虫/钢效果绝佳（2×）', () => {
        const { weak } = attackMatchups('fire');
        for (const slug of ['grass', 'ice', 'bug', 'steel']) expect(weak).toContain(slug);
    });

    it('火属性招式：对火/水/岩/龙效果不佳（0.5×）', () => {
        const { resist } = attackMatchups('fire');
        for (const slug of ['fire', 'water', 'rock', 'dragon']) expect(resist).toContain(slug);
    });

    it('一般属性招式：对幽灵属性无效（0×），且没有 2× 对象', () => {
        const m = attackMatchups('normal');
        expect(m.immune).toEqual(['ghost']);
        expect(m.weak).toHaveLength(0);
    });
});

describe('defenseMatchups（防御视角）', () => {
    it('火属性宝可梦：弱水/地面/岩石', () => {
        const { weak } = defenseMatchups('fire');
        expect(weak.toSorted()).toEqual(['ground', 'rock', 'water']);
    });

    it('火属性宝可梦：抗火/草/冰/虫/钢/妖精', () => {
        const { resist } = defenseMatchups('fire');
        expect(resist.toSorted()).toEqual(['bug', 'fairy', 'fire', 'grass', 'ice', 'steel']);
    });

    it('一般属性宝可梦：被格斗克制，免疫幽灵攻击', () => {
        const m = defenseMatchups('normal');
        expect(m.weak).toEqual(['fighting']);
        expect(m.immune).toEqual(['ghost']);
        expect(m.resist).toHaveLength(0);
    });

    it('未知 slug 返回三个空组（不抛异常）', () => {
        expect(defenseMatchups('???')).toEqual({ weak: [], resist: [], immune: [] });
    });
});
