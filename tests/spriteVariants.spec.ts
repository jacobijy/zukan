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
