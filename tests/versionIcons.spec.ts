/**
 * 版本 → 软件图标映射的用例（`src/constants/versionIcons.ts`）。
 *
 * 重点：
 * - 映射到的每个图标文件在磁盘上真实存在（防切片/文件名笔误）；
 * - iconFlavorOptions 只保留「有图标」的版本——数据集刻意横跨世代，
 *   含 gen1–5（红/蓝…）、剑盾 DLC（35）与朱紫 DLC（42）这些**必须被滤掉**的版本，
 *   以及成对主版本（33/34、40/41）这些**必须保留**的版本，否则 some/every 等价测不出。
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
    hasVersionIcon,
    iconFlavorOptions,
    SOFTWARE_ICON_BASE,
    VERSION_ICON_BY_VERSION,
    versionIconPath,
} from '@/constants/versionIcons';

const ICON_DIR = join(process.cwd(), 'src/static/img/software-icons');

describe('VERSION_ICON_BY_VERSION 映射完整性', () => {
    it('每个被引用 code 都有对应磁盘 PNG', () => {
        for (const code of Object.values(VERSION_ICON_BY_VERSION)) {
            const file = join(ICON_DIR, `PokeTitle_S_${code}.png`);
            expect(existsSync(file), `${code} -> ${file}`).toBe(true);
        }
    });

    it('图标静态路径走 /static 绝对路径、不经加密通道', () => {
        expect(versionIconPath(40)).toBe(
            `${SOFTWARE_ICON_BASE}/PokeTitle_S_109_SV_S.png`,
        );
    });

    it('gen1–5 与 DLC / 衍生版本无图标；主版本有图标', () => {
        // 无图标：红绿（gen1）、黑白2（gen5）、剑盾 DLC、朱紫 DLC、ZA 之外的 VC
        for (const v of [1, 2, 21, 22, 35, 36, 42, 43, 44, 50, 51]) {
            expect(hasVersionIcon(v), `version ${v} 不应有图标`).toBe(false);
            expect(versionIconPath(v)).toBeUndefined();
        }
        // 有图标：X/Y、OR/AS、剑/盾、BD/SP、LA、朱/紫、Z-A
        for (const v of [23, 24, 25, 26, 33, 34, 37, 38, 39, 40, 41, 47]) {
            expect(hasVersionIcon(v), `version ${v} 应有图标`).toBe(true);
        }
    });
});

describe('iconFlavorOptions', () => {
    it('滤掉 gen1–5 与 DLC，只留成对主版本，并按 version 升序', () => {
        // 模拟一只跨世代老物种「有描述的版本」（顺序刻意打乱）
        const options = iconFlavorOptions(
            [41, 1, 35, 23, 33, 2, 40, 34, 24, 42, 21].map((version) => ({ version })),
        );
        expect(options.map((o) => o.version)).toEqual([23, 24, 33, 34, 40, 41]);
        // 每项都带可拼出的图标路径
        expect(options.every((o) => o.iconPath.endsWith('.png'))).toBe(true);
        // 朱/紫两枚成对版本都保留、且各自指向对应图标
        expect(options.find((o) => o.version === 40)?.iconPath).toContain('109_SV_S');
        expect(options.find((o) => o.version === 41)?.iconPath).toContain('109_SV_V');
    });

    it('新物种（仅朱/紫两条）只出朱/紫', () => {
        const options = iconFlavorOptions([{ version: 40 }, { version: 41 }]);
        expect(options.map((o) => o.version)).toEqual([40, 41]);
    });

    it('只有老版本（gen1–5）描述时返回空数组（UI 据此隐藏选择器、回落纯文本）', () => {
        expect(iconFlavorOptions([{ version: 1 }, { version: 15 }, { version: 22 }])).toEqual([]);
    });

    it('空入空出', () => {
        expect(iconFlavorOptions([])).toEqual([]);
    });

    it('不改入参顺序（返回新数组）', () => {
        const input = [{ version: 41 }, { version: 40 }];
        iconFlavorOptions(input);
        expect(input.map((v) => v.version)).toEqual([41, 40]);
    });
});
