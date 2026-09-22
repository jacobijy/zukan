/**
 * 伤害浮动区间与击杀概率用例（`src/pages/calc/damage-prob.ts`）
 *
 * 重点：
 * - 伤害比例给 min%–max% 区间、超过 HP 封顶 100；
 * - OHKO 按「单下 ≥ HP」档位计数（d===HP 也算）；
 * - 两击击杀按两次独立抽取的有序档位对计数，含第一下即击倒，且不低于 OHKO。
 */
import { describe, expect, it } from 'vitest';
import {
    damagePercentRange,
    ohkoChance,
    toPercent,
    twoHitKoChance,
} from '@/pages/calc/damage-prob';

describe('damagePercentRange', () => {
    it('给 min%–max% 浮动区间', () => {
        expect(damagePercentRange([40, 60, 50], 100)).toEqual({ min: 40, max: 60 });
    });

    it('伤害超过 HP 时百分比封顶 100', () => {
        expect(damagePercentRange([150], 100)).toEqual({ min: 100, max: 100 });
    });

    it('无档位 / HP 非法时为 0–0', () => {
        expect(damagePercentRange([], 100)).toEqual({ min: 0, max: 0 });
        expect(damagePercentRange([50], 0)).toEqual({ min: 0, max: 0 });
    });
});

describe('ohkoChance', () => {
    it('单下伤害 ≥ HP 的档位占比（含正好等于 HP）', () => {
        expect(ohkoChance([99, 100, 101], 100)).toBeCloseTo(2 / 3);
        expect(toPercent(ohkoChance([99, 100, 101], 100))).toBe(67);
    });

    it('最高档不足 HP 时为 0', () => {
        expect(ohkoChance([50, 90], 100)).toBe(0);
    });
});

describe('twoHitKoChance', () => {
    it('两次独立伤害之和 ≥ HP 的有序档位对占比', () => {
        // (40,40)=80 否；(40,60)/(60,40)=100 是；(60,60) 是 → 3/4
        expect(twoHitKoChance([40, 60], 100)).toBeCloseTo(0.75);
        expect(toPercent(twoHitKoChance([40, 60], 100))).toBe(75);
    });

    it('任一档位单下即击倒时两击概率含这些情形', () => {
        // (100,100)(100,10)(10,100) 是；(10,10) 否 → 3/4
        expect(twoHitKoChance([100, 10], 100)).toBeCloseTo(0.75);
    });

    it('单档 40 两击不击倒为 0；单档 ≥HP 为 1', () => {
        expect(twoHitKoChance([40], 100)).toBe(0);
        expect(twoHitKoChance([100], 100)).toBe(1);
    });
});
