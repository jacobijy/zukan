/**
 * `src/constants/spriteVariants.ts` 用例
 *
 * 守的是回落链的构造：链首必须是主 variant（否则详情页传 artwork 会先去拉 home），
 * 且不能重复（重复项 = 一次白跑的 404 往返）。
 */
import { describe, expect, it } from 'vitest';
import {
    SPRITE_PREVIEW,
    SPRITE_FALLBACKS,
    SPRITE_DEGENDERED,
    SPRITE_VARIANT_CATALOG,
    buildSpriteChain,
} from '@/constants/spriteVariants';

describe('buildSpriteChain', () => {
    it('默认链是 home → artwork → front', () => {
        expect(buildSpriteChain('home')).toEqual(['home', 'artwork', 'front']);
    });

    it('主 variant 恒为首项 —— 先试调用方要的那张，不是回落表里的第一张', () => {
        expect(buildSpriteChain('shiny')[0]).toBe('shiny');
        expect(buildSpriteChain('back')[0]).toBe('back');
    });

    it('主 variant 出现在回落表里时去重，不重复请求', () => {
        // artwork 既是主 variant 又在默认回落表里
        expect(buildSpriteChain('artwork')).toEqual(['artwork', 'front']);
        // front 同理
        expect(buildSpriteChain('front')).toEqual(['front', 'artwork']);
    });

    it('回落表内部的重复项也去重', () => {
        expect(buildSpriteChain('home', ['artwork', 'artwork', 'front'])).toEqual([
            'home',
            'artwork',
            'front',
        ]);
    });

    it('空回落表 = 只试主 variant', () => {
        expect(buildSpriteChain('home', [])).toEqual(['home']);
    });

    it('preview 与回落表的常量口径一致（front 既是低清先行也是最后兜底）', () => {
        expect(SPRITE_PREVIEW).toBe('front');
        expect(SPRITE_FALLBACKS).toContain(SPRITE_PREVIEW);
    });
});

/**
 * 性别专属 variant 的回落。
 *
 * `female` 缺失不是资源缺口 —— 上游只在雌性外观确实不同时才产出它（1346 个数字 id
 * 里仅 103 个有），所以 404 恰恰说明「默认图就是雌性的样子」。回落到无性别版本是
 * 正确答案，不是妥协。
 */
describe('buildSpriteChain：性别回落', () => {
    it('home-female 先回落 home，再走通用回落', () => {
        expect(buildSpriteChain('home-female')).toEqual(['home-female', 'home', 'artwork', 'front']);
    });

    it('female 回落到 front（同为像素图），且不因此重复出现 front', () => {
        expect(buildSpriteChain('female')).toEqual(['female', 'front', 'artwork']);
    });

    it('无性别版本插在通用回落之前 —— 同一只的默认图优先于换画风的 artwork', () => {
        const chain = buildSpriteChain('home-female');
        expect(chain.indexOf('home')).toBeLessThan(chain.indexOf('artwork'));
    });

    it('shiny 刻意不配对：闪光缺失时回落非闪光是显示错的东西，与 female 语义不对称', () => {        expect(SPRITE_DEGENDERED).not.toHaveProperty('shiny');
        expect(SPRITE_DEGENDERED).not.toHaveProperty('home-shiny');
        expect(buildSpriteChain('home-shiny')).toEqual(['home-shiny', 'artwork', 'front']);
    });

    it('每个性别专属 variant 的无性别版本本身在 catalog 里（回落目标必须真实存在）', () => {
        for (const [gendered, base] of Object.entries(SPRITE_DEGENDERED)) {
            expect(SPRITE_VARIANT_CATALOG).toContain(gendered);
            expect(SPRITE_VARIANT_CATALOG).toContain(base);
        }
    });

    it('自定义回落表也照样先插无性别版本', () => {
        expect(buildSpriteChain('home-female', ['dream'])).toEqual(['home-female', 'home', 'dream']);
    });

    it('dream-female 回落 dream（只有 592/593 两个数字 id 有）', () => {
        expect(buildSpriteChain('dream-female')).toEqual(['dream-female', 'dream', 'artwork', 'front']);
    });

    it('三条性别映射全在表里，一条不落', () => {
        expect(Object.keys(SPRITE_DEGENDERED).toSorted()).toEqual(['dream-female', 'female', 'home-female']);
    });
});
