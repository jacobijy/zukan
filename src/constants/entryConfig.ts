/**
 * 功能 tab / 资料 tab 入口卡片统一配置（注册表 + 分区引用）。
 *
 * 所有入口卡片**只定义一次**（`ENTRY_REGISTRY`），页面用分区数组的 key 引用来布局：
 * 调顺序、挪分区、增删条目只改这里，不动组件逻辑；同一条目可被多个分区引用
 * （如 `notice` 公告同时进功能列表与资料页的「资讯」分区）。
 *
 * 配置只放静态数据：title/desc/meta 存 i18n key（页面层 `t()` 解析），
 * 动态计数（招式/特性/道具/蛋组真实条目数）用 `EntryCountMeta.countOf` 描述，
 * 由页面基于 i18nStore.lookup 解析并回落。跳转统一走 `navigateToAuto`
 * （内置 tabBar 判断，无需在配置里标记是否 tab 页）。
 */
import type { HubIconName } from '@/components/shared/HubIcon.vue';

/** 真实条目计数 meta：`i18nStore.lookup[countOf].size` 未就绪为空时落回 fallback */
export interface EntryCountMeta {
    countOf: 'moves' | 'abilities' | 'items' | 'eggGroups';
    fallback: string;
}

/** 一条入口卡片（注册表条目），key 全局唯一，只定义一次 */
export interface EntryRowConfig {
    key: string;
    /** i18n key */
    titleKey: string;
    /** i18n key */
    descKey: string;
    /** 第三列：i18n key（meta / 静态 value）或真实条目计数（countOf） */
    meta?: string | EntryCountMeta;
    icon: HubIconName;
    /** 既有 list-row__icon--* 配色变体（src/static/styles/global.css） */
    iconClass: string;
    url: string;
}

/** 分区：只通过 key 引用注册表条目（须是 EntryKey，写错/新增未登记即编译报错），行序即显示序 */
export interface EntrySectionConfig {
    key: string;
    /** 分区标题 i18n key（功能页固定显示「常用工具」，资料页三分区各自标题） */
    labelKey: string;
    /** 条目 key 引用，字面量联合见下文 EntryKey（定义在注册表之后，类型引用允许前向） */
    rows: readonly EntryKey[];
}

/** 共享解析后结构：页面拿它渲染，不再关心注册表 */
export interface ResolvedSection {
    key: string;
    labelKey: string;
    rows: readonly EntryRowConfig[];
}

// ── 注册表：功能 7 条 + 资料 7 条（公告 notice 只有一份，两页分区共用） ──

