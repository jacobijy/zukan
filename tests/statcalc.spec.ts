/**
 * `src/pages/statcalc/statcalc-engine.ts` + `statcalc-options.ts` 用例
 *
 * 能力值公式的坑在性格修正与 HP/非 HP 两套公式，用官方面板值锚定：
 * 喷火龙（HP78 攻84 防78 特攻109 特防85 速100）是经典验算样本。
 * 性格表刻意与 WASM `calculate_nature_mod` 不一致（后者 Lonely/Brave、Jolly
 * 等条目有误），这里把几条修正过的条目逐个钉死，防止回退。
 */
import { describe, expect, it } from 'vitest';
import {
    calcStat,
    calcHp,
    calcOtherStat,
    calcChampStat,
    calcChampHp,
    calcChampOtherStat,
    clampSp,
    MAX_SP_TOTAL,
    MAX_SP_PER_STAT,
    getBaseStat,
    clampIv,
    clampEv,
    MAX_EV_TOTAL,
    type StatKey,
} from '@/pages/statcalc/statcalc-engine';
import {
    NATURES,
    natureModFor,
    getNature,
    STAT_KEYS,
    CHAMPION_ALIGNMENTS,
    getChampAlignment,
    champAlignmentMod,
    DEFAULT_CHAMP_ALIGNMENT_ID,
} from '@/pages/statcalc/statcalc-options';

// 喷火龙种族值
const CHARIZARD = { hp: 78, atk: 84, def: 78, spa: 109, spd: 85, spe: 100 };

describe('能力值公式（喷火龙锚点）', () => {
    it('HP：lv50 / IV31 / EV0 / 中性 = 153', () => {
        expect(calcHp(CHARIZARD.hp, 50, 31, 0)).toBe(153);
    });

    it('非 HP：lv50 / IV31 / EV0 / 中性，速度 = 120', () => {
        // floor((2*100+31)*50/100)+5 = floor(115.5)+5 = 115+5 = 120
        expect(calcOtherStat(CHARIZARD.spe, 50, 31, 0, 100)).toBe(120);
    });

    it('性格 +10%：固执(Adamant) 攻 = 114', () => {
        // 中性攻击 floor((2*84+31)*0.5)+5 = floor(99.5)+5 = 104，×1.1 向下取整 = 114
        const adamant = NATURES.find((n) => n.slug === 'adamant')!;
        expect(calcOtherStat(CHARIZARD.atk, 50, 31, 0, adamant.mods.atk!)).toBe(114);
    });

    it('性格 -10%：固执(Adamant) 特攻 = floor(129*0.9) = 116', () => {
        // 中性特攻 floor((2*109+31)*50/100)+5 = floor(124.5)+5 = 129
        const adamant = NATURES.find((n) => n.slug === 'adamant')!;
        expect(calcOtherStat(CHARIZARD.spa, 50, 31, 0, adamant.mods.spa!)).toBe(116);
    });

    it('满努力满个体 lv100：爽朗(Jolly) 速度 = 328（官方极限速度）', () => {
        const jolly = NATURES.find((n) => n.slug === 'jolly')!;
        // (2*100+31+floor(252/4)) + 5 = 299，×1.1 = 328
        expect(calcOtherStat(CHARIZARD.spe, 100, 31, 252, jolly.mods.spe!)).toBe(328);
    });

    it('HP 不受性格修正影响', () => {
        // 即便传入 90，HP 也走 HP 公式
        expect(calcStat('hp', CHARIZARD.hp, 50, 31, 0, 90)).toBe(calcHp(CHARIZARD.hp, 50, 31, 0));
    });

    it('calcStat 按短键分派 HP 与其他项', () => {
        expect(calcStat('hp', CHARIZARD.hp, 50, 31, 0)).toBe(153);
        expect(calcStat('spe', CHARIZARD.spe, 50, 31, 0, 100)).toBe(120);
    });

    it('IV/EV 越界钳制：IV 封顶 31、EV 封顶 252、负值归零', () => {
        expect(clampIv(99)).toBe(31);
        expect(clampIv(-5)).toBe(0);
        expect(clampEv(300)).toBe(252);
        expect(clampEv(-8)).toBe(0);
    });
});

