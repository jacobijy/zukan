// 本文件由 scripts/build-icons.mjs 自动生成，请勿手改
/* eslint-disable */

export const GLYPH: Record<string, string> = {
    'arrow-left': '\uf129',
    'bag': '\uf128',
    'book': '\uf127',
    'bookmark': '\uf125',
    'bookmark-fill': '\uf126',
    'brand-apple': '\uf124',
    'brand-phone': '\uf123',
    'brand-weixin': '\uf122',
    'check': '\uf121',
    'chevron-down': '\uf120',
    'chevron-left': '\uf11f',
    'chevron-right': '\uf11e',
    'chevron-up': '\uf11d',
    'clock': '\uf11c',
    'cloud': '\uf11b',
    'crown': '\uf11a',
    'eye': '\uf118',
    'eye-off': '\uf119',
    'file-lines': '\uf117',
    'filter': '\uf116',
    'globe': '\uf115',
    'heart': '\uf113',
    'heart-fill': '\uf114',
    'info': '\uf112',
    'log-in': '\uf111',
    'package': '\uf110',
    'plus': '\uf10f',
    'refresh-ccw': '\uf10e',
    'search': '\uf10d',
    'share': '\uf10c',
    'shield': '\uf10b',
    'sparkle': '\uf10a',
    'star': '\uf108',
    'star-fill': '\uf109',
    'tab-book': '\uf107',
    'tab-folder': '\uf106',
    'tab-grid': '\uf105',
    'tab-person': '\uf104',
    'target': '\uf103',
    'trash': '\uf102',
    'x': '\uf101',
};

/** 取图标字形（找不到返回空串） */
export function glyph(name: string): string {
    return GLYPH[name] ?? '';
}
