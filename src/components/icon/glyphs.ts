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
    'eye': '\uf119',
    'eye-off': '\uf11a',
    'file-lines': '\uf118',
    'filter': '\uf117',
    'globe': '\uf116',
    'heart': '\uf114',
    'heart-fill': '\uf115',
    'info': '\uf113',
    'log-in': '\uf112',
    'package': '\uf111',
    'plus': '\uf110',
    'refresh-ccw': '\uf10f',
    'search': '\uf10e',
    'share': '\uf10d',
    'shield': '\uf10c',
    'sparkle': '\uf10b',
    'star': '\uf109',
    'star-fill': '\uf10a',
    'tab-book': '\uf108',
    'tab-folder': '\uf107',
    'tab-grid': '\uf106',
    'tab-person': '\uf105',
    'target': '\uf104',
    'trash': '\uf103',
    'users': '\uf102',
    'x': '\uf101',
};

/** 取图标字形（找不到返回空串） */
export function glyph(name: string): string {
    return GLYPH[name] ?? '';
}
