/**
 * `services/devtools/textBrowse.ts` 的用例。
 *
 * 测的是「分得清」而不是「能跑通」：每条用例都对应一个**如果写错、工具就会给出
 * 误导性答案**的场景。摊平函数那种 `map` 一行的字段搬运不单独测 —— 测了也只是
 * 把实现抄一遍，type-check 已经管住字段名。真正值得测的是三处判定：
 * 数字 query 的语义、搜索的覆盖面、以及 flavor 不去重这条与应用层的分歧。
 */
import { describe, expect, it } from 'vitest';
import {
    filterRows,
    fromEffects,
    fromFlavor,
    fromShapes,
    pageRows,
    type TextRow,
} from '../src/services/devtools/textBrowse';

const row = (id: number, primary: string, secondary = ''): TextRow => ({ id, primary, secondary });

/** 与 cleanFlavorText 同形状的替身：去软连字符 + 折叠空白 */
const clean = (s: string) => s.replace(/­/g, '').replace(/\s+/g, ' ').trim();

describe('filterRows: 纯数字 query', () => {
    it('是 id 精确匹配，不是子串 —— 搜 25 不该带出 250 / 1025', () => {
        const rows = [row(25, '皮卡丘'), row(250, '凤王'), row(1025, '厄诡椪'), row(2, '妙蛙草')];

        const hit = filterRows(rows, '25');

        expect(hit.map((r) => r.id)).toEqual([25]);
    });

    it('不去匹配文本里的数字 —— 否则「精确 id」的承诺就是假的', () => {
        // primary 里含 "25"，但 id 不是 25
        const rows = [row(7, '25 号道路'), row(25, '皮卡丘')];

        expect(filterRows(rows, '25').map((r) => r.id)).toEqual([25]);
    });

    it('带负号仍走 id 分支（上游偶有哨兵值 -1，不能退化成子串搜）', () => {
        const rows = [row(-1, '未知'), row(1, '妙蛙种子')];

        expect(filterRows(rows, '-1').map((r) => r.id)).toEqual([-1]);
    });

    it('前后空白不影响判定 —— 输入框里很容易多敲一个空格', () => {
        const rows = [row(25, '皮卡丘'), row(250, '凤王')];

        expect(filterRows(rows, '  25  ').map((r) => r.id)).toEqual([25]);
    });
});

describe('filterRows: 文本 query', () => {
    it('secondary 参与匹配 —— genus / 效果详述只存在于次文本', () => {
        const rows = [row(25, '皮卡丘', '鼠宝可梦'), row(1, '妙蛙种子', '种子宝可梦')];

        const hit = filterRows(rows, '鼠宝可梦');

        expect(hit.map((r) => r.id)).toEqual([25]);
    });

    it('大小写不敏感（英文语言下大小写全凭上游）', () => {
        const rows = [row(25, 'Pikachu'), row(1, 'Bulbasaur')];

        expect(filterRows(rows, 'PIKA').map((r) => r.id)).toEqual([25]);
        expect(filterRows(rows, 'pika').map((r) => r.id)).toEqual([25]);
    });

    it('含数字但非纯数字的 query 走子串 —— 这是按数字找文本的唯一出路', () => {
        const rows = [row(7, '25 号道路'), row(25, '皮卡丘')];

        expect(filterRows(rows, '25 号').map((r) => r.id)).toEqual([7]);
    });

    it('空 query 返回全部，且是副本（调用方不该改到原数组）', () => {
        const rows = [row(1, 'a'), row(2, 'b')];

        const all = filterRows(rows, '   ');

        expect(all).toHaveLength(2);
        expect(all).not.toBe(rows);
    });

    it('空串条目能被搜到（上游给了空文本时，工具要显示得出来）', () => {
        const rows = [row(1, ''), row(2, '妙蛙种子')];

        // 空串不匹配任何非空 needle，但也不能让整表崩
        expect(filterRows(rows, '妙蛙').map((r) => r.id)).toEqual([2]);
    });
});

describe('fromFlavor: 保留全部版本', () => {
    it('同一 id 的多个 version 全部保留 —— 这正是与 buildFlavorMap 的分歧点', () => {
        const entries = [
            { id: 25, text: '老版描述', version: 1 },
            { id: 25, text: '新版描述', version: 9 },
            { id: 26, text: '雷丘描述', version: 9 },
        ];

        const rows = fromFlavor(entries, clean);

        // 若误用了「只留 version 最大」的逻辑，这里会是 2 条，排查时就看不到候选
        expect(rows).toHaveLength(3);
        expect(rows.filter((r) => r.id === 25).map((r) => r.version)).toEqual([1, 9]);
    });

    it('文本过清理函数，version 原样带出（用于渲染版本标签）', () => {
        const rows = fromFlavor([{ id: 1, text: 'ELEC­TRIC\n\nmouse', version: 3 }], clean);

        expect(rows[0]!.primary).toBe('ELECTRIC mouse');
        expect(rows[0]!.version).toBe(3);
    });
});

describe('fromEffects', () => {
    it('简述作主文本、详述作次文本，两者都过清理', () => {
        const rows = fromEffects([{ id: 1, shortEffect: '  短  ', effect: '  长  ' }], clean);

        expect(rows[0]).toEqual({ id: 1, primary: '短', secondary: '长' });
    });
});

describe('fromShapes', () => {
    it('awesomeName 与 description 并进次文本', () => {
        const rows = fromShapes([{ id: 1, name: '球形', awesomeName: '大脑袋', description: '圆的' }]);

        expect(rows[0]!.secondary).toBe('大脑袋 · 圆的');
    });

    it('缺一项时不留下孤零零的分隔符', () => {
        const rows = fromShapes([{ id: 1, name: '球形', awesomeName: '', description: '圆的' }]);

        expect(rows[0]!.secondary).toBe('圆的');
    });
});

describe('pageRows', () => {
    it('total 是过滤后的总数，不是截断后的长度 —— 否则「只有 200 条」会被当成数据缺失', () => {
        const rows = Array.from({ length: 500 }, (_, i) => row(i, `n${i}`));

        const { shown, total } = pageRows(rows, 200);

        expect(shown).toHaveLength(200);
        expect(total).toBe(500);
    });

    it('不足 limit 时全量返回', () => {
        const { shown, total } = pageRows([row(1, 'a')], 200);

        expect(shown).toHaveLength(1);
        expect(total).toBe(1);
    });

    it('空表不抛（cs / pt-br 的名称组整体为空，是常态不是异常）', () => {
        expect(pageRows([], 200)).toEqual({ shown: [], total: 0 });
        expect(filterRows([], 'x')).toEqual([]);
    });
});