export const ENTRY_REGISTRY = [
    // 功能 tab
    {
        key: 'calc',
        titleKey: 'features.calc.title',
        descKey: 'features.calc.desc',
        meta: 'features.calc.meta',
        icon: 'hub-damage',
        iconClass: 'list-row__icon--green',
        url: '/pages/calc/calc',
    },
    {
        key: 'statcalc',
        titleKey: 'features.statcalc.title',
        descKey: 'features.statcalc.desc',
        meta: 'features.statcalc.meta',
        icon: 'hub-stat',
        iconClass: 'list-row__icon--blue',
        url: '/pages/statcalc/statcalc',
    },
    {
        key: 'simulate',
        titleKey: 'features.simulate.title',
        descKey: 'features.simulate.desc',
        meta: 'features.simulate.meta',
        icon: 'hub-battle',
        iconClass: 'list-row__icon--gray',
        url: '/pages/simulate/simulate',
    },
    {
        key: 'teams',
        titleKey: 'features.teams.title',
        descKey: 'features.teams.desc',
        meta: 'features.teams.meta',
        icon: 'hub-team',
        iconClass: 'list-row__icon--gold',
        url: '/pages/teams/teams',
    },
    {
        key: 'templates',
        titleKey: 'features.templates.title',
        descKey: 'features.templates.desc',
        meta: 'features.templates.meta',
        icon: 'hub-template',
        iconClass: 'list-row__icon--violet',
        url: '/pages/templates/templates',
    },
    {
        key: 'stats',
        titleKey: 'features.stats.title',
        descKey: 'features.stats.desc',
        meta: 'features.stats.meta',
        icon: 'hub-stats',
        iconClass: 'list-row__icon--violet',
        url: '/pages/data/data',
    },
    // 资料 tab · 数据概览（pokemon/types 静态数，moves/abilities/items/eggGroups 真实计数）
    {
        key: 'pokemon',
        titleKey: 'data.overview.total',
        descKey: 'data.overview.totalDesc',
        meta: 'data.overview.pokemonMeta',
        icon: 'data-dex',
        iconClass: 'list-row__icon--gray',
        url: '/pages/index/index',
    },
    {
        key: 'types',
        titleKey: 'data.overview.types',
        descKey: 'data.overview.typesDesc',
        meta: 'data.overview.typesMeta',
        icon: 'data-type',
        iconClass: 'list-row__icon--gold',
        url: '/pages/archive/types',
    },
    {
        key: 'moves',
        titleKey: 'data.overview.moves',
        descKey: 'data.overview.movesDesc',
        meta: { countOf: 'moves', fallback: '400+' },
        icon: 'data-move',
        iconClass: 'list-row__icon--blue',
        url: '/pages/archive/moves',
    },
    {
        key: 'abilities',
        titleKey: 'data.overview.abilities',
        descKey: 'data.overview.abilitiesDesc',
        meta: { countOf: 'abilities', fallback: '300+' },
        icon: 'data-ability',
        iconClass: 'list-row__icon--red',
        url: '/pages/archive/abilities',
    },
    {
        key: 'items',
        titleKey: 'data.overview.items',
        descKey: 'data.overview.itemsDesc',
        meta: { countOf: 'items', fallback: '—' },
        icon: 'data-item',
        iconClass: 'list-row__icon--green',
        url: '/pages/archive/items',
    },
    {
        key: 'eggGroups',
        titleKey: 'data.overview.eggGroups',
        descKey: 'data.overview.eggGroupsDesc',
        meta: { countOf: 'eggGroups', fallback: '15' },
        icon: 'data-egg',
        iconClass: 'list-row__icon--violet',
        url: '/pages/archive/egg-groups',
    },
    // 资料 tab · 对战数据
    {
        key: 'battleMeta',
        titleKey: 'meta.entryTitle',
        descKey: 'meta.entryDesc',
        icon: 'data-meta',
        iconClass: 'list-row__icon--violet',
        url: '/pages/meta/meta',
    },
    // 资料 tab · 资讯（同时也是功能列表的「官方公告」——同一条目两处引用）
    {
        key: 'notice',
        titleKey: 'data.notice',
        descKey: 'data.noticeDesc',
        icon: 'data-notice',
        iconClass: 'list-row__icon--blue',
        url: '/pages/notices/notices',
    },
] as const satisfies readonly EntryRowConfig[];

/** 注册表条目 key 的字面量联合：加条目进 ENTRY_REGISTRY 即自动扩展，分区 rows 引用到未登记 key 时编译报错 */
export type EntryKey = (typeof ENTRY_REGISTRY)[number]['key'];

// ── 布局：分区按 key 引用注册表条目 ──

/** 功能 tab：单分区「常用工具」 */
export const FEATURE_SECTIONS: readonly EntrySectionConfig[] = [
    {
        key: 'tools',
        labelKey: 'features.sectionTools',
        rows: ['calc', 'statcalc', 'simulate', 'teams', 'templates', 'stats', 'notice'],
    },
];

/** 资料 tab：数据概览 / 对战数据 / 资讯 三分区 */
export const DATA_SECTIONS: readonly EntrySectionConfig[] = [
    {
        key: 'overview',
        labelKey: 'data.sectionOverview',
        rows: ['pokemon', 'types', 'moves', 'abilities', 'items', 'eggGroups'],
    },
    { key: 'battle', labelKey: 'data.sectionBattle', rows: ['battleMeta'] },
    { key: 'notice', labelKey: 'data.sectionNotice', rows: ['notice'] },
];

// ── 解析：key → 配置（找不到的 key 丢弃，防止脏配置整页崩溃） ──

const REGISTRY_BY_KEY = new Map<EntryKey, EntryRowConfig>(
    ENTRY_REGISTRY.map((entry) => [entry.key, entry] as const),
);

export function resolveSections(sections: readonly EntrySectionConfig[]): readonly ResolvedSection[] {
    return sections.map((section) => ({
        key: section.key,
        labelKey: section.labelKey,
        rows: section.rows.map((key) => REGISTRY_BY_KEY.get(key)).filter((x): x is EntryRowConfig => x !== undefined),
    }));
}
