/**
 * 招式分类规范常量用例（`src/constants/moveCategory.ts`）。
 *
 * 重点：规范 id（HOME waza 口径）1物理 / 2特殊 / 3变化 与 PokeAPI
 * move_damage_classes id（1变化 / 2物理 / 3特殊）的换算不能错位——
 * 两套 id 数字相近但语义交错，错一个会让物理招式显示成变化、且拼错图标。
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
    damageEngineCategory,
    getMoveCategory,
    getMoveCategoryByPokeapiId,
    MOVE_CATEGORIES,
    MOVE_CATEGORY_POKEAPI_IDS,
    moveCategoryIconPath,
    WAZA_CATEGORY_ICON_BASE,
} from '@/constants/moveCategory';

const ICON_DIR = join(process.cwd(), 'src/static/img/waza_category');

describe('PokeAPI id ↔ 规范分类', () => {
    it('PokeAPI 2物理/3特殊/1变化 → 规范 id 1/2/3', () => {
        expect(getMoveCategoryByPokeapiId(2)).toMatchObject({ id: 1, slug: 'physical' });
        expect(getMoveCategoryByPokeapiId(3)).toMatchObject({ id: 2, slug: 'special' });
        expect(getMoveCategoryByPokeapiId(1)).toMatchObject({ id: 3, slug: 'status' });
    });

    it('规范 id 口径：1物理 2特殊 3变化', () => {
        expect(MOVE_CATEGORIES.map((c) => c.id)).toEqual([1, 2, 3]);
        expect(MOVE_CATEGORIES.map((c) => c.slug)).toEqual(['physical', 'special', 'status']);
    });

    it('slug 反查与 PokeAPI id 一致', () => {
        expect(getMoveCategory('physical')).toMatchObject({ id: 1, pokeapiId: 2 });
        expect(getMoveCategory('special')).toMatchObject({ id: 2, pokeapiId: 3 });
        expect(getMoveCategory('status')).toMatchObject({ id: 3, pokeapiId: 1 });
    });

    it('未知 id（0 / 越界）返回 undefined', () => {
        expect(getMoveCategoryByPokeapiId(0)).toBeUndefined();
        expect(getMoveCategoryByPokeapiId(99)).toBeUndefined();
    });

    it('资料页筛选的 PokeAPI id 顺序为物理/特殊/变化 = [2,3,1]', () => {
        expect([...MOVE_CATEGORY_POKEAPI_IDS]).toEqual([2, 3, 1]);
    });
});

describe('damageEngineCategory', () => {
    it('物理/特殊映射到引擎分类', () => {
        expect(damageEngineCategory(2)).toBe('physical');
        expect(damageEngineCategory(3)).toBe('special');
    });

    it('变化招式与未知 id 返回 null（不进伤害计算器）', () => {
        expect(damageEngineCategory(1)).toBeNull();
        expect(damageEngineCategory(0)).toBeNull();
    });
});

describe('moveCategoryIconPath', () => {
    it('按规范 id 拼 waza 图标（两位零填充 + 尺寸后缀）', () => {
        expect(moveCategoryIconPath(1)).toBe(`${WAZA_CATEGORY_ICON_BASE}/waza_01m.png`);
        expect(moveCategoryIconPath(2, 'l')).toBe(`${WAZA_CATEGORY_ICON_BASE}/waza_02l.png`);
        expect(moveCategoryIconPath(3, 's')).toBe(`${WAZA_CATEGORY_ICON_BASE}/waza_03s.png`);
    });

    it('越界 id 返回 undefined', () => {
        expect(moveCategoryIconPath(0)).toBeUndefined();
        expect(moveCategoryIconPath(4)).toBeUndefined();
    });

    it('三个分类 × 三种尺寸的 9 枚图标在磁盘上都存在（守住重命名）', () => {
        for (const c of MOVE_CATEGORIES) {
            for (const size of ['l', 'm', 's'] as const) {
                const path = moveCategoryIconPath(c.id, size)!;
                const file = join(ICON_DIR, path.split('/').pop()!);
                expect(existsSync(file), `${path} -> ${file}`).toBe(true);
            }
        }
    });
});
