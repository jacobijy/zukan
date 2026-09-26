/**
 * 内容语言 → 对战数据语言（纯函数，便于单测）。
 *
 * 对战数据支持 9 种：`en, zh-Hans, zh-Hant, ja, de, fr, es, it, ko`。
 * 入参为 `i18nStore.currentLang`（小写内容语言 id；'auto' 已由 store 解析）。
 * 不在对战 9 语言内的（pt-br / cs / 未知）回落 `en`。
 */
export type BattleLang = 'en' | 'zh-Hans' | 'zh-Hant' | 'ja' | 'de' | 'fr' | 'es' | 'it' | 'ko';

const BATTLE_LANG_BY_CONTENT: Record<string, BattleLang> = {
    en: 'en',
    'zh-hans': 'zh-Hans',
    'zh-hant': 'zh-Hant',
    ja: 'ja',
    'ja-hrkt': 'ja',
    'ja-roma': 'ja',
    ko: 'ko',
    fr: 'fr',
    de: 'de',
    es: 'es',
    'es-419': 'es',
    it: 'it',
};

export function toBattleLang(contentLang: string): BattleLang {
    return BATTLE_LANG_BY_CONTENT[contentLang?.toLowerCase()] ?? 'en';
}

/** 能力英文名（Showdown 口径）→ 图鉴 stat 文案 i18n key（性格 up/down 翻译用） */
export function statKeyByEnglish(english: string): string {
    const map: Record<string, string> = {
        HP: 'stats.hp',
        Attack: 'stats.attack',
        Defense: 'stats.defense',
        'Sp. Atk': 'stats.spAttack',
        'Sp. Def': 'stats.spDefense',
        Speed: 'stats.speed',
    };
    return map[english] ?? '';
}