describe('性格表正确性', () => {
    it('共 25 种，id 0..24 与 pokeId 1..25 各唯一', () => {
        expect(NATURES).toHaveLength(25);
        expect(new Set(NATURES.map((n) => n.id))).toEqual(new Set(Array.from({ length: 25 }, (_, i) => i)));
        expect(new Set(NATURES.map((n) => n.pokeId))).toEqual(new Set(Array.from({ length: 25 }, (_, i) => i + 1)));
    });

    it('每个非中性性格恰有一项 +110、一项 -90，且不是同一项，HP 永不出现', () => {
        for (const n of NATURES) {
            const entries = Object.entries(n.mods) as [StatKey, number][];
            if (entries.length === 0) continue; // 5 个中性
            const ups = entries.filter(([, m]) => m === 110);
            const downs = entries.filter(([, m]) => m === 90);
            expect(ups).toHaveLength(1);
            expect(downs).toHaveLength(1);
            expect(ups[0][0]).not.toBe(downs[0][0]);
            expect(entries.map(([k]) => k)).not.toContain('hp');
        }
        // 恰好 5 个中性性格
        expect(NATURES.filter((n) => Object.keys(n.mods).length === 0)).toHaveLength(5);
    });

    it('修正过 WASM 错表的条目：Lonely/Brave/Jolly', () => {
        // WASM 表 Lonely 误写成 +攻-速、Brave +攻-防、Jolly +特攻；这里钉死正确值
        expect(getNature(1).mods).toEqual({ atk: 110, def: 90 }); // Lonely 怕寂寞
        expect(getNature(2).mods).toEqual({ atk: 110, spe: 90 }); // Brave 勇敢
        expect(getNature(21).mods).toEqual({ spe: 110, spa: 90 }); // Jolly 爽朗
    });

    it('natureModFor：HP 恒 100，未涉及项回落 100', () => {
        const jolly = getNature(21);
        expect(natureModFor(jolly.id, 'hp')).toBe(100);
        expect(natureModFor(jolly.id, 'atk')).toBe(100); // Jolly 不修正攻击
        expect(natureModFor(jolly.id, 'spe')).toBe(110);
        expect(natureModFor(jolly.id, 'spa')).toBe(90);
    });
});

describe('getBaseStat', () => {
    const stats = [
        { name: 'HP', value: 78 },
        { name: '攻击', value: 84 },
        { name: '防御', value: 78 },
        { name: '特攻', value: 109 },
        { name: '特防', value: 85 },
        { name: '速度', value: 100 },
    ];

    it('按短键取种族值', () => {
        expect(getBaseStat(stats, 'spa')).toBe(109);
        expect(getBaseStat(stats, 'hp')).toBe(78);
    });

    it('缺失项回落 50', () => {
        expect(getBaseStat([{ name: '攻击', value: 84 }], 'spe')).toBe(50);
    });
});

describe('EV 总量约束（页面层规则的不变量）', () => {
    it('六项努力值总和上限为 510', () => {
        expect(MAX_EV_TOTAL).toBe(510);
    });

    it('六项 STAT_KEYS 覆盖 hp/atk/def/spa/spd/spe', () => {
        expect(STAT_KEYS).toEqual(['hp', 'atk', 'def', 'spa', 'spd', 'spe']);
    });
});

