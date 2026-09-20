/**
 * 属性图标路径常量用例（`src/constants/pokemonTypes.ts` 的 `typeIconPath`）。
 *
 * 重点：`type-icons/type_NN{s,m,l}.png` 的编号 NN = 标准 type id（Types 枚举 /
 * PokeAPI id），slug → 编号不能错位——尤其贴纸目录另有 19–36 的第二套美术变体，
 * UI 只用 01–18。
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ALL_TYPE_SLUGS, TYPE_ICON_BASE, typeIconPath } from '@/constants/pokemonTypes';

const ICON_DIR = join(process.cwd(), 'src/static/img/type-icons');

describe('typeIconPath', () => {
    it('slug → 编号 = 标准 type id（两位零填充），默认 m 档', () => {
        expect(typeIconPath('normal')).toBe(`${TYPE_ICON_BASE}/type_01m.png`);
        expect(typeIconPath('fire')).toBe(`${TYPE_ICON_BASE}/type_10m.png`);
    });

    it('易错位属性的编号正确：地面05 岩石06 超能力14 妖精18', () => {
        expect(typeIconPath('ground')).toBe(`${TYPE_ICON_BASE}/type_05m.png`);
        expect(typeIconPath('rock')).toBe(`${TYPE_ICON_BASE}/type_06m.png`);
        expect(typeIconPath('psychic')).toBe(`${TYPE_ICON_BASE}/type_14m.png`);
        expect(typeIconPath('fairy')).toBe(`${TYPE_ICON_BASE}/type_18m.png`);
    });

    it('尺寸档后缀 s / l', () => {
        expect(typeIconPath('water', 's')).toBe(`${TYPE_ICON_BASE}/type_11s.png`);
        expect(typeIconPath('dragon', 'l')).toBe(`${TYPE_ICON_BASE}/type_16l.png`);
    });

    it('大小写不敏感；未知 / 空 slug 返回 undefined（回落文字徽章）', () => {
        expect(typeIconPath('FIRE')).toBe(`${TYPE_ICON_BASE}/type_10m.png`);
        expect(typeIconPath('nope')).toBeUndefined();
        expect(typeIconPath('')).toBeUndefined();
    });

    it('18 个标准属性 × 三档的 54 枚图标（01–18）在磁盘上都存在（守住重命名）', () => {
        for (const slug of ALL_TYPE_SLUGS) {
            for (const size of ['s', 'm', 'l'] as const) {
                const path = typeIconPath(slug, size)!;
                const file = join(ICON_DIR, path.split('/').pop()!);
                expect(existsSync(file), `${path} -> ${file}`).toBe(true);
            }
        }
    });
});
