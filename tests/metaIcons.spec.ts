/**
 * `src/services/meta/icons.ts` 用例
 *
 * 契约关键（docs/data/battle-usage.md「图标」）：道具图标文件名**就是 rows 里的
 * item.name（英文显示名）**，含空格时必须 URL 编码，且不另建映射。若漏掉
 * encodeURIComponent，"Choice Scarf" 会拼出带空格的非法 URL 而裂图。
 */
import { describe, expect, it } from 'vitest';
import { battleItemIconUrl } from '@/services/meta';

/** 取出 query（dev cache-bust）之前的路径部分做断言，忽略 base 与 ?_dc */
function pathOf(url: string): string {
    return url.slice(0, url.indexOf('?') === -1 ? url.length : url.indexOf('?'));
}

describe('meta icons · battleItemIconUrl', () => {
    it('用英文显示名拼明文图标路径', () => {
        expect(pathOf(battleItemIconUrl('Salamencite'))).toBe(
            '/assets/battle/icons/items/Salamencite.png',
        );
    });

    it('含空格的名字被百分号编码', () => {
        expect(pathOf(battleItemIconUrl('Choice Scarf'))).toBe(
            '/assets/battle/icons/items/Choice%20Scarf.png',
        );
        expect(pathOf(battleItemIconUrl('Garchompite Z'))).toBe(
            '/assets/battle/icons/items/Garchompite%20Z.png',
        );
    });

    it('撇号随 encodeURIComponent 保留（不转义）', () => {
        // encodeURIComponent 不编码 ' ，路径仍合法
        expect(pathOf(battleItemIconUrl("King's Rock"))).toBe(
            "/assets/battle/icons/items/King's%20Rock.png",
        );
    });
});