// ─── Pokémon Champions 能力点（SP）模式 ─────────────────────────────
describe('Champions SP 公式（base 100 锚点）', () => {
    it('非 HP：base100 / SP0 / 中性 = 120（满个体 Lv50 无努力）', () => {
        // floor((2*100+31)*0.5)+5 = 115+5 = 120
        expect(calcChampOtherStat(100, 0, 100)).toBe(120);
    });

    it('1 SP 在 Lv50 恰好 +1 能力（线性、无 4:1 换算）', () => {
        expect(calcChampOtherStat(100, 1, 100)).toBe(121);
        expect(calcChampOtherStat(100, 32, 100)).toBe(152);
    });

    it('性格 +10% 作用在含 SP 的最终值上：SP0 中性 120 → +10% = 132', () => {
        expect(calcChampOtherStat(100, 0, 110)).toBe(132);
        // floor((120+32)*1.1) = floor(167.2) = 167
        expect(calcChampOtherStat(100, 32, 110)).toBe(167);
    });

    it('HP：base100 / SP0 = 175；1 SP 同样 +1', () => {
        // floor((2*100+31)*0.5)+60 = 115+60 = 175
        expect(calcChampHp(100, 0)).toBe(175);
        expect(calcChampHp(100, 32)).toBe(207);
    });

    it('HP 不受性格倾向修正', () => {
        expect(calcChampStat('hp', 100, 0, 90)).toBe(calcChampHp(100, 0));
        expect(calcChampStat('hp', 100, 0, 110)).toBe(calcChampHp(100, 0));
    });

    it('SP 钳制：单项封顶 32、负值归零', () => {
        expect(clampSp(50)).toBe(32);
        expect(clampSp(-3)).toBe(0);
        expect(MAX_SP_PER_STAT).toBe(32);
        expect(MAX_SP_TOTAL).toBe(66);
    });
});

describe('Champions Stat Alignments', () => {
    it('共 21 种（25 性格去掉 Hardy/Docile/Bashful/Quirky 四个中性）', () => {
        expect(CHAMPION_ALIGNMENTS).toHaveLength(21);
        const removed = ['hardy', 'docile', 'bashful', 'quirky'];
        for (const slug of removed) {
            expect(CHAMPION_ALIGNMENTS.some((a) => a.slug === slug)).toBe(false);
        }
    });

    it('Serious 是唯一中性，且为默认选项', () => {
        const serious = getChampAlignment(DEFAULT_CHAMP_ALIGNMENT_ID);
        expect(serious.slug).toBe('serious');
        expect(Object.keys(serious.mods)).toHaveLength(0);
        // 其余 20 种都有 +110 / -90
        const nonNeutral = CHAMPION_ALIGNMENTS.filter((a) => a.slug !== 'serious');
        expect(nonNeutral).toHaveLength(20);
        for (const a of nonNeutral) {
            const mods = Object.values(a.mods);
            expect(mods).toContain(110);
            expect(mods).toContain(90);
        }
    });

    it('Jolly = +速度 -特攻（钉死，复用修正过的性格表）', () => {
        const jolly = CHAMPION_ALIGNMENTS.find((a) => a.slug === 'jolly')!;
        expect(jolly.mods).toEqual({ spe: 110, spa: 90 });
        expect(champAlignmentMod(jolly.id, 'spe')).toBe(110);
        expect(champAlignmentMod(jolly.id, 'spa')).toBe(90);
        expect(champAlignmentMod(jolly.id, 'hp')).toBe(100);
    });
});

describe('Champions 实战锚点（烈咬陆鲨 Jolly：32 攻 / 32 速 / 2 HP）', () => {
    // Garchomp 种族值：HP108 攻130 速102 特攻80
    it('速度 32SP + Jolly(+速) = 169', () => {
        const jolly = CHAMPION_ALIGNMENTS.find((a) => a.slug === 'jolly')!;
        // core = floor((2*102+31)*0.5)+5+32 = 117+37 = 154；×1.1 = floor(169.4) = 169
        expect(calcChampStat('spe', 102, 32, champAlignmentMod(jolly.id, 'spe'))).toBe(169);
    });

    it('特攻 0SP + Jolly(-特攻) = 90', () => {
        const jolly = CHAMPION_ALIGNMENTS.find((a) => a.slug === 'jolly')!;
        // core = floor((2*80+31)*0.5)+5 = 95+5 = 100；×0.9 = 90
        expect(calcChampStat('spa', 80, 0, champAlignmentMod(jolly.id, 'spa'))).toBe(90);
    });

    it('HP 2SP 中性 = 185', () => {
        // floor((2*108+31)*0.5)+60+2 = 123+62 = 185
        expect(calcChampHp(108, 2)).toBe(185);
    });
});
