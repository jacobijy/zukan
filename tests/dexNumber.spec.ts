/**
 * 展示编号用例（`src/utils/helpers.ts::dexNumber`）。
 *
 * 规则：非默认形态（pokemon id 10001+）的展示编号沿用本体 speciesId，
 * 不能露出形态自身的内部 id（如代欧奇希斯速度形态 10003 应显示 NO.386）。
 */
import { describe, expect, it } from 'vitest';
import { dexNumber, padId } from '@/utils/helpers';

describe('dexNumber', () => {
    it('默认形态直接用自身 id', () => {
        expect(dexNumber({ id: 386, speciesId: 386 })).toBe(386);
    });

    it('非默认形态回落到本体物种编号', () => {
        expect(dexNumber({ id: 10003, speciesId: 386 })).toBe(386);
        expect(dexNumber({ id: 10034, speciesId: 6 })).toBe(6);
    });

    it('speciesId 缺席（单形态/其它构造路径）视为等于 id', () => {
        expect(dexNumber({ id: 25 })).toBe(25);
    });

    it('padId 补零到三位', () => {
        expect(padId(dexNumber({ id: 10003, speciesId: 386 }))).toBe('386');
        expect(padId(dexNumber({ id: 10034, speciesId: 6 }))).toBe('006');
    });
});
